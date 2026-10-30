// Cloud Duet's own computer. In the demo it is a scripted browser session on a
// sample conference site: it wakes up, browses, asks for a login through a
// sign-in card, fills the form, and waits for your OK before submitting.
// Passwords passed to `typePassword` are dropped on the floor: they never
// reach the model, the store, or the logs.
import type { Card, Message, Task } from "@/lib/shared/types";
import { tr } from "../i18n";
import { find, id, notify, nowIso, patch, state, upsert } from "../store";
import {
  advanceStep, card, createTask, requestApproval, say, sleep, status, taskPatch, taskResource, taskUpdate,
} from "./actions";

export const SITE = { name: "Northside Design Summit", domain: "northsidesummit.com" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Screen = "home" | "login" | "form" | "filled";

/** A page from Cloud Duet's browser, drawn as SVG so it ships inside the message. */
export function screenshot(screen: Screen, values: { name?: string; team?: string; dates?: string; email?: string } = {}) {
  const W = 800;
  const H = 520;
  const field = (y: number, label: string, value = "", focus = false) => `
    <text x="250" y="${y}" font-size="13" fill="#6B6A66">${label}</text>
    <rect x="250" y="${y + 8}" width="300" height="38" rx="8" fill="#fff" stroke="${focus ? "#C6624B" : "#DADADA"}" stroke-width="${focus ? 2 : 1}"/>
    <text x="264" y="${y + 32}" font-size="15" fill="#141413">${esc(value)}</text>`;
  const nav = `
    <rect width="${W}" height="64" fill="#101828"/>
    <circle cx="44" cy="32" r="13" fill="#F59E0B"/>
    <text x="68" y="38" font-size="17" font-weight="700" fill="#fff">${SITE.name}</text>
    <text x="560" y="37" font-size="14" fill="#CBD5E1">${esc(tr("Program"))}</text>
    <text x="634" y="37" font-size="14" fill="#CBD5E1">${esc(tr("Speakers"))}</text>
    <rect x="708" y="18" width="72" height="28" rx="14" fill="#F59E0B"/>
    <text x="744" y="37" font-size="13" font-weight="700" fill="#101828" text-anchor="middle">${esc(tr("Register"))}</text>`;
  let body = "";
  if (screen === "home") {
    body = `
      <rect y="64" width="${W}" height="${H - 64}" fill="#FFF7ED"/>
      <text x="60" y="170" font-size="40" font-weight="800" fill="#101828">${esc(tr("Design at scale."))}</text>
      <text x="60" y="214" font-size="40" font-weight="800" fill="#101828">${esc(tr("May 12 to 14, Chicago."))}</text>
      <text x="60" y="256" font-size="17" fill="#475467">${esc(tr("Three days of talks and workshops for product teams."))}</text>
      <rect x="60" y="290" width="180" height="50" rx="25" fill="#101828"/>
      <text x="150" y="321" font-size="16" font-weight="700" fill="#fff" text-anchor="middle">${esc(tr("Register a team"))}</text>
      <rect x="500" y="120" width="240" height="300" rx="24" fill="#FDBA74"/>
      <circle cx="620" cy="250" r="70" fill="#F97316"/>
      <rect x="560" y="340" width="120" height="16" rx="8" fill="#FB923C"/>`;
  } else if (screen === "login") {
    body = `
      <rect y="64" width="${W}" height="${H - 64}" fill="#F8FAFC"/>
      <rect x="220" y="110" width="360" height="330" rx="18" fill="#fff" stroke="#E4E7EC"/>
      <text x="250" y="160" font-size="22" font-weight="700" fill="#101828">${esc(tr("Sign in to register"))}</text>
      ${field(190, tr("Email"), values.email ?? "", !values.email)}
      ${field(260, tr("Password"), values.email ? "••••••••••" : "")}
      <rect x="250" y="345" width="300" height="44" rx="10" fill="#101828"/>
      <text x="400" y="373" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">${esc(tr("Sign in"))}</text>`;
  } else {
    const filled = screen === "filled";
    body = `
      <rect y="64" width="${W}" height="${H - 64}" fill="#F8FAFC"/>
      <rect x="220" y="86" width="360" height="410" rx="18" fill="#fff" stroke="#E4E7EC"/>
      <text x="250" y="128" font-size="22" font-weight="700" fill="#101828">${esc(tr("Team registration"))}</text>
      ${field(160, tr("Name"), filled ? values.name : "", !filled)}
      ${field(232, tr("Team"), filled ? values.team : "")}
      ${field(304, tr("Dates"), filled ? values.dates : "")}
      <rect x="250" y="390" width="18" height="18" rx="4" fill="${filled ? "#101828" : "#fff"}" stroke="#98A2B3"/>
      ${filled ? '<path d="M254 399 l4 4 l7 -8" stroke="#fff" stroke-width="2" fill="none"/>' : ""}
      <text x="278" y="404" font-size="13" fill="#475467">${esc(tr("Email me the schedule"))}</text>
      <rect x="250" y="428" width="300" height="44" rx="10" fill="${filled ? "#F59E0B" : "#FCD9A5"}"/>
      <text x="400" y="456" font-size="15" font-weight="700" fill="#101828" text-anchor="middle">${esc(tr("Submit registration"))}</text>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Inter, Helvetica, Arial, sans-serif">${nav}${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function isBrowserRequest(text: string) {
  return /sign (me|my team|us|them) up|register (me|us|my team|for)|fill (out|in)|on (the|their) (web|site|website)|in your browser|go to (the )?(site|website)|conference|rsvp|web ?form|book (us|me) (in|on) the site/i.test(text)
    || /报名|填写?表|在(他们的|那个)?(网站|网页)上|用你的浏览器|去(那个)?网站|大会|峰会|网页表单/.test(text);
}

function shot(screen: Screen, caption: string, values?: Parameters<typeof screenshot>[1]): Card {
  return { kind: "screenshot", url: `https://${SITE.domain}/${screen === "home" ? "" : screen === "login" ? "login" : "register/team"}`, caption, image: screenshot(screen, values) };
}

/** "Sign my team up for the conference" and friends. */
export async function browserTask(channelId: string, text: string, userMessageId?: string): Promise<Task> {
  status(channelId, "Starting a task");
  await sleep(700);
  const task = createTask({
    channelId,
    title: tr("Register the team for {site}", { site: SITE.name }),
    prompt: text,
    description: tr("Sign the product design team up on the summit's site using Cloud Duet's own browser. Cloud Duet asks before submitting anything."),
    steps: [tr("Wake up my computer"), tr("Open the summit's site"), tr("Sign in"), tr("Fill out the team form"), tr("Wait for your OK to submit")],
  });
  const source = userMessageId ?? [...state().messages].reverse().find((m) => m.channelId === channelId && m.role === "user" && !m.taskId && m.text === text)?.id;
  if (source) patch<Message>("messages", source, { spawnedTaskId: task.id });
  status(channelId, null);
  await say(channelId, tr("On it. I'll do this in my own browser and check with you before I submit."), { delay: 500 });
  void run(task.id);
  return task;
}

async function run(taskId: string) {
  const t = find<Task>("tasks", taskId);
  if (!t) return;
  const ch = t.channelId;
  status(ch, "Waking Cloud Duet's workspace", taskId);
  await sleep(2200);
  advanceStep(taskId);
  taskUpdate(taskId, tr("Computer is up"), tr("Cloud Duet's computer"));
  status(ch, "Working in your browser", taskId);
  await sleep(1600);
  advanceStep(taskId);
  await card(ch, shot("home", tr("Opened {domain}", { domain: SITE.domain })), { taskId, text: tr("I'm on {domain}. Team registration is open for May 12 to 14.", { domain: SITE.domain }) });
  taskResource(taskId, { title: SITE.name, type: "Link", href: `https://${SITE.domain}` });
  await sleep(1400);
  status(ch, "Working in your browser", taskId);
  await card(ch, shot("login", tr("Sign-in page")), { taskId, text: tr("Registering a team needs an account on their site.") });
  status(ch, null, taskId);
  await say(ch, tr("Waiting for your login. I sent a sign-in card to the chat."), { taskId, delay: 400 });
  taskPatch(taskId, { status: "needs_input", latest: tr("Needs your login") });
  await say(ch, tr("To finish the [team registration](task:{taskId}), sign in to {domain} here:", { taskId, domain: SITE.domain }), { delay: 500 });
  await card(ch, { kind: "signin", site: SITE.name, domain: SITE.domain, state: "pending", taskId });
  notify({ title: "Cloud Duet", body: tr("Sign in to {domain} so I can finish the registration.", { domain: SITE.domain }), channelId: ch });
}

/** The sign-in card's "Send to Cloud Duet's browser". The password is typed into the page and discarded. */
export async function typePassword(messageId: string, email: string, password: string) {
  const m = find<Message>("messages", messageId);
  if (!m?.card || m.card.kind !== "signin" || m.card.state !== "pending") return false;
  void password.length;
  patch<Message>("messages", messageId, { card: { ...m.card, state: "sent", email } });
  const taskId = m.card.taskId ?? m.taskId;
  const ch = m.channelId;
  if (!taskId) return true;
  void (async () => {
    taskPatch(taskId, { status: "working", latest: tr("Signing in") });
    status(ch, "Working in your browser", taskId);
    await sleep(1500);
    advanceStep(taskId);
    taskUpdate(taskId, tr("Signed in as {email}", { email }), SITE.domain);
    await card(ch, shot("login", tr("Signed in"), { email }), { taskId, text: tr("Signed in.") });
    status(ch, "Working in your browser", taskId);
    await sleep(2200);
    advanceStep(taskId);
    const values = { name: state().user.name || "Alex Kim", team: tr("Product design"), dates: tr("May 12 to 14") };
    taskUpdate(taskId, tr("Filled in the team form"), SITE.domain);
    await card(ch, shot("filled", tr("Form filled in"), values), { taskId, text: tr("The form's filled in.") });
    status(ch, null, taskId);
    await card(ch, shot("filled", tr("Form filled in"), values), { text: tr("The form's filled in. Take a look before I send it.") });
    await requestApproval(ch, "action", {
      action: {
        tool: tr("Submit registration on {domain}", { domain: SITE.domain }),
        args: [
          { name: tr("Name"), value: values.name },
          { name: tr("Team"), value: values.team },
          { name: tr("Dates"), value: values.dates },
        ],
      },
    }, { taskId });
  })();
  return true;
}

export function confirmation() {
  return `NDS-${Math.floor(4000 + Math.random() * 5000)}`;
}

export function browserHelp() {
  return [
    tr("I work in my own browser on my own computer, so you can't take it over. I'm not signed in to your accounts there."),
    tr("If a site needs your login, I'll send you a sign-in card. Your password goes straight into my browser. I never see it, and it isn't saved. If you want to see what's on a page, I can send you screenshots as I go."),
  ];
}

export function newScreenshotMessage(channelId: string, taskId?: string): Message {
  return upsert<Message>("messages", {
    id: id(), channelId, taskId, role: "claude", text: "", card: shot("filled", tr("Current page"), { name: state().user.name, team: tr("Product design"), dates: tr("May 12 to 14") }),
    reactions: [], status: "sent", createdAt: nowIso(),
  });
}
