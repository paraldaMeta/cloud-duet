// A scripted Cloud Duet that runs on the sample workspace, so every screen,
// card and animation can be tried without a model key. The flows mirror what
// the real app does; the content is fictional. Inspired by Covo's demo engine
// (MIT, Ethos) and OpenDuet's mock model (MIT, Studio1HQ).
import type { Approval, ArtifactType, Message, PlateItem, Task } from "@/lib/shared/types";
import { locale } from "@/lib/i18n";
import { SAMPLE } from "../fixtures";
import { tr, userLang } from "../i18n";
import { find, nowIso, patch, state } from "../store";
import {
  addUpNext, advanceStep, card, createArtifact, createTask, pendingEmail, proposeTask, readyForReview,
  remember, requestApproval, say, sayAll, sleep, status, system, taskPatch, taskResource, taskUpdate,
} from "./actions";
import { artifactTypeFor, titleFor } from "./artifacts";
import { SITE, browserHelp, browserTask, confirmation, isBrowserRequest, newScreenshotMessage } from "./computer";

const first = () => state().user.firstName || tr("there");

// ── first day ───────────────────────────────────────────────────────────

export async function firstDayScan() {
  const ch = "main";
  await sayAll(ch, [
    tr("Hi {name}, welcome! Today's our first day working together. I'm going to help you stay on top of your work and life. Every day I'll get to know you a little better. Over time, I'll start spotting what you need before you even ask.", { name: first() }),
    tr("I'm going to check your apps to determine who you are and how I can help. Be right back!"),
  ]);
  const connected = state().connectors.filter((c) => c.connected).map((c) => c.id);
  if (!connected.includes("gmail") && !connected.includes("gcal")) {
    await say(ch, tr("I don't see Gmail or Google Calendar connected yet. Connect them and I'll take a first look at what's on your plate."), {
      card: { kind: "alert", title: tr("Connect your apps"), body: tr("Gmail and Calendar are where I'll start."), action: tr("Connect Gmail") },
    });
    return;
  }
  for (const s of ["Checking memory", "Searching your email", "Checking your calendar", "Checking recent files", "Thinking it through"] as const) {
    status(ch, s);
    await sleep(1400);
  }
  status(ch, null);
  await sayAll(ch, [
    tr("You run a small product studio juggling a lot at once: two client launches, your own apps and a newsletter about to go out. Your calendar shows you plan in hard deadlines and reshuffle on purpose."),
    tr("**How I'll help:**\n\n- Keep this week's three deadlines in view and flag a slip early\n- Take drafting and prep off your plate so build days stay for building\n- Park new ideas somewhere you can find them without derailing a launch"),
  ]);
  await say(ch, tr("If any of these sound off, just let me know and I'll learn."), { quickReplies: [tr("Sounds right"), tr("Something's off")] });
  remember(tr("{name} runs {company}, a small product studio.", { name: state().user.name, company: SAMPLE.company }));
  remember(tr("Prefers hard deadlines; build days should stay free of admin."));
  await sleep(1200);
  await say(ch, tr("Here's what looks like it's on your plate:"));
  await card(ch, { kind: "plate", items: plateItems() }, { text: "" });
  await say(ch, tr("A few places I can start"));
  await card(ch, {
    kind: "suggestions",
    items: [
      { title: tr("Reply to Maya about the deck"), prompt: tr("Draft a reply to Maya Chen saying I'll send the updated Series A deck Thursday"), icon: "mail" },
      { title: tr("Prep for launch review"), prompt: tr("Pull together a brief for the Mercury Labs launch review at 2 PM"), icon: "doc" },
      { title: tr("Chase overdue invoices"), prompt: tr("Check Stripe for unpaid invoices and draft reminder emails for me to approve"), icon: "dollar" },
    ],
  });
  addUpNext({ title: tr("Reply to Lena about the Q1 renewal"), body: tr("Lena asked for a read on what shipped this quarter before renewing."), source: "Gmail", prompt: tr("Draft a reply to Lena Brooks with a summary of what shipped this quarter"), channelId: ch });
  addUpNext({ title: tr("Review 12 new applicants"), body: tr("LinkedIn has 12 new applicants for Product Designer."), source: "LinkedIn", prompt: tr("Review the new Product Designer applicants and shortlist the top 3"), channelId: ch });
  await sleep(1500);
  await proposeTask(ch, {
    title: tr("Build a cash dashboard"),
    body: tr("You have $8,350 overdue across three clients. I can build a live dashboard of revenue and invoices that refreshes every morning."),
    prompt: tr("Build a dashboard of revenue and overdue invoices that refreshes daily"),
  });
}

