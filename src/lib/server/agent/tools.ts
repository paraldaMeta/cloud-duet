// The tools the model can call when a key is set. Each one reads the sample
// workspace or changes the store, which streams to the app like the demo does.
// Anything that leaves the app (email, payments, form submits) goes through an
// approval card; the model is told it hasn't happened yet.
import type {
  AgentStatus, Approval, ArtifactType, DirectApp, EmailPayload, Message, Reminder, SuggestionItem, Task, TaskResource,
} from "@/lib/shared/types";
import { find, id, nowIso, patch, state, upsert } from "../store";
import { SAMPLE } from "../fixtures";
import {
  advanceStep, card, createArtifact, createTask, pendingEmail, proposeTask, readyForReview, remember,
  requestApproval, say, system, taskPatch, taskResource, taskUpdate,
} from "../engine/actions";
import { renderDoc } from "../engine/artifacts";
import { checkToolCall, sensitiveData } from "../guardrails";
import * as direct from "../direct";
import { TOOLKITS, composioReady, isReadAction, realApps, runAction, searchActions, sendGmail } from "../composio";
import * as browser from "../browser";
import { locale } from "@/lib/i18n";
import { tr, userLang } from "../i18n";

export interface ToolContext {
  channelId: string;
  taskId?: string;
  /** Quick replies the model asked for; attached to its last bubble. */
  quickReplies?: string[];
  /** Starts a model-run task in the background. */
  spawnTask: (taskId: string) => void;
}

type JsonSchema = Record<string, unknown>;

export interface Tool {
  name: string;
  description: string;
  input_schema: JsonSchema & { type: "object" };
  /** The status line shown while it runs. */
  status?: AgentStatus;
  /** Connector id that must be connected. */
  app?: string;
  scope?: "chat" | "task";
  /** Sample-workspace tools step aside once one of these apps is connected for real. */
  sample?: string[];
  /** Only offered when this returns true. */
  when?: () => boolean;
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string> | string;
}

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : v == null ? fallback : String(v));
const obj = (properties: Record<string, JsonSchema>, required: string[] = []) => ({ type: "object" as const, properties, required });
const S = (description: string): JsonSchema => ({ type: "string", description });

const FILES = [
  { name: "Series A deck v7", type: "Slides", edited: "2 days ago", owner: "you", summary: "14 slides. Traction slide still shows Q2 numbers." },
  { name: "Mercury Labs launch QA list", type: "Sheet", edited: "today", owner: "Diana Ortiz", summary: "27 items, 4 still open: 2 copy fixes, 1 Safari layout bug, 1 analytics event." },
  { name: "Northwind Q4 shipped log", type: "Doc", edited: "last week", owner: "you", summary: "Shipped: new onboarding, billing portal, 2 integrations (HubSpot, Slack)." },
  { name: "Onboarding v4", type: "Design", edited: "today", owner: "Sam Patel", summary: "Figma file. Sam left 6 comments on the Welcome frame." },
  { name: "Newsletter — November draft", type: "Doc", edited: "yesterday", owner: "you", summary: "Goes out Thursday 9 AM. Needs a lead story." },
];

const connected = (app: string) => !!state().connectors.find((c) => c.id === app && c.connected);
const toolMode = (app: string, slug: string) =>
  state().connectors.find((c) => c.id === app)?.tools.find((t) => t.slug === slug)?.mode ?? "ask";
const appName = (app: string) => state().connectors.find((c) => c.id === app)?.name ?? app;

function firstNewParagraph(before: string, after: string) {
  const old = new Set(before.split(/\n+/).map((p) => p.trim()));
  return after.split(/\n+/).map((p) => p.trim()).find((p) => p && !old.has(p));
}

const RESOURCE_TYPE: Record<ArtifactType, TaskResource["type"]> = {
  dashboard: "Dashboard", docs: "Doc", slides: "Slides", webpage: "Web page", design: "Design", designsystem: "Design",
};

