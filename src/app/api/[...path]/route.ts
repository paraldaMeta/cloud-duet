// Every action the app takes, in one small router, run as the signed-in account.
import type { Approval, Artifact, Card, Channel, Connector, Message, ProactiveSuggestion, Settings, Task, UpNextItem } from "@/lib/shared/types";
import { asAccount } from "@/lib/server/http";
import { mayUseEnvKeys, publicOrigin } from "@/lib/server/auth";
import { TOOLKITS, composioReady, connectUrl, disconnect, syncConnections } from "@/lib/server/composio";
import { services, setKeys } from "@/lib/server/keys";
import { form as directForm, isDirect, remove as removeDirect, save as saveDirect } from "@/lib/server/direct";
import { addSubscription, removeSubscription, sendPush, vapidPublicKey } from "@/lib/server/push";
import { currentUserId } from "@/lib/server/context";
import { fileMeta, isImage, isPdf, MAX_FILE_BYTES, readFile, saveFile } from "@/lib/server/files";
import { revokeShares, shareToken } from "@/lib/server/share";
import { isLang } from "@/lib/i18n";
import { publicUrl } from "@/lib/server/net";
import { tr } from "@/lib/server/i18n";
import { find, id, notify, nowIso, patch, remove, resetAll, set, state, upsert } from "@/lib/server/store";
import { ensureStarted, finishLogin, firstDayScan, resolveApproval, runRoutine, scanForWork, sendMessage, startSuggestion } from "@/lib/server/engine";
import { remember, say, system } from "@/lib/server/engine/actions";
import { startBuild } from "@/lib/server/engine/build";
import { typePassword } from "@/lib/server/engine/computer";
import { ping, publicConfig, syncEngine, writeConfig, type ProviderKind } from "@/lib/server/engine/provider";


type Ctx = { params: Promise<{ path: string[] }> };
type Body = Record<string, unknown>;

// The sandbox gives artifact pages an opaque origin, so their scripts can't read the app even when opened directly.
export const ARTIFACT_CSP = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'; sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox";
const MAX_BODY = 1_000_000;
const TASK_STATUSES = new Set(["working", "needs_input", "ready_for_review", "scheduled", "resolved"]);
const ARTIFACT_TYPES = new Set(["dashboard", "docs", "slides", "webpage", "design", "designsystem"]);
const PUSH_HOSTS = /(^|\.)(googleapis\.com|mozilla\.com|mozaws\.net|push\.apple\.com|notify\.windows\.com)$/;

const ok = (data: unknown = { ok: true }) => Response.json(data);
const bad = (msg: string, code = 400) => Response.json({ error: tr(msg) }, { status: code });

async function body(req: Request): Promise<Body> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return {};
  try {
    const d = (await req.json()) as unknown;
    return d && typeof d === "object" && !Array.isArray(d) ? (d as Body) : {};
  } catch {
    return {};
  }
}

function updateCard(messageId: string, fn: (c: Card) => Card) {
  const m = find<Message>("messages", messageId);
  if (m?.card) patch<Message>("messages", messageId, { card: fn(m.card) });
  return m;
}