function plateItems(): PlateItem[] {
  return [
    { title: tr("Launch review — 2:00 PM"), detail: tr("Diana wants the final QA list"), action: "Start", prompt: tr("Pull together the final QA list for the Mercury Labs launch review") },
    { title: tr("Maya is waiting on the deck"), detail: tr("3 days without a reply"), action: "Draft", prompt: tr("Draft a reply to Maya Chen about the Series A deck") },
    { title: tr("Design crit — 4:30 PM"), detail: tr("With Sam Patel"), action: "Book", prompt: tr("Book a 30 minute prep slot before the design crit") },
  ];
}

// ── routines ────────────────────────────────────────────────────────────

export async function morningBrief(channelId = "main") {
  status(channelId, "Searching your email");
  await sleep(1200);
  status(channelId, "Checking your calendar");
  await sleep(1000);
  status(channelId, null);
  const d = new Date().toLocaleDateString(locale(userLang()), { weekday: "long", month: "long", day: "numeric" });
  system(channelId, tr("Morning brief · {date}", { date: d }));
  await sayAll(channelId, [
    tr("Morning, {name}! For today: Launch review. Maya's deck. Overdue invoices.", { name: first() }),
    tr("**Updates:**\n\n1. **Launch review moved to 2 PM.** Diana wants the final QA list; 4 of 27 items are still open.\n2. **Maya is waiting on the deck.** It's been 3 days. I drafted a reply for you to review.\n3. **$8,350 is overdue.** Kestrel Coffee is 12 days late on #2041."),
  ]);
  await requestApproval(channelId, "email", {
    email: {
      app: "gmail", to: "maya@harborvc.example", subject: `Re: ${tr("Series A deck — Friday?")}`,
      body: tr("Hi Maya,\n\nThanks for the patience. I'll send the updated deck Thursday so you have time for notes before Friday's partner meeting.\n\nBest,\n{sender}", { sender: first() }),
    },
  });
}

export async function checkIn(): Promise<boolean> {
  // Most check-ins are quiet. Every third one finds something that needs you.
  const runs = find<{ id: string; runs: unknown[] }>("routines", "checkin")?.runs.length ?? 0;
  if (runs % 3 !== 1) return false;
  await card("main", {
    kind: "alert",
    title: tr("One thing needs you"),
    body: tr("Diana asked in #mercury-launch whether the QA list is final. The review starts in 40 minutes."),
    action: tr("Open Slack"),
    href: "https://app.slack.com/client",
  }, { delay: 900 });
  return true;
}

// ── intents ─────────────────────────────────────────────────────────────

const has = (t: string, re: RegExp) => re.test(t.toLowerCase());
const cjk = (t: string) => /[\u3400-\u9fff]/.test(t);
/** A short Chinese reply that is only the given words, give or take punctuation. */
const only = (t: string, words: string) => new RegExp(`^(${words})[\\s,.!?，。！？~～]*$`).test(t);