export const TOOLS: Tool[] = [
  // ── reading ──────────────────────────────────────────────────────────
  {
    name: "search_email",
    sample: ["gmail", "mailbox"],
    description: "Search the person's Gmail inbox. Empty query lists recent mail. Returns sender, subject, snippet, age and whether it needs a reply.",
    input_schema: obj({ query: S("Words to match in sender, subject or body. Empty for recent mail."), needs_reply_only: { type: "boolean" } }),
    status: "Searching your email",
    app: "gmail",
    run: ({ query, needs_reply_only }) => {
      const q = str(query).toLowerCase().split(/\s+/).filter(Boolean);
      const hits = SAMPLE.inbox.filter((m) => {
        if (needs_reply_only && !m.needsReply) return false;
        const hay = `${m.from} ${m.email} ${m.subject} ${m.snippet}`.toLowerCase();
        return q.every((w) => hay.includes(w));
      });
      if (!hits.length) return "No matching email.";
      return JSON.stringify(hits.map((m) => ({ ...m, received: m.daysAgo === 0 ? "today" : `${m.daysAgo} days ago` })));
    },
  },
  {
    name: "read_calendar",
    sample: ["gcal"],
    description: "List the person's upcoming calendar events.",
    input_schema: obj({}),
    status: "Checking your calendar",
    app: "gcal",
    run: () => JSON.stringify(SAMPLE.calendar),
  },
  {
    name: "search_files",
    sample: ["gdrive"],
    description: "Search the person's Google Drive for docs, sheets, slides and designs.",
    input_schema: obj({ query: S("Words to match in the file name or contents. Empty for recent files.") }),
    status: "Checking recent files",
    app: "gdrive",
    run: ({ query }) => {
      const q = str(query).toLowerCase().split(/\s+/).filter(Boolean);
      const hits = FILES.filter((f) => q.every((w) => `${f.name} ${f.summary} ${f.owner}`.toLowerCase().includes(w)));
      return hits.length ? JSON.stringify(hits) : "No matching files.";
    },
  },
  {
    name: "list_invoices",
    sample: ["stripe", "quickbooks"],
    description: "List unpaid and overdue customer invoices from the person's books.",
    input_schema: obj({}),
    status: "Checking",
    run: () => JSON.stringify(SAMPLE.invoices.map((i) => ({ ...i, currency: "USD" }))),
  },
  {
    name: "check_memory",
    description: "Read what you remember about the person, their saved skills, open tasks and pending approvals.",
    input_schema: obj({}),
    status: "Checking memory",
    run: () => {
      const s = state();
      return JSON.stringify({
        memory: s.memory || "(nothing yet)",
        skills: s.skills,
        open_tasks: s.tasks.filter((t) => !t.archived && t.status !== "resolved").map((t) => ({ title: t.title, status: t.status, latest: t.latest })),
        pending_approvals: s.approvals.filter((a) => a.status === "pending").map((a) => ({ kind: a.kind, to: a.email?.to, subject: a.email?.subject, merchant: a.payment?.merchant })),
        reminders: s.reminders.filter((r) => !r.fired).map((r) => ({ at: r.at, text: r.text })),
      });
    },
  },
  {
    name: "search_past_chats",
    description: "Search earlier messages across all channels and tasks.",
    input_schema: obj({ query: S("Words to look for.") }, ["query"]),
    status: "Looking something up",
    run: ({ query }) => {
      const q = str(query).toLowerCase();
      const hits = state().messages.filter((m) => m.text && m.role !== "system" && m.text.toLowerCase().includes(q)).slice(-12);
      return hits.length
        ? JSON.stringify(hits.map((m) => ({ who: m.role, channel: m.channelId, in_task: !!m.taskId, at: m.createdAt, text: m.text.slice(0, 300) })))
        : "Nothing found.";
    },
  },

  // ── memory and reminders ──────────────────────────────────────────────
  {
    name: "remember",
    description: "Save a durable fact or preference about the person to memory. Use for things that will matter later, not one-off details.",
    input_schema: obj({ fact: S("One short sentence.") }, ["fact"]),
    status: "Checking memory",
    run: ({ fact }, ctx) => {
      const f = str(fact).trim();
      if (!f) return "Nothing to save.";
      remember(f);
      system(ctx.channelId, tr("Cloud Duet updated its memory."), "note", ctx.taskId);
      return "Saved to memory.";
    },
  },
  {
    name: "set_reminder",
    description: "Set a reminder. It posts in this channel and sends a notification at that time.",
    input_schema: obj({ at: S("When, as an ISO 8601 date-time with timezone offset."), text: S("What to remind them about.") }, ["at", "text"]),
    run: ({ at, text }, ctx) => {
      const t = Date.parse(str(at));
      if (Number.isNaN(t)) return "Error: `at` isn't a valid ISO date-time.";
      if (t < Date.now() - 60_000) return "Error: that time has already passed.";
      const r: Reminder = { id: id(), at: new Date(t).toISOString(), text: str(text), channelId: ctx.channelId, fired: false };
      upsert("reminders", r);
      const when = new Date(t).toLocaleString(locale(userLang()), { dateStyle: "medium", timeStyle: "short", timeZone: state().user.timezone || "UTC" });
      system(ctx.channelId, tr("Cloud Duet set a reminder for {when}.", { when }), "note", ctx.taskId);
      return `Reminder set for ${when}.`;
    },
  },

  // ── email ────────────────────────────────────────────────────────────
  {
    name: "draft_email",
    description:
      "Draft an email from the person's Gmail or their connected mailbox (QQ Mail, 163…). Unless they've set sending to Always, this shows an approval card and nothing is sent until they tap Send. Never say it was sent unless this tool says so.",
    input_schema: obj({
      to: S("Recipient email address."), cc: S("Optional CC."), subject: S("Subject line."), body: S("Plain-text body, signed with the person's first name."),
      from_app: { type: "string", enum: ["gmail", "mailbox"], description: "Which account sends it. Defaults to the connected mailbox when there's one and Gmail isn't really connected." },
    }, ["to", "subject", "body"]),
    status: "Writing a draft",
    run: async ({ to, cc, subject, body, from_app }, ctx) => {
      const mailbox = direct.ready("mailbox");
      const via = from_app === "mailbox" || from_app === "gmail" ? from_app : mailbox && !realApps().includes("gmail") ? "mailbox" : "gmail";
      if (via === "mailbox" && !mailbox) return "The mailbox isn't connected. Tell the person they can connect QQ Mail or another mailbox from the Cloud Duet sheet.";
      if (via === "gmail" && !connected("gmail")) return "Gmail isn't connected. Tell the person they can connect it from the Cloud Duet sheet (tap Cloud Duet at the top of the chat), then try again.";
      const email = { app: via, from: via === "mailbox" ? direct.creds("mailbox")?.email : undefined, to: str(to), cc: str(cc) || undefined, subject: str(subject), body: str(body) } as EmailPayload;
      const blocked = sensitiveData(email);
      if (blocked) return blocked;
      if (toolMode(via, via === "mailbox" ? "MAILBOX_SEND" : "GMAIL_SEND_EMAIL") === "always") {
        if (via === "mailbox") {
          try {
            await direct.run("mailbox", "send", email as unknown as Record<string, unknown>);
          } catch (e) {
            return `The mailbox couldn't send it: ${(e as Error).message}`;
          }
        } else if (realApps().includes("gmail")) {
          const r = await sendGmail(email);
          if (!r.ok) return `Gmail couldn't send it: ${r.error ?? "unknown error"}`;
        }
        system(ctx.channelId, tr("Cloud Duet sent an email to {to}.", { to: email.to }), "note", ctx.taskId);
        if (ctx.taskId) taskUpdate(ctx.taskId, tr("Sent email to {to}", { to: email.to }), "Gmail");
        return `Sent to ${email.to} (the person allows sending without asking).`;
      }
      const a = await requestApproval(ctx.channelId, "email", { email }, { taskId: ctx.taskId });
      return `Draft ${a.id} is waiting for the person's OK on an approval card. It has NOT been sent. Don't repeat the draft in chat; they can read it on the card and ask you to change it.`;
    },
  },
  {
    name: "revise_draft",
    description: "Change the pending email draft in this conversation after the person asks for edits. The card updates in place.",
    input_schema: obj({ subject: S("New subject, if it changes."), body: S("The full new body.") }),
    status: "Writing a draft",
    run: ({ subject, body }, ctx) => {
      const a = [...state().approvals].reverse().find((x) => x.kind === "email" && x.status === "pending" && x.channelId === ctx.channelId && (!ctx.taskId || x.taskId === ctx.taskId))
        ?? pendingEmail(ctx.channelId);
      if (!a?.email) return "Error: there's no pending draft here. Use draft_email instead.";
      const next = { ...a.email, subject: str(subject) || a.email.subject, body: str(body) || a.email.body };
      const changed = firstNewParagraph(a.email.body, next.body) ?? next.subject;
      patch<Approval>("approvals", a.id, { email: next, highlight: { text: changed, at: nowIso() } });
      return "Draft updated on the card. Still not sent.";
    },
  },

  // ── payments and the browser ──────────────────────────────────────────
  {
    name: "request_payment",
    description: "Ask to pay for something with a one-time Link card. Shows an approval card; nothing is charged until the person approves.",
    input_schema: obj({
      merchant: S("Who gets paid."), item: S("What's being bought."), amount: { type: "number", description: "Amount in major units, e.g. 24.5" },
      currency: S("ISO currency code, default USD."), description: S("One line on why."),
    }, ["merchant", "item", "amount"]),
    app: "link",
    run: async ({ merchant, item, amount, currency, description }, ctx) => {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) return "Error: amount must be a positive number.";
      const expires = new Date(Date.now() + 30 * 60_000).toISOString();
      await requestApproval(ctx.channelId, "payment", {
        payment: { amount: n, currency: (str(currency) || "USD").toUpperCase(), merchant: str(merchant), item: str(item), description: str(description), wallet: "link", expiresAt: expires },
      }, { taskId: ctx.taskId });
      return `Payment card shown. Nothing is charged until they approve.${state().settings.paymentsTestMode ? " Payments are in test mode." : ""}`;
    },
  },
  {
    name: "use_browser",
    description: "Do something on a website in your own browser: sign up, register, book, fill in a form, look something up that needs clicking around. Starts a background task where you drive the browser; the person signs in on a card and approves before anything is submitted.",
    input_schema: obj({ goal: S("What to do, in the person's words, with any details they gave."), url: S("Starting URL, if known.") }, ["goal"]),
    status: "Waking Cloud Duet's workspace",
    scope: "chat",
    run: ({ goal, url }, ctx) => {
      const g = str(goal);
      const task = createTask({
        channelId: ctx.channelId,
        title: g.length > 60 ? `${g.slice(0, 57).trimEnd()}…` : g,
        prompt: `Use your browser to: ${g}${str(url) ? `\nStart at ${str(url)}` : ""}`,
        description: tr("In Cloud Duet's own browser ({kind}). Cloud Duet asks before submitting anything.", { kind: browser.browserKind() }),
        steps: ["Wake up my computer", "Open the site", "Do the work", "Wait for your OK to submit"].map((x) => tr(x)),
        agent: true,
      });
      const lastUser = [...state().messages].reverse().find((m) => m.channelId === ctx.channelId && !m.taskId && m.role === "user");
      if (lastUser && !lastUser.spawnedTaskId) patch<Message>("messages", lastUser.id, { spawnedTaskId: task.id });
      ctx.spawnTask(task.id);
      return `Browser task ${task.id} started. Tell the person in one short line that you're on it in your own browser and will check before submitting.`;
    },
  },

  // ── real apps (Composio) ─────────────────────────────────────────────
  {
    name: "app_find_actions",
    description: "Find actions in the person's real connected apps (Gmail, Calendar, Drive, Slack, GitHub…) for a use case. Returns tool slugs with their argument schemas. Call before app_run_action.",
    input_schema: obj({ use_case: S("What you want to do, e.g. 'list unread emails from today' or 'create a calendar event'."), apps: { type: "array", items: { type: "string" }, description: "Connector ids to search, e.g. gmail, gcal. Defaults to every real connected app." } }, ["use_case"]),
    status: "Looking something up",
    when: () => composioReady() && realApps().length > 0,
    run: async ({ use_case, apps }) => {
      const real = realApps();
      const ids = Array.isArray(apps) && apps.length ? apps.map((a) => str(a)).filter((a) => real.includes(a)) : real;
      return JSON.stringify(await searchActions(str(use_case), ids.length ? ids : real));
    },
  },
  {
    name: "app_run_action",
    description: "Run an action in a real connected app. Reads run right away. Anything that sends, creates, changes or deletes shows the person an approval card first and runs only when they approve; you'll hear the outcome.",
    input_schema: obj({
      tool_slug: S("Slug from app_find_actions, e.g. GMAIL_FETCH_EMAILS."),
      arguments: { type: "object", description: "Arguments matching the tool's input schema." },
      summary: S("For write actions: one line the person reads on the approval card, e.g. 'Create event: Design crit, Fri 4:30 PM'."),
    }, ["tool_slug", "arguments"]),
    status: "Working on it",
    when: () => composioReady() && realApps().length > 0,
    run: async ({ tool_slug, arguments: rawArgs, summary }, ctx) => {
      const slug = str(tool_slug).toUpperCase();
      const args = (rawArgs && typeof rawArgs === "object" ? rawArgs : {}) as Record<string, unknown>;
      const blocked = checkToolCall(slug, args, Object.values(TOOLKITS));
      if (blocked) return blocked;
      if (slug === "GMAIL_SEND_EMAIL") return "Use draft_email for email so the person sees the draft card.";
      if (isReadAction(slug)) {
        const r = await runAction(slug, args);
        const text = JSON.stringify(r.ok ? r.data : { error: r.error ?? "failed" });
        return text.length > 12000 ? `${text.slice(0, 12000)}… (truncated)` : text;
      }
      await requestApproval(ctx.channelId, "action", {
        action: {
          tool: str(summary) || slug.replace(/_/g, " ").toLowerCase(),
          // The real action and every argument, so a misleading summary can't hide what runs.
          args: [
            { name: tr("Action"), value: slug },
            ...nestedSlugs(args).map((n) => ({ name: tr("Runs"), value: n })),
            ...Object.entries(args).slice(0, 20).map(([name, v]) => ({ name, value: (typeof v === "string" ? v : JSON.stringify(v)).slice(0, 2000) })),
          ],
          exec: { kind: "composio", slug, arguments: args },
        },
      }, { taskId: ctx.taskId });
      return "Approval card shown. It has NOT run yet; you'll hear the outcome after they decide. Don't claim it's done.";
    },
  },

  // ── direct apps: mailbox, Feishu, DingTalk, WeCom ────────────────────
  {
    name: "mailbox_list",
    description: "List or search the person's connected mailbox (QQ Mail, 163, Exmail…), newest first. Returns uid, from, subject, date and unread.",
    input_schema: obj({
      query: S("Words to match in subject, sender or body. Empty for the latest mail."),
      unread_only: { type: "boolean" },
      limit: { type: "number", description: "Up to 25, default 10." },
      folder: S("IMAP folder, default INBOX. Use mailbox_folders to see the others."),
    }),
    status: "Searching your email",
    app: "mailbox",
    when: () => direct.ready("mailbox"),
    run: (args) => directRead("mailbox", "list", args),
  },
  {
    name: "mailbox_read",
    description: "Read one message from the connected mailbox by uid, as plain text. Doesn't mark it read.",
    input_schema: obj({ uid: { type: "number" }, folder: S("Default INBOX.") }, ["uid"]),
    status: "Searching your email",
    app: "mailbox",
    when: () => direct.ready("mailbox"),
    run: (args) => directRead("mailbox", "read", args),
  },
  {
    name: "mailbox_folders",
    description: "List the connected mailbox's folders (Sent, Drafts, Junk…).",
    input_schema: obj({}),
    status: "Searching your email",
    app: "mailbox",
    when: () => direct.ready("mailbox"),
    run: () => directRead("mailbox", "folders", {}),
  },
  {
    name: "feishu_list_chats",
    description: "List the Feishu group chats Cloud Duet's Feishu bot is in, with their chat_id.",
    input_schema: obj({}),
    status: "Looking something up",
    app: "feishu",
    when: () => direct.ready("feishu") && !!direct.creds("feishu")?.appId,
    run: () => directRead("feishu", "chats", {}),
  },
  {
    name: "feishu_read_messages",
    description: "Read the latest messages in a Feishu chat, newest first.",
    input_schema: obj({ chat_id: S("From feishu_list_chats."), limit: { type: "number", description: "Up to 50, default 20." } }, ["chat_id"]),
    status: "Looking something up",
    app: "feishu",
    when: () => direct.ready("feishu") && !!direct.creds("feishu")?.appId,
    run: (args) => directRead("feishu", "messages", args),
  },
  {
    name: "feishu_send_message",
    description: "Send a Feishu message: to a chat by chat_id, to a colleague by work email, or (with neither) to the group bot's group. Shows an approval card first unless they've set it to Always.",
    input_schema: obj({ text: S("The message."), chat_id: S("Optional chat_id."), email: S("Optional colleague's Feishu email.") }, ["text"]),
    status: "Working on it",
    app: "feishu",
    when: () => direct.ready("feishu"),
    run: async (args, ctx) => {
      const where = str(args.chat_id) ? `chat ${str(args.chat_id)}` : str(args.email) || tr("Group bot");
      return directWrite(ctx, "feishu", "FEISHU_SEND_MESSAGE", "send", { text: str(args.text), chat_id: str(args.chat_id) || undefined, email: str(args.email) || undefined }, tr("Send Feishu message to {to}", { to: where }));
    },
  },
  {
    name: "dingtalk_send_message",
    description: "Post a text message to the person's DingTalk group through its bot. Shows an approval card first unless they've set it to Always.",
    input_schema: obj({ text: S("The message. If the bot uses a keyword for security, include it.") }, ["text"]),
    status: "Working on it",
    app: "dingtalk",
    when: () => direct.ready("dingtalk"),
    run: (args, ctx) => directWrite(ctx, "dingtalk", "DINGTALK_SEND_MESSAGE", "send", { text: str(args.text) }, tr("Post to the DingTalk group")),
  },
  {
    name: "wecom_send_message",
    description: "Post a text message to the person's WeCom group through its bot. Shows an approval card first unless they've set it to Always.",
    input_schema: obj({ text: S("The message.") }, ["text"]),
    status: "Working on it",
    app: "wecom",
    when: () => direct.ready("wecom"),
    run: (args, ctx) => directWrite(ctx, "wecom", "WECOM_SEND_MESSAGE", "send", { text: str(args.text) }, tr("Post to the WeCom group")),
  },

  // ── tasks ────────────────────────────────────────────────────────────
  {
    name: "start_task",
    description:
      "Start a background task for anything that takes more than a quick reply: research, a doc or deck, a batch of drafts, a dashboard. It runs in its own thread and you'll do the work there. After calling, tell the person in one short line.",
    input_schema: obj({
      title: S("Short title, sentence case, like 'Prep notes for design crit'."),
      instructions: S("Everything the task needs to know: the goal, who it's for, constraints."),
      steps: { type: "array", items: { type: "string" }, description: "3 to 5 short steps, the last usually waiting for their OK or review." },
    }, ["title", "instructions"]),
    status: "Starting a task",
    scope: "chat",
    run: ({ title, instructions, steps }, ctx) => {
      const task = createTask({
        channelId: ctx.channelId,
        title: str(title).slice(0, 80),
        prompt: str(instructions),
        description: str(instructions).slice(0, 280),
        steps: Array.isArray(steps) ? steps.map((s) => str(s)).filter(Boolean).slice(0, 6) : [],
        agent: true,
      });
      const lastUser = [...state().messages].reverse().find((m) => m.channelId === ctx.channelId && !m.taskId && m.role === "user");
      if (lastUser && !lastUser.spawnedTaskId) patch<Message>("messages", lastUser.id, { spawnedTaskId: task.id });
      ctx.spawnTask(task.id);
      return `Task ${task.id} started. It shows as a card under their message; link to it as [${task.title}](task:${task.id}) if useful.`;
    },
  },
  {
    name: "propose_task",
    description: "Offer one task you noticed they might want, as a card with Start and Not now. Use when you spot work they didn't ask for.",
    input_schema: obj({ title: S("Short title."), why: S("One line on why it's worth doing."), prompt: S("The instructions if they tap Start.") }, ["title", "why", "prompt"]),
    scope: "chat",
    run: async ({ title, why, prompt }, ctx) => {
      await proposeTask(ctx.channelId, { title: str(title), body: str(why), prompt: str(prompt) });
      return "Proposal card shown.";
    },
  },
  {
    name: "suggest_tasks",
    description: "Show 2 to 4 tappable task suggestions as a card, e.g. after a catch-up or a brief.",
    input_schema: obj({
      items: {
        type: "array",
        items: obj({
          title: S("Short title."), prompt: S("Instructions if tapped."),
          icon: { type: "string", enum: ["mail", "calendar", "doc", "chart", "dollar", "people", "globe", "slides"] },
        }, ["title", "prompt"]),
      },
    }, ["items"]),
    scope: "chat",
    run: async ({ items }, ctx) => {
      const list = (Array.isArray(items) ? items : []).slice(0, 4).map((i) => {
        const o = (i ?? {}) as Record<string, unknown>;
        return { title: str(o.title), prompt: str(o.prompt), icon: (str(o.icon) || "doc") as SuggestionItem["icon"] };
      }).filter((i) => i.title && i.prompt);
      if (!list.length) return "Error: no valid items.";
      await card(ctx.channelId, { kind: "suggestions", items: list });
      return "Suggestions card shown.";
    },
  },
  {
    name: "quick_replies",
    description: "Offer 2 to 4 short tappable replies under your message, when the next step is a simple choice.",
    input_schema: obj({ options: { type: "array", items: { type: "string" } } }, ["options"]),
    run: ({ options }, ctx) => {
      ctx.quickReplies = (Array.isArray(options) ? options : []).map((o) => str(o).slice(0, 40)).filter(Boolean).slice(0, 4);
      return "They'll appear under your last bubble.";
    },
  },

  // ── making things ────────────────────────────────────────────────────
  {
    name: "make_artifact",
    description:
      "Make a doc, deck, dashboard, web page or design the person can open, share and pin. For docs, write the full content in markdown; other types use the workspace's live data.",
    input_schema: obj({
      type: { type: "string", enum: ["docs", "slides", "dashboard", "webpage", "design"] },
      title: S("Title."),
      brief: S("What it's for, in one or two sentences."),
      content_markdown: S("For docs: the full document in markdown (## headings, lists, paragraphs). Don't repeat the title."),
    }, ["type", "title", "brief"]),
    status: "Working on it",
    run: async ({ type, title, brief, content_markdown }, ctx) => {
      const kind = (["docs", "slides", "dashboard", "webpage", "design"].includes(str(type)) ? str(type) : "docs") as ArtifactType;
      const md = str(content_markdown);
      const a = createArtifact({
        type: kind, title: str(title), prompt: str(brief), channelId: ctx.channelId, taskId: ctx.taskId,
        html: kind === "docs" && md ? renderDoc(str(title), md) : undefined,
      });
      if (ctx.taskId) taskResource(ctx.taskId, { title: a.title, type: RESOURCE_TYPE[kind], artifactId: a.id });
      await card(ctx.channelId, { kind: "artifact", artifactId: a.id }, { taskId: ctx.taskId });
      return `Made ${a.id}; its card is in the chat. Don't paste its contents.`;
    },
  },

  // ── inside a task ─────────────────────────────────────────────────────
  {
    name: "set_steps",
    description: "Set or replace the task's plan, shown as a checklist. Optionally give the task a better short title.",
    input_schema: obj({ steps: { type: "array", items: { type: "string" } }, title: S("Optional new title, sentence case, under 60 characters.") }, ["steps"]),
    scope: "task",
    run: ({ steps, title }, ctx) => {
      const list = (Array.isArray(steps) ? steps : []).map((s) => str(s)).filter(Boolean).slice(0, 6);
      if (!list.length) return "Error: no steps.";
      taskPatch(ctx.taskId!, {
        steps: list.map((text, i) => ({ text, state: i === 0 ? "current" : "pending" })),
        ...(str(title).trim() ? { title: str(title).trim().slice(0, 80) } : {}),
      });
      return "Plan set.";
    },
  },
  {
    name: "update_progress",
    description: "Log what you just did on the task. Set step_done to tick off the current step.",
    input_schema: obj({ update: S("One short line, e.g. 'Read Maya's thread'."), source: S("Where it came from: Gmail, Google Drive, Stripe, Web…"), step_done: { type: "boolean" } }, ["update"]),
    scope: "task",
    run: ({ update, source, step_done }, ctx) => {
      taskUpdate(ctx.taskId!, str(update), str(source) || "Cloud Duet");
      if (step_done) advanceStep(ctx.taskId!);
      return "Logged.";
    },
  },
  {
    name: "add_link",
    description: "Attach a link to the task's resources.",
    input_schema: obj({ title: S("Label."), url: S("https URL.") }, ["title", "url"]),
    scope: "task",
    run: ({ title, url }, ctx) => {
      if (!/^https?:\/\//.test(str(url))) return "Error: url must start with http(s)://";
      taskResource(ctx.taskId!, { title: str(title), type: "Link", href: str(url) });
      return "Attached.";
    },
  },
  {
    name: "browser_open",
    description: "Open a URL in your own browser. Posts a screenshot to the task and returns the page's controls (numbered refs) and text.",
    input_schema: obj({ url: S("https URL.") }, ["url"]),
    status: "Working in your browser",
    scope: "task",
    run: async ({ url }, ctx) => {
      const first = !browser.hasSession(ctx.taskId!);
      await browser.goto(ctx.taskId!, str(url));
      if (first) {
        const live = await browser.liveUrl(ctx.taskId!);
        if (live) taskResource(ctx.taskId!, { title: tr("Live view of Cloud Duet's browser"), type: "Link", href: live });
      }
      return view(ctx, true);
    },
  },
  {
    name: "browser_look",
    description: "Read the current page again: numbered controls and text. Set show to post a screenshot the person can see.",
    input_schema: obj({ show: { type: "boolean" } }),
    status: "Working in your browser",
    scope: "task",
    run: ({ show }, ctx) => view(ctx, !!show),
  },
  {
    name: "browser_click",
    description: "Click a control by its ref. Never use this for a final submit, purchase or send: use browser_submit so the person approves.",
    input_schema: obj({ ref: S("Ref number from the last look.") }, ["ref"]),
    status: "Working in your browser",
    scope: "task",
    run: async ({ ref }, ctx) => {
      if (await browser.submits(ctx.taskId!, str(ref), false)) {
        return "Not clicked: that control submits or finalizes something. Fill everything in, then call browser_submit with this ref so the person approves.";
      }
      await browser.click(ctx.taskId!, str(ref));
      return view(ctx, false);
    },
  },
  {
    name: "browser_type",
    description: "Type into a field (or pick an option in a select) by ref. Not for passwords: use browser_request_login.",
    input_schema: obj({ ref: S("Ref number."), text: S("What to type or the option to pick."), press_enter: { type: "boolean" } }, ["ref", "text"]),
    status: "Working in your browser",
    scope: "task",
    run: async ({ ref, text, press_enter }, ctx) => {
      if (sensitive(str(text))) return sensitive(str(text))!;
      const enter = !!press_enter && !(await browser.submits(ctx.taskId!, str(ref), true));
      await browser.type(ctx.taskId!, str(ref), str(text), enter);
      const note = press_enter && !enter ? "Typed, but Enter wasn't pressed because it would submit the form. Use browser_submit on the form's button so the person approves.\n\n" : "";
      return note + (await view(ctx, false));
    },
  },
  {
    name: "browser_scroll",
    description: "Scroll the page, or go back a page.",
    input_schema: obj({ action: { type: "string", enum: ["down", "up", "back"] } }, ["action"]),
    status: "Working in your browser",
    scope: "task",
    run: async ({ action }, ctx) => {
      if (action === "back") await browser.back(ctx.taskId!);
      else await browser.scroll(ctx.taskId!, action === "up" ? "up" : "down");
      return view(ctx, false);
    },
  },
  {
    name: "browser_request_login",
    description: "The site needs the person's login. Shows them a sign-in card; their password goes straight into the page and you never see it. Stop after calling this; you'll be resumed once they sign in.",
    input_schema: obj({
      site: S("Site name, e.g. 'Northside Design Summit'."),
      username_ref: S("Ref of the email/username field, if on this page."),
      password_ref: S("Ref of the password field."),
      submit_ref: S("Ref of the sign-in button, if any."),
    }, ["site", "password_ref"]),
    status: "Working in your browser",
    scope: "task",
    run: async ({ site, username_ref, password_ref, submit_ref }, ctx) => {
      const t = find<Task>("tasks", ctx.taskId!)!;
      const domain = await browser.currentHost(ctx.taskId!);
      await say(ctx.channelId, tr("To keep going on [{title}](task:{id}), sign in to {domain} here:", { title: t.title, id: t.id, domain }), { delay: 400 });
      const m = await card(ctx.channelId, { kind: "signin", site: str(site), domain, state: "pending", taskId: t.id });
      browser.expectLogin(m.id, { taskId: t.id, user: str(username_ref) || undefined, pass: str(password_ref), submit: str(submit_ref) || undefined });
      taskPatch(t.id, { status: "needs_input", latest: tr("Needs your login") });
      return "Sign-in card shown in the main chat. Stop now and wait.";
    },
  },
  {
    name: "browser_submit",
    description: "Ask to click a final button that submits, buys, books or sends. Shows an approval card with what will be submitted; it's clicked only if they approve.",
    input_schema: obj({
      ref: S("Ref of the button."),
      what: S("One line, e.g. 'Submit team registration on northsidesummit.com'."),
      details: { type: "array", items: obj({ name: S("Field"), value: S("Value") }), description: "What's filled in, for the card." },
    }, ["ref", "what"]),
    status: "Working in your browser",
    scope: "task",
    run: async ({ ref, what, details }, ctx) => {
      const v = await browser.look(ctx.taskId!);
      await card(ctx.channelId, { kind: "screenshot", url: v.url, caption: tr("Ready to submit"), image: v.image }, { taskId: ctx.taskId });
      const args = (Array.isArray(details) ? details : []).slice(0, 10).map((d) => {
        const o = (d ?? {}) as Record<string, unknown>;
        return { name: str(o.name), value: str(o.value) };
      });
      await requestApproval(ctx.channelId, "action", { action: { tool: str(what), args, exec: { kind: "browser", ref: str(ref) } } }, { taskId: ctx.taskId });
      return "Approval card shown. Stop and wait; you'll hear whether they approved.";
    },
  },
  {
    name: "finish_task",
    description: "Mark the task ready for the person's review and tell them in the main chat. Call once, at the end. Don't call while an approval is pending.",
    input_schema: obj({ summary: S("One line for the task list, e.g. 'Doc ready' or '3 drafts waiting'.") }, ["summary"]),
    scope: "task",
    run: async ({ summary }, ctx) => {
      const t = find<Task>("tasks", ctx.taskId!);
      if (!t) return "Error: task not found.";
      const artifact = [...t.resources].reverse().find((r) => r.artifactId)?.artifactId;
      readyForReview(t.id, str(summary) || tr("Ready for review"));
      await say(t.channelId, tr("Your [{title}](task:{id}) is ready.", { title: t.title, id: t.id }), {
        card: artifact ? { kind: "artifact", artifactId: artifact } : undefined,
        delay: 400,
      });
      return "Marked ready for review and announced in chat.";
    },
  },
];