async function get(req: Request, ctx: Ctx) {
  ensureStarted();
  const [a, b, c] = (await ctx.params).path;
  if (a === "state") {
    syncEngine();
    return ok(state());
  }
  if (a === "model") return ok(publicConfig());
  if (a === "services") return ok({ services: services() });
  if (a === "direct" && b && isDirect(b)) return ok(directForm(b));
  if (a === "push" && b === "key") return ok({ key: vapidPublicKey() });
  if (a === "connectors" && c === "callback") {
    await syncConnections().catch(() => []);
    return new Response(null, { status: 303, headers: { location: `${publicOrigin(req)}/?connected=${encodeURIComponent(b)}` } });
  }
  if (a === "artifacts" && c === "html") {
    const art = find<Artifact>("artifacts", b);
    if (!art) return bad("Not found", 404);
    return new Response(art.html, { headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": ARTIFACT_CSP } });
  }
  if (a === "files" && b) {
    const f = readFile(b);
    if (!f) return bad("Not found", 404);
    const inline = isImage(f.meta) || isPdf(f.meta);
    return new Response(new Uint8Array(f.data), {
      headers: {
        "content-type": inline ? f.meta.type : "application/octet-stream",
        "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.meta.name)}`,
        "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
        "x-content-type-options": "nosniff",
        "cache-control": "private, max-age=31536000, immutable",
      },
    });
  }
  return bad("Not found", 404);
}

async function put(req: Request, ctx: Ctx) {
  const [a, b] = (await ctx.params).path;
  const d = await body(req);
  if (a === "direct" && b && isDirect(b)) {
    try {
      return ok(await saveDirect(b, d));
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }
  }
  if (a === "model") {
    const next: Record<string, string> = {};
    if (d.provider === "anthropic" || d.provider === "openai") next.provider = d.provider as ProviderKind;
    if (typeof d.apiKey === "string" && d.apiKey.trim()) next.apiKey = d.apiKey.trim().slice(0, 500);
    if (typeof d.model === "string") next.model = d.model.trim().slice(0, 120);
    if (typeof d.baseURL === "string") {
      const raw = d.baseURL.trim();
      // The owner may point at a model on their own machine or network; everyone else needs a public address.
      if (raw && !(mayUseEnvKeys() ? /^https?:\/\//i.test(raw) : await publicUrl(raw))) return bad("Use a public http(s) address for the base URL.");
      next.baseURL = raw;
    }
    writeConfig(next);
    return ok(publicConfig());
  }
  if (a === "memory") {
    set("memory", String(d.memory ?? ""));
    return ok();
  }
  if (a === "keys") {
    const pick = (k: string) => (typeof d[k] === "string" ? String(d[k]) : undefined);
    setKeys({ composio: pick("composio"), browserbase: pick("browserbase"), browserbaseProject: pick("browserbaseProject"), bocha: pick("bocha"), tavily: pick("tavily") });
    if (pick("composio")) await syncConnections().catch(() => []);
    return ok({ services: services() });
  }
  return bad("Not found", 404);
}

async function del(req: Request, ctx: Ctx) {
  const [a, b] = (await ctx.params).path;
  if (a === "direct" && b && isDirect(b)) {
    removeDirect(b);
    return ok(directForm(b));
  }
  if (a === "model") {
    writeConfig({ apiKey: "" });
    return ok(publicConfig());
  }
  if (a === "session") {
    resetAll();
    return ok();
  }
  return bad("Not found", 404);
}

async function patchRoute(req: Request, ctx: Ctx) {
  const [a, b] = (await ctx.params).path;
  const d = await body(req);
  switch (a) {
    case "settings": {
      const next: Partial<Settings> = {};
      if (typeof d.briefTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(d.briefTime)) next.briefTime = d.briefTime;
      if (Number.isInteger(d.checkinMinute) && (d.checkinMinute as number) >= 0 && (d.checkinMinute as number) < 60) next.checkinMinute = d.checkinMinute as number;
      if (Array.isArray(d.checkinHours) && d.checkinHours.every((h) => Number.isInteger(h) && h >= 0 && h < 24)) next.checkinHours = (d.checkinHours as number[]).slice(0, 24);
      for (const k of ["weekendsOn", "notifications", "paymentsTestMode"] as const) if (typeof d[k] === "boolean") next[k] = d[k] as boolean;
      if (isLang(d.language)) next.language = d.language;
      set("settings", { ...state().settings, ...next });
      return ok();
    }
    case "channels": {
      const next: Partial<Channel> = {};
      if (typeof d.archived === "boolean" && b !== "main") next.archived = d.archived;
      if (typeof d.name === "string" && d.name.trim()) next.name = d.name.trim().slice(0, 60);
      if (typeof d.purpose === "string") next.purpose = d.purpose.slice(0, 500);
      if (typeof d.color === "string" && /^#[0-9a-f]{3,8}$/i.test(d.color)) next.color = d.color;
      if (typeof d.group === "string") next.group = d.group.slice(0, 40);
      return ok(patch<Channel>("channels", b, next));
    }
    case "messages": {
      const m = find<Message>("messages", b);
      if (!m) return bad("Not found", 404);
      const changes: Partial<Message> = {};
      if (d.reaction) {
        const r = d.reaction as Message["reactions"][number];
        changes.reactions = m.reactions.includes(r) ? m.reactions.filter((x) => x !== r) : [...m.reactions, r];
      }
      if (d.feedback) changes.feedback = d.feedback as "good" | "bad";
      if (typeof d.quickReply === "string") changes.quickReplies = m.quickReplies?.map((q) => ({ ...q, used: q.used || q.label === d.quickReply }));
      return ok(patch<Message>("messages", b, changes));
    }
    case "tasks": {
      const t = find<Task>("tasks", b);
      if (!t) return bad("Not found", 404);
      const next: Partial<Task> = { updatedAt: nowIso() };
      if (typeof d.status === "string" && TASK_STATUSES.has(d.status)) next.status = d.status as Task["status"];
      if (typeof d.archived === "boolean") next.archived = d.archived;
      return ok(patch<Task>("tasks", b, next));
    }
    case "artifacts": {
      const next: Partial<Artifact> = {};
      if (typeof d.inTabBar === "boolean") next.inTabBar = d.inTabBar;
      if (typeof d.pinned === "boolean") next.pinned = d.pinned;
      if (typeof d.title === "string" && d.title.trim()) next.title = d.title.trim().slice(0, 120);
      return ok(patch<Artifact>("artifacts", b, next));
    }
    case "approvals": {
      const ap = find<Approval>("approvals", b);
      if (!ap?.email || ap.status !== "pending") return bad("Can't edit");
      return ok(patch<Approval>("approvals", b, { email: { ...ap.email, body: String(d.body ?? ap.email.body) }, highlight: undefined }));
    }
    case "connectors": {
      const c = find<Connector>("connectors", b);
      if (!c) return bad("Not found", 404);
      const next = { ...c };
      if (typeof d.connected === "boolean" && isDirect(c.id)) {
        if (d.connected) return bad("Fill in the form to connect this app.");
        removeDirect(c.id);
        return ok(find<Connector>("connectors", c.id));
      }
      if (typeof d.connected === "boolean") {
        if (!d.connected && c.real) {
          await disconnect(c.id).catch(() => {});
          next.real = false;
        }
        next.connected = d.connected;
        next.accounts = d.connected ? [state().user.email || "you@example.com"] : [];
      }
      if (typeof d.tool === "string" && (d.mode === "ask" || d.mode === "always")) next.tools = c.tools.map((t) => (t.slug === d.tool ? { ...t, mode: d.mode as "ask" | "always" } : t));
      if (d.all) next.tools = c.tools.map((t) => ({ ...t, mode: d.all === "ask" ? "ask" : t.write ? "ask" : "always" }));
      return ok(upsert("connectors", next));
    }
  }
  return bad("Not found", 404);
}

async function upload(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_FILE_BYTES + 64 * 1024) return bad("That file is over 15 MB.", 413);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Send the file as form data");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return bad("No file");
  try {
    return ok(saveFile(file.name, file.type, Buffer.from(await file.arrayBuffer())));
  } catch (e) {
    return bad((e as Error).message, 413);
  }
}

async function post(req: Request, ctx: Ctx) {
  ensureStarted();
  const [a, b, c] = (await ctx.params).path;
  if (a === "files" && !b) return upload(req);
  const d = await body(req);
  const s = state();

  switch (a) {
    case "onboarding": {
      if (d.slack) patch<Connector>("connectors", "slack", { connected: true, accounts: [s.user.email] });
      set("settings", { ...s.settings, notifications: !!d.notifications });
      set("user", { ...s.user, onboarded: true });
      if (!s.user.scanned) {
        set("user", { ...state().user, scanned: true });
        firstDayScan();
      }
      return ok();
    }
    case "reset": {
      resetAll();
      syncEngine();
      return ok();
    }
    case "channels": {
      if (b && c === "messages") {
        const text = String(d.text || "").trim();
        const files = (Array.isArray(d.files) ? d.files : []).slice(0, 8).map((f) => fileMeta(String(f))).filter((f) => !!f);
        if (!text && !files.length) return bad("Empty message");
        return ok(await sendMessage(b, text, d.taskId ? String(d.taskId) : undefined, files));
      }
      if (b && c === "read") return ok(patch<Channel>("channels", b, { lastReadAt: nowIso() }));
      const ch: Channel = {
        id: id(), name: String(d.name || "new-channel").trim().toLowerCase().replace(/\s+/g, "-"),
        icon: (d.icon as Channel["icon"]) || "checkbox", color: String(d.color || "#C7604A"), purpose: String(d.purpose || ""),
        archived: false, createdAt: nowIso(), lastReadAt: nowIso(),
      };
      upsert("channels", ch);
      void say(ch.id, tr("Hello, here in channels we can focus on specific topics or work streams. Want me to suggest tasks I can do here?"), {
        quickReplies: [tr("Yes"), tr("No"), tr("Not now")], delay: 900,
      });
      return ok(ch);
    }
    case "approvals": {
      const ap = find<Approval>("approvals", b);
      if (!ap || ap.status !== "pending") return bad("Already decided");
      return ok(await resolveApproval(b, !!d.approve));
    }
    case "suggestions": {
      const sug = find<ProactiveSuggestion>("suggestions", b);
      if (!sug) return bad("Not found", 404);
      if (d.action === "hide") return ok(patch<ProactiveSuggestion>("suggestions", b, { state: "hidden" }));
      const task = await startSuggestion(sug.channelId, sug.prompt, "proactive");
      return ok(patch<ProactiveSuggestion>("suggestions", b, { state: "started", taskId: task.id }));
    }
    case "cards": {
      const messageId = String(d.messageId);
      const index = Number(d.index ?? 0);
      const m = find<Message>("messages", messageId);
      if (!m?.card) return bad("Not found", 404);
      if (b === "suggestion" && m.card.kind === "suggestions") {
        const item = m.card.items[index];
        const userMsg = await sendMessageQuiet(m.channelId, item.prompt);
        const task = await startSuggestion(m.channelId, item.prompt);
        patch<Message>("messages", userMsg.id, { spawnedTaskId: task.id });
        updateCard(messageId, (cd) => (cd.kind === "suggestions" ? { ...cd, items: cd.items.map((it, i) => (i === index ? { ...it, started: true, taskId: task.id } : it)) } : cd));
        return ok(task);
      }
      if (b === "plate" && m.card.kind === "plate") {
        const item = m.card.items[index];
        updateCard(messageId, (cd) => (cd.kind === "plate" ? { ...cd, items: cd.items.map((it, i) => (i === index ? { ...it, done: true } : it)) } : cd));
        return ok(await sendMessage(m.channelId, item.prompt));
      }
      if (b === "skill" && m.card.kind === "skill") {
        const sk = m.card;
        updateCard(messageId, (cd) => (cd.kind === "skill" ? { ...cd, state: d.save ? "saved" : "dismissed" } : cd));
        if (d.save) {
          upsert("skills", { name: sk.name, description: sk.description, instructions: sk.instructions });
          system(m.channelId, tr("Saved {name}", { name: sk.name }));
        }
        return ok();
      }
      if (b === "usage" && m.card.kind === "usage_limit") return ok();
      if (b === "signin" && m.card.kind === "signin") {
        if (d.dismiss) {
          updateCard(messageId, (cd) => (cd.kind === "signin" ? { ...cd, state: "dismissed" } : cd));
          return ok();
        }
        const email = String(d.email || "").trim();
        if (!email || !d.password) return bad("Email and password are required");
        if (await finishLogin(messageId, email, String(d.password))) return ok({ sent: true });
        return ok({ sent: await typePassword(messageId, email, String(d.password)) });
      }
      return bad("Unknown card");
    }
    case "tasks": {
      if (b === "scan") {
        scanForWork();
        return ok();
      }
      const prompt = String(d.prompt || "").trim();
      if (!prompt) return bad("Describe the task");
      return ok(await startSuggestion(String(d.channelId || "main"), prompt));
    }
    case "upnext": {
      const item = find<UpNextItem>("upNext", b);
      if (!item) return bad("Not found", 404);
      remove("upNext", b);
      return ok(await startSuggestion(item.channelId, item.prompt, "proactive"));
    }
    case "routines":
      void runRoutine(b as "brief" | "checkin");
      return ok();
    case "builds":
      return ok(startBuild(typeof d.type === "string" && ARTIFACT_TYPES.has(d.type) ? (d.type as Artifact["type"]) : "docs", String(d.prompt || "").slice(0, 4000)));
    case "artifacts": {
      const art = find<Artifact>("artifacts", b);
      if (!art) return bad("Not found", 404);
      if (c === "refresh") return ok(patch<Artifact>("artifacts", b, { updatedAt: nowIso() }));
      if (c === "edit") {
        await sendMessage(art.channelId, tr("Update “{title}”: {text}", { title: art.title, text: String(d.text || "") }));
        return ok();
      }
      if (c === "share") return ok({ url: `${publicOrigin(req)}/s/${shareToken(currentUserId(), art.id)}` });
      if (c === "unshare") {
        revokeShares(currentUserId(), art.id);
        return ok();
      }
      return bad("Not found", 404);
    }
    case "usage": {
      if (b === "reset" && s.usage.resetAvailable) {
        set("usage", { ...s.usage, sessionUsed: 0, weeklyUsed: 0, resetAvailable: false });
        return ok();
      }
      return bad("No reset available");
    }
    case "model":
      if (b === "test") return ok(await ping());
      return bad("Not found", 404);
    case "feedback":
      system(String(d.channelId || "main"), tr("Thanks for the feedback"));
      return ok();
    case "memory":
      remember(String(d.fact || ""));
      return ok();
    case "connectors": {
      if (c === "connect") {
        if (isDirect(b)) return bad("Fill in the form to connect this app.");
        if (composioReady() && TOOLKITS[b]) return ok({ url: await connectUrl(b, `${publicOrigin(req)}/api/connectors/${b}/callback`) });
        const conn = find<Connector>("connectors", b);
        if (!conn) return bad("Not found", 404);
        if (d.add) {
          const account = String(d.account ?? "").trim().toLowerCase();
          if (!account) return ok({ ask: true });
          if (!/^\S+@\S+\.\S+$/.test(account)) return bad("Enter an email address");
          if (conn.accounts.includes(account)) return bad("That account is already connected");
          upsert("connectors", { ...conn, connected: true, accounts: [...conn.accounts, account] });
          return ok({ sample: true });
        }
        upsert("connectors", { ...conn, connected: true, accounts: [s.user.email || "you@example.com"] });
        return ok({ sample: true });
      }
      if (b === "sync") return ok({ active: await syncConnections() });
      return bad("Not found", 404);
    }
    case "push": {
      if (b === "subscribe") {
        const sub = d.subscription as Parameters<typeof addSubscription>[0] | undefined;
        let host = "";
        try {
          const u = new URL(String(sub?.endpoint ?? ""));
          if (u.protocol === "https:") host = u.hostname;
        } catch {}
        if (!PUSH_HOSTS.test(host) || !sub?.keys?.p256dh || !sub.keys.auth) return bad("Not a push subscription");
        addSubscription(sub);
        set("settings", { ...s.settings, notifications: true });
        return ok();
      }
      if (b === "unsubscribe") {
        removeSubscription(String(d.endpoint || ""));
        return ok();
      }
      if (b === "test") {
        await sendPush(currentUserId(), { title: "Cloud Duet", body: tr("Notifications are on. I'll ping you here when something needs you.") });
        return ok();
      }
      return bad("Not found", 404);
    }
    case "notify-test":
      notify({ title: "Cloud Duet", body: tr("Your prep for Launch review is ready."), channelId: "main" });
      return ok();
  }
  return bad("Not found", 404);
}

async function sendMessageQuiet(channelId: string, text: string): Promise<Message> {
  return upsert<Message>("messages", { id: id(), channelId, role: "user", text, reactions: [], status: "delivered", createdAt: nowIso() });
}

export const GET = (req: Request, ctx: Ctx) => asAccount(req, () => get(req, ctx));
export const POST = (req: Request, ctx: Ctx) => asAccount(req, () => post(req, ctx));
export const PUT = (req: Request, ctx: Ctx) => asAccount(req, () => put(req, ctx));
export const PATCH = (req: Request, ctx: Ctx) => asAccount(req, () => patchRoute(req, ctx));
export const DELETE = (req: Request, ctx: Ctx) => asAccount(req, () => del(req, ctx));