/** Handles one message in a channel's thread. */
export async function respond(channelId: string, text: string) {
  const t = text.trim();
  const low = t.toLowerCase();

  if (channelId !== "main" && (/^(yes|sure|yes please)\b/.test(low) || only(t, "好|好的|好啊|可以|行|是的|要|嗯|请吧|好呀"))) return channelSuggestions(channelId);

  // Quick replies and small talk.
  const thanks = low.startsWith("thank") || /^(谢谢|多谢|感谢)/.test(t);
  if (/^(sounds right|yes|yep|great|perfect|thanks|thank you|ok|okay|cool)\b/.test(low) || only(t, "听起来没错|没错|对|对的|是的|好|好的|太好了|完美|谢谢|多谢|谢谢你|感谢|行|可以|嗯|酷")) {
    return say(channelId, thanks ? tr("Anytime.") : tr("Great. I'll keep an eye on things and let you know when something needs you."));
  }
  if (/^something'?s off/.test(low) || /^(有点不对|不太对|不对)/.test(t)) {
    return say(channelId, tr("Thanks for flagging. What did I get wrong? Tell me in your own words and I'll fix my notes."));
  }
  if (/^(hi|hey|hello|morning|good morning)\b/.test(low) || /^(你好|您好|嗨|哈喽|早上好|早安|早)/.test(t)) {
    return say(channelId, tr("Hey {name}! Want a quick look at what's on your plate today?", { name: first() }), { quickReplies: [tr("What's on my plate?"), tr("Not now")] });
  }
  if (/^not now$/.test(low) || only(t, "暂时不用|现在不用|不用了|不用|先不用|稍后再说")) return say(channelId, tr("No problem."));

  // Edit a pending email draft by chat.
  const draft = pendingEmail(channelId);
  if (draft && /(shorten|shorter|add a line|add that|mention|more formal|less formal|warmer|change|rewrite|say|缩短|短一点|精简|简短|加一句|补充|提到|提一下|正式|随意|热情|温暖|改|重写|说)/.test(low)) {
    return editDraft(channelId, draft, t);
  }

  if (has(t, /feedback|bug|report (an )?issue|this is broken|反馈|报告问题|坏了|出错了/)) {
    system(channelId, tr("Thanks for the feedback"));
    return say(channelId, tr("Passed that along to the team. Thanks for telling me."));
  }
  if (has(t, /remind me|提醒我/)) return setReminder(channelId, t);
  if (has(t, /^remember|don't forget|keep in mind|^请?记住|别忘了|记得/)) {
    status(channelId, "Checking memory");
    await sleep(700);
    status(channelId, null);
    remember(t.replace(/^(please\s+)?(remember|keep in mind)( that)?\s*/i, "").replace(/^请?(记住|记得|别忘了)[，,：:\s]*/, ""));
    return say(channelId, tr("Got it. I'll remember that."));
  }
  if (has(t, /plate|today|what('?s| is) (up|next|going on)|catch me up|what needs me|今天|待办|有什么事|接下来|需要我处理|跟进一下|最近怎么样/)) {
    status(channelId, "Checking your calendar");
    await sleep(1100);
    status(channelId, null);
    await say(channelId, tr("Here's your plate today:"));
    return card(channelId, { kind: "plate", items: plateItems() });
  }
  if (has(t, /take over|control (your|the) browser|use your (browser|computer)|your own (browser|computer)|接管|控制你的浏览器|用你的(浏览器|电脑)|你自己的(浏览器|电脑)/)) return sayAll(channelId, browserHelp());
  if (has(t, /screenshot|截图|截屏/)) {
    await say(channelId, tr("Here's what my browser shows right now:"));
    return newScreenshotMessage(channelId);
  }
  if (isBrowserRequest(t)) return browserTask(channelId, t);
  if (has(t, /clear|clean ?up|declutter|delete|trash|archive|清理|清空|整理|删除|删掉|归档/) && has(t, /inbox|email|mail|newsletter|收件箱|邮件|邮箱|订阅/)) return clearInbox(channelId);
  if (has(t, /\bpay\b|buy|order|purchase|book a (flight|hotel)|tickets?|付款|支付|购买|买|下单|订(机票|酒店)|门票/)) return payment(channelId, t);
  if (has(t, /\bsign|contract|agreement|nda|docusign|签署|签字|签名|合同|协议/)) return signature(channelId, t);
  if (has(t, /schedule|book|set up a (call|meeting)|find (a )?time|meeting with|安排|预约|约(个|一个)?(时间|会|电话)|找(个)?时间|开个?会/)) return schedule(channelId, t);
  if (has(t, /invoice|unpaid|overdue|stripe|发票|未付|逾期|催款|催收/)) return delegate(channelId, t, "invoices");
  if (has(t, /(reply|respond|write|email|send|draft|message) .*(to|maya|diana|lena|sam)|\bemail\b|(回复|回信|答复|起草|草拟|写|发).*(maya|diana|lena|sam)|(maya|diana|lena|sam).*(回复|回信|起草|草拟|邮件)|邮件|写信/)) return draftEmail(channelId, t);
  if (has(t, /skill|my writing style|技能|写作风格/)) return proposeSkill(channelId);
  if (has(t, /search|look up|what('?s| is) new|news|latest|who is|find out|搜索|搜一下|查一下|查查|最新|新闻|是谁|了解一下/)) return webAnswer(channelId, t);

  const type = artifactTypeFor(t);
  if (type) return delegate(channelId, t, type);
  if (t.length > 60 || (cjk(t) && t.length > 20) || has(t, /^(can you|could you|please|help me|你能|能不能|可以帮|请|帮我)/)) return delegate(channelId, t, "docs");

  return say(channelId, tr("Got it. Anything you want me to take on? I can draft replies, prep meetings, chase invoices or build a doc, deck or dashboard."), {
    quickReplies: [tr("What's on my plate?"), tr("Chase overdue invoices"), tr("Build a dashboard")],
  });
}

async function channelSuggestions(channelId: string) {
  const ch = state().channels.find((c) => c.id === channelId);
  const topic = `${ch?.name ?? ""} ${ch?.purpose ?? ""}`.toLowerCase();
  status(channelId, "Thinking it through");
  await sleep(1200);
  status(channelId, null);
  const name = ch?.name;
  const items = /financ|money|invoice|cash|budget|财务|资金|钱|发票|现金|预算/.test(topic)
    ? [
        { title: tr("Chase overdue invoices"), prompt: tr("Check Stripe for unpaid invoices and draft reminder emails for me to approve"), icon: "dollar" as const },
        { title: tr("Build a cash dashboard"), prompt: tr("Build a dashboard of revenue and overdue invoices that refreshes daily"), icon: "chart" as const },
        { title: tr("Prep payroll for review"), prompt: tr("Pull together a payroll summary for this period for me to review"), icon: "doc" as const },
      ]
    : /hir|recruit|candidate|job|招聘|候选人|职位|岗位|面试/.test(topic)
      ? [
          { title: tr("Shortlist designer applicants"), prompt: tr("Review the new Product Designer applicants and write a brief on the top 3"), icon: "people" as const },
          { title: tr("Draft a job post"), prompt: tr("Draft a job post for a senior product designer"), icon: "doc" as const },
          { title: tr("Book first-round calls"), prompt: tr("Schedule first-round calls with the shortlisted candidates"), icon: "calendar" as const },
        ]
      : [
          { title: tr("Write a status brief"), prompt: tr("Write a brief on where {name} stands this week", { name: name ?? tr("this") }), icon: "doc" as const },
          { title: tr("Build a tracker"), prompt: tr("Build a dashboard to track {name}", { name: name ?? tr("this work") }), icon: "chart" as const },
          { title: tr("Find what needs a reply"), prompt: tr("Find threads about {name} that need a reply and draft responses", { name: name ?? tr("this") }), icon: "mail" as const },
        ];
  await say(channelId, tr("Here are a few things I can take on here:"));
  return card(channelId, { kind: "suggestions", items });
}

async function editDraft(channelId: string, draft: Approval, request: string) {
  status(channelId, "Writing a draft");
  await sleep(1100);
  status(channelId, null);
  const e = draft.email!;
  let body = e.body;
  let changed = "";
  const low = request.toLowerCase();
  if (/shorten|shorter|缩短|短一点|精简|简短/.test(low)) {
    changed = tr("Hi {name}, I'll send it Thursday. Thanks!", { name: e.to.split("@")[0].replace(/^\w/, (c) => c.toUpperCase()) });
    body = `${changed}\n\n${first()}`;
  } else {
    const m = request.match(/(?:saying|that says|about|mention(?:ing)?)\s+(.+)/i) ?? request.match(/(?:说|提到|提一下|加上|写上|补充)[，,：:\s]*(.+)/);
    const what = (m?.[1] ?? request).replace(/[.!。！]$/, "");
    const end = cjk(what) ? "。" : ".";
    changed = /excited|兴奋|期待/i.test(what) ? tr("I'm really excited about where this is heading.") : `${what.charAt(0).toUpperCase()}${what.slice(1)}${end}`;
    const parts = body.split("\n\n");
    parts.splice(Math.max(1, parts.length - 1), 0, changed);
    body = parts.join("\n\n");
  }
  patch<Approval>("approvals", draft.id, { email: { ...e, body }, highlight: { text: changed, at: nowIso() } });
  return say(channelId, tr("Updated the draft."));
}

async function draftEmail(channelId: string, text: string) {
  status(channelId, "Searching your email");
  await sleep(900);
  status(channelId, "Writing a draft");
  await sleep(1200);
  status(channelId, null);
  const low = text.toLowerCase();
  const inbox = SAMPLE.inbox;
  const person = inbox.find((m) => low.includes(m.from.split(" ")[0].toLowerCase())) ?? inbox[0];
  const addr = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
  const to = addr ?? person.email;
  const name = addr ? addr.split("@")[0] : person.from.split(" ")[0];
  const about = (text.match(/about (.+)/i) ?? text.match(/关于(.+)/))?.[1]?.replace(/[.!?。！？]$/, "");
  const subject = about ? about.charAt(0).toUpperCase() + about.slice(1) : `Re: ${person.subject}`;
  const body = about
    ? tr("Hi {name},\n\nQuick note about {about}. I wanted to follow up and make sure we're aligned on next steps. Let me know what works on your side.\n\nBest,\n{sender}", { name, about, sender: first() })
    : tr("Hi {name},\n\nThanks for the nudge. {line}\n\nBest,\n{sender}", {
        name,
        line: person.email.startsWith("maya@") ? tr("I'll send the updated deck Thursday so you have time for notes before Friday.") : tr("I'll have this to you before end of day."),
        sender: first(),
      });
  return requestApproval(channelId, "email", { email: { app: "gmail", to, subject, body } }, { lead: tr("Here's a draft to {name}. I'll send it when you're ready.", { name }) });
}

async function clearInbox(channelId: string) {
  status(channelId, "Searching your email");
  await sleep(1500);
  status(channelId, null);
  const items = SAMPLE.inbox.filter((m) => !m.needsReply && m.from !== "Stripe").map((m) => `${m.from} — ${m.subject}`);
  return requestApproval(channelId, "delete", { delete: { what: tr("Archive {n} emails you don't need to read", { n: items.length }), items } }, {
    lead: tr("I found {n} emails you don't need to read: newsletters and notifications. Nothing from a person. OK to archive them?", { n: items.length }),
  });
}

async function payment(channelId: string, text: string) {
  status(channelId, "Working in your browser");
  await sleep(2200);
  status(channelId, null);
  const isTicket = /ticket|conference|门票|大会|会议票/i.test(text);
  const expires = new Date(Date.now() + 14 * 60_000).toISOString();
  return requestApproval(channelId, "payment", {
    payment: {
      amount: isTicket ? 640 : 16.49, currency: "USD",
      merchant: isTicket ? "Config 2026 · Moscone Center" : "Blue Bottle Coffee",
      description: isTicket ? tr("2 conference passes, May 12 to 14") : tr("Whole bean · Hayes Valley Espresso, 12 oz"),
      item: isTicket ? tr("2 × General admission") : tr("1 × Hayes Valley Espresso"),
      wallet: "link", expiresAt: expires,
    },
  }, { lead: tr("Found it. Here's the order. Nothing is charged until you approve.") });
}

async function signature(channelId: string, text: string) {
  status(channelId, "Checking recent files");
  await sleep(1300);
  status(channelId, null);
  const who = /lena|northwind/i.test(text) ? "lena@northwind.example" : "diana@mercurylabs.example";
  return requestApproval(channelId, "sign", {
    sign: { document: who.startsWith("lena") ? tr("Northwind — Q1 renewal SOW.pdf") : tr("Mercury Labs — Launch support addendum.pdf"), recipients: [who], via: "Docusign" },
  }, { lead: tr("The agreement's ready. I filled in the dates and rates from the last SOW.") });
}

async function schedule(channelId: string, text: string) {
  status(channelId, "Checking your calendar");
  await sleep(1300);
  status(channelId, null);
  const who = (text.match(/with ([A-Z][a-z]+)/) ?? text.match(/(?:和|跟|与)\s*([A-Z][a-z]+)/))?.[1] ?? "Sam";
  return say(channelId, tr("You and {name} are both free at these times. Which works?", { name: who }), {
    quickReplies: [tr("Tue 1:45 to 2:30pm"), tr("Wed 10:00 to 10:45am"), tr("Thu 3:30 to 4:15pm")],
  });
}

export async function maybeConfirmSlot(channelId: string, text: string): Promise<boolean> {
  const m = text.match(/^(Mon|Tue|Wed|Thu|Fri|周[一二三四五]) ?(\d.+)$/);
  if (!m) return false;
  status(channelId, "Checking your calendar");
  await sleep(900);
  status(channelId, null);
  await card(channelId, {
    kind: "confirmation", icon: "calendar", title: tr("Meeting booked"),
    lines: [tr("{day}, {time}", { day: m[1], time: m[2] }), tr("Google Meet · invite sent to Sam Patel")],
  });
  return true;
}

async function setReminder(channelId: string, text: string) {
  const at = new Date();
  at.setDate(at.getDate() + (/tomorrow|明天/i.test(text) ? 1 : 0));
  const hm = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  const zh = text.match(/(上午|早上|中午|下午|晚上)?\s*(\d{1,2})\s*(?:[点:：]|时)\s*(半|\d{1,2})?\s*分?/);
  if (hm) {
    let h = Number(hm[1]) % 12;
    if (hm[3].toLowerCase() === "pm") h += 12;
    at.setHours(h, Number(hm[2] ?? 0), 0, 0);
  } else if (zh) {
    let h = Number(zh[2]);
    if (zh[1] && /中午|下午|晚上/.test(zh[1]) && h < 12) h = zh[1] === "中午" && h >= 11 ? h : h + 12;
    at.setHours(h % 24, zh[3] === "半" ? 30 : Number(zh[3] ?? 0), 0, 0);
  } else at.setHours(at.getHours() + 1, 0, 0, 0);
  const what = (/提醒我/.test(text)
    ? text.replace(/.*提醒我/, "").replace(/^\s*(明天|今天)?\s*((上午|早上|中午|下午|晚上)?\s*\d{1,2}\s*(?:[点:：]|时)\s*(半|\d{1,2})?\s*分?)?\s*/, "").replace(/[。！.!]+$/, "")
    : text.replace(/.*remind me (to )?/i, "").replace(/\b(tomorrow|today)\b.*$/i, "")
  ).trim() || tr("follow up");
  const { id: rid } = { id: Math.random().toString(36).slice(2, 10) };
  const s = state();
  s.reminders.push({ id: rid, at: at.toISOString(), text: what, channelId, fired: false });
  const loc = locale(userLang());
  system(channelId, tr("Cloud Duet set a reminder for {date} at {time}.", {
    date: at.toLocaleDateString(loc, { month: "short", day: "numeric" }),
    time: at.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" }),
  }));
  return say(channelId, tr("I'll remind you to {what}.", { what }));
}

async function proposeSkill(channelId: string) {
  return card(channelId, {
    kind: "skill", name: "/my-writing-style",
    description: tr("Short, warm emails. First names, no exclamation marks, sign off with just your name."),
    instructions: tr("Write emails that are short and warm. Use first names. Avoid exclamation marks. Sign off with just the first name."),
    state: "pending",
  }, { text: tr("Save this as a skill?") });
}

async function webAnswer(channelId: string, text: string) {
  status(channelId, "Searching the web");
  await sleep(1600);
  status(channelId, "Looking something up");
  await sleep(1000);
  status(channelId, null);
  const query = text.replace(/^(search|look up|find out)( for)?\s*/i, "").replace(/^(搜索|搜一下|查一下|查查|了解一下)[，,：:\s]*/, "").slice(0, 60);
  return sayAll(channelId, [
    tr("Here's the short version on “{query}”:", { query }),
    tr("1. **Smaller models keep closing the gap.** New mid-size releases are close to last year's largest on coding and tool use.\n2. **Agents moved to the phone.** Proactive assistants that brief you and ask before acting are the theme of the month.\n3. **Prices keep falling.** Running the same workload costs about a third of what it did in spring."),
    tr("_Demo mode: these answers come from sample content. Add an API key in Settings to search the live web._"),
  ]);
}

// ── delegated tasks ─────────────────────────────────────────────────────

function steps(kind: ArtifactType | "invoices"): string[] {
  const all: Record<ArtifactType | "invoices", string[]> = {
    invoices: ["Check Stripe for unpaid invoices", "Match each invoice to its contact", "Draft reminder emails", "Wait for your OK to send"],
    dashboard: ["Pull revenue and invoices", "Shape the numbers", "Build the dashboard", "Set a daily refresh"],
    docs: ["Read the relevant threads and files", "Pull out what matters", "Write the brief", "Check every figure against its source"],
    slides: ["Gather the numbers and story", "Outline the deck", "Build the slides", "Polish"],
    webpage: ["Work out what the page needs", "Write the copy", "Build the page", "Test the form"],
    design: ["Sketch the flow", "Lay out the screens", "Polish"],
    designsystem: ["Collect colours and type", "Define components", "Document it"],
  };
  return all[kind].map((s) => tr(s));
}

export async function delegate(channelId: string, text: string, kind: ArtifactType | "invoices", userMessageId?: string): Promise<Task> {
  status(channelId, "Starting a task");
  await sleep(700);
  const title = kind === "invoices" ? tr("Chase overdue invoices") : titleFor(kind, text);
  const task = createTask({
    channelId, title, prompt: text, steps: steps(kind),
    description: kind === "invoices"
      ? tr("Find unpaid invoices in Stripe, match them to the right contact and draft a reminder for each. Nothing is sent until you approve it.")
      : tr("Make {article} {thing} from your connected apps and bring it back for review.", { article: /^[aeiou]/i.test(title) ? "an" : "a", thing: title.toLowerCase(), title }),
  });
  const source = userMessageId ?? [...state().messages].reverse().find((m) => m.channelId === channelId && m.role === "user" && !m.taskId && m.text === text)?.id;
  if (source) patch<Message>("messages", source, { spawnedTaskId: task.id });
  status(channelId, null);
  await say(channelId, tr("On it"), { delay: 400 });
  void runTask(task.id, kind);
  return task;
}

async function runTask(taskId: string, kind: ArtifactType | "invoices") {
  const t = find<Task>("tasks", taskId);
  if (!t) return;
  const ch = t.channelId;
  status(ch, "Working on your tasks", taskId);
  await say(ch, tr("I'm on it. I'll post updates here as I go."), { taskId, delay: 600 });
  if (kind === "invoices") {
    await sleep(1800);
    taskUpdate(taskId, tr("Found 3 overdue invoices totalling $8,350"), "Stripe");
    advanceStep(taskId);
    await sleep(1500);
    taskUpdate(taskId, tr("Matched each invoice to a billing contact"), "Gmail");
    advanceStep(taskId);
    await sleep(1500);
    advanceStep(taskId);
    status(ch, null, taskId);
    const inv = SAMPLE.invoices[0];
    await requestApproval(ch, "email", {
      email: {
        app: "gmail", to: inv.email, subject: tr("Invoice #2041 — friendly reminder"),
        body: tr("Hi there,\n\nA quick reminder that invoice #2041 for ${amount} was due on Oct 18. You can pay it from the link in the original email. Let me know if anything's holding it up.\n\nThanks,\n{sender}", {
          amount: inv.amount.toLocaleString(locale(userLang())), sender: first(),
        }),
      },
    }, { taskId, lead: tr("Three invoices are overdue. Here's the first reminder, to Kestrel Coffee. The other two are drafted the same way.") });
    return;
  }
  for (let i = 0; i < (STEP_COUNT[kind] ?? 3) - 1; i++) {
    await sleep(1700 + Math.random() * 900);
    const src = ["Gmail", "Google Drive", "Stripe", "Google Calendar"][i % 4];
    taskUpdate(taskId, tr("{step} — done", { step: find<Task>("tasks", taskId)?.steps[i]?.text ?? tr("Working") }), src);
    advanceStep(taskId);
  }
  await sleep(1400);
  const art = createArtifact({ type: kind, title: t.title, prompt: t.prompt, channelId: ch, taskId });
  const label = { dashboard: "Dashboard", docs: "Doc", slides: "Slides", webpage: "Web page", design: "Design", designsystem: "Design" }[kind] as "Dashboard";
  const ready = { dashboard: tr("Dashboard ready"), docs: tr("Doc ready"), slides: tr("Slides ready"), webpage: tr("Web page ready"), design: tr("Design ready"), designsystem: tr("Design ready") }[kind];
  taskResource(taskId, { title: art.title, type: label, artifactId: art.id });
  status(ch, null, taskId);
  await say(ch, tr("Done. Take a look and tell me what to change."), { taskId, card: { kind: "artifact", artifactId: art.id } });
  readyForReview(taskId, ready);
  system(ch, kind === "webpage" ? tr("Cloud Duet made a page.") : kind === "slides" ? tr("Cloud Duet made a deck.") : kind === "dashboard" ? tr("Cloud Duet made a dashboard.") : tr("Cloud Duet made a doc."));
  await say(ch, tr("Your [{title}](task:{taskId}) is ready.", { title: t.title, taskId }), { card: { kind: "artifact", artifactId: art.id }, delay: 500 });
}

const STEP_COUNT: Record<ArtifactType, number> = { dashboard: 4, docs: 4, slides: 4, webpage: 4, design: 3, designsystem: 3 };

/** A task the user adds from the Tasks tab, or by starting a suggestion. */
export async function startTaskFromPrompt(channelId: string, prompt: string, source: "user" | "proactive" = "user"): Promise<Task> {
  const kind = /invoice|unpaid|overdue|发票|未付|逾期|催款|催收/i.test(prompt) ? "invoices" : (artifactTypeFor(prompt) ?? "docs");
  if (/^draft a reply|^reply/i.test(prompt) || /^(给.{1,30}?(起草|草拟|写).{0,30}回复|回复)/.test(prompt)) {
    const task = createTask({ channelId, title: titleFor("docs", prompt), prompt, source, steps: [tr("Read the thread"), tr("Draft the reply"), tr("Wait for your OK to send")], noticed: source === "proactive" });
    void (async () => {
      status(channelId, "Writing a draft", task.id);
      await sleep(1600);
      advanceStep(task.id);
      await sleep(1200);
      advanceStep(task.id);
      status(channelId, null, task.id);
      const inbox = SAMPLE.inbox;
      const p = inbox.find((m) => prompt.toLowerCase().includes(m.from.split(" ")[0].toLowerCase())) ?? inbox[0];
      await requestApproval(channelId, "email", {
        email: { app: "gmail", to: p.email, subject: `Re: ${p.subject}`, body: tr("Hi {name},\n\nThanks for your patience. I'll have this to you by Thursday.\n\nBest,\n{sender}", { name: p.from.split(" ")[0], sender: first() }) },
      }, { taskId: task.id, lead: tr("Here's the draft.") });
    })();
    return task;
  }
  if (source === "proactive") {
    const task = createTask({ channelId, title: titleFor(kind === "invoices" ? "docs" : kind, prompt), prompt, source, steps: steps(kind), noticed: true });
    void runTask(task.id, kind);
    return task;
  }
  return delegate(channelId, prompt, kind);
}

/** What happens after you approve or turn down a card. */
export async function afterApproval(a: Approval) {
  const ch = a.channelId;
  if (a.status === "declined") {
    if (a.taskId) taskPatch(a.taskId, { status: "working", latest: tr("Skipped one step") });
    await say(ch, tr("No problem, I won't send it. It's still here if you change your mind."), { delay: 600 });
    if (a.taskId) readyForReview(a.taskId, tr("Ready for review"));
    return;
  }
  const done: Record<string, string> = {
    email: tr("Sent to {to}.", { to: a.email?.to ?? "" }),
    payment: tr("Paid. Order confirmed with {merchant}. (Test mode: nothing was charged.)", { merchant: a.payment?.merchant ?? "" }),
    sign: tr("Sent for signature to {to} via Docusign.", { to: a.sign?.recipients.join(", ") ?? "" }),
    delete: tr("Done. Archived them. You can find them in All Mail if you need one."),
    action: a.action?.tool.includes(SITE.domain)
      ? tr("Submitted. You're registered for May 12 to 14, confirmation {code}. The receipt is on its way to {email}.", { code: confirmation(), email: state().user.email })
      : tr("Done."),
  };
  if (a.taskId) {
    status(ch, "Working on your tasks", a.taskId);
    taskUpdate(a.taskId, done[a.kind], a.kind === "email" ? "Gmail" : "Cloud Duet");
    await sleep(900);
    status(ch, null, a.taskId);
    await say(ch, done[a.kind], { taskId: a.taskId, delay: 500 });
    readyForReview(a.taskId, tr("Ready for review"));
  } else {
    await say(ch, done[a.kind], { delay: 600 });
  }
}

export async function scanForWork(channelId = "main") {
  status(channelId, "Searching your email");
  await sleep(1200);
  status(channelId, null);
  addUpNext({ title: tr("Send Northwind a Q4 shipped summary"), body: tr("Lena asked for it before they renew."), source: "Gmail", prompt: tr("Write a summary of what shipped for Northwind this quarter"), channelId });
  addUpNext({ title: tr("Chase Oak & Iron's invoice"), body: tr("$2,300, 21 days overdue."), source: "Stripe", prompt: tr("Draft a reminder to Oak & Iron about their overdue invoice"), channelId });
  addUpNext({ title: tr("Prep for design crit"), body: tr("Sam shared Onboarding v4 this morning."), source: "Figma", prompt: tr("Pull together notes for the design crit on Onboarding v4"), channelId });
}