/** Slugs nested inside a multi-execute call, which would otherwise hide behind one name. */
function nestedSlugs(args: Record<string, unknown>): string[] {
  const list = Array.isArray(args.tools) ? args.tools : [];
  return list.map((t) => str((t as Record<string, unknown>)?.tool_slug ?? (t as Record<string, unknown>)?.slug)).filter(Boolean).slice(0, 10);
}

const sensitive = (text: string) => checkToolCall("browser_type", text);

async function directRead(app: DirectApp, op: string, args: Record<string, unknown>) {
  try {
    const text = JSON.stringify(await direct.run(app, op, args));
    return text.length > 12000 ? `${text.slice(0, 12000)}… (truncated)` : text;
  } catch (e) {
    return `Error: ${(e as Error).message}`;
  }
}

/** Sends right away when the person set this tool to Always, otherwise shows an approval card. */
async function directWrite(ctx: ToolContext, app: DirectApp, slug: string, op: string, args: Record<string, unknown>, what: string) {
  const blocked = sensitiveData(args);
  if (blocked) return blocked;
  if (!str(args.text).trim()) return "Error: the message is empty.";
  if (toolMode(app, slug) === "always") {
    try {
      await direct.run(app, op, args);
    } catch (e) {
      return `It didn't go through: ${(e as Error).message}`;
    }
    system(ctx.channelId, tr("Cloud Duet: {what}.", { what }), "note", ctx.taskId);
    return "Sent (the person allows this without asking).";
  }
  await requestApproval(ctx.channelId, "action", {
    action: {
      tool: what,
      args: Object.entries(args).filter(([, v]) => v !== undefined && v !== "").map(([name, v]) => ({ name: name === "text" ? tr("Message") : name, value: str(v).slice(0, 4000) })),
      exec: { kind: "direct", app, op, arguments: args },
    },
  }, { taskId: ctx.taskId });
  return "Approval card shown. It has NOT been sent; you'll hear the outcome after they decide.";
}

async function view(ctx: ToolContext, show: boolean) {
  const v = await browser.look(ctx.taskId!);
  if (show) await card(ctx.channelId, { kind: "screenshot", url: v.url, caption: v.title || v.url, image: v.image }, { taskId: ctx.taskId, delay: 200 });
  return JSON.stringify({ url: v.url, title: v.title, controls: v.controls, text: v.text });
}

export function toolsFor(mode: "chat" | "task") {
  const real = state().connectors.filter((c) => c.connected && c.real).map((c) => c.id);
  return TOOLS.filter((t) => (!t.scope || t.scope === mode) && (!t.when || t.when()) && !t.sample?.some((a) => real.includes(a)));
}

/** Why a tool can't run right now, as a message the model can relay. */
export function unavailable(tool: Tool): string | null {
  if (tool.app && !connected(tool.app)) {
    return `${appName(tool.app)} isn't connected. Tell the person they can connect it from the Cloud Duet sheet (tap Cloud Duet at the top of the chat), then try again.`;
  }
  return null;
}
