// Routes what the person does to the demo engine or the model, and runs the
// proactive schedule: the morning brief, check-ins and reminders.
import type { Approval, Attachment, Message, Routine, Task } from "@/lib/shared/types";
import { find, notify, nowIso, patch, state } from "../store";
import { nextBriefAt, nextCheckinAt } from "../fixtures";
import { createTask, markSeen, postUser, readyForReview, say, status, system, taskPatch, taskUpdate } from "./actions";
import { realApps, runAction, sendGmail } from "../composio";
import * as browser from "../browser";
import * as direct from "../direct";
import * as demo from "./demo";
import { isLive } from "./provider";
import { tr } from "../i18n";
import { accounts } from "../auth";
import { currentUserId, runAs } from "../context";
import { runAgent, runTask } from "../agent/loop";

const g = globalThis as unknown as { __duetTimer?: NodeJS.Timeout; __duetBusy?: Set<string> };
const busy: Set<string> = (g.__duetBusy ??= new Set());

const laneOf = (key: string) => `${currentUserId()}:${key}`;

async function guarded(key: string, fn: () => Promise<unknown>) {
  const lane = laneOf(key);
  busy.add(lane);
  try {
    await fn();
  } catch (e) {
    console.error("[duet]", key, e);
    try {
      status(key, null);
      await say(key === "main" || state().channels.some((c) => c.id === key) ? key : "main", tr("Something went wrong: {error}", { error: (e as Error).message }));
    } catch {}
  } finally {
    busy.delete(lane);
  }
}

function spawnTask(taskId: string, kickoff?: string) {
  void guarded(taskId, () => runTask(taskId, (id) => spawnTask(id), kickoff));
}

async function live(channelId: string, taskId?: string) {
  try {
    markSeen(channelId, taskId);
    await runAgent({ channelId, taskId, spawnTask: (id) => spawnTask(id) });
  } catch (e) {
    status(channelId, null, taskId);
    system(channelId, tr("Model error: {error}. Falling back to demo replies.", { error: (e as Error).message.slice(0, 160) }), "note", taskId);
    return false;
  }
  return true;
}

export async function sendMessage(channelId: string, text: string, taskId?: string, attachments?: Attachment[]): Promise<Message> {
  const msg = postUser(channelId, text, taskId, attachments);
  void guarded(taskId ?? channelId, async () => {
    if (taskId) {
      if (isLive() && (await live(channelId, taskId))) return;
      await say(channelId, attachments?.length ? tr("Got the file. I'll use it for this task.") : tr("Got it. I'll fold that in."), { taskId });
      return;
    }
    if (attachments?.length && !isLive()) {
      const names = attachments.map((a) => a.name).join(tr(", "));
      await say(channelId, text ? tr("Got {names}. Add a model key in Profile → Model & API key and I'll read it and take it from there.", { names }) : tr("Got {names}. What should I do with it? Once a model key is set I can read it for you.", { names }));
      return;
    }
    if (await demo.maybeConfirmSlot(channelId, text)) return;
    if (isLive() && (await live(channelId))) return;
    await demo.respond(channelId, text);
  });
  return msg;
}

export async function resolveApproval(approvalId: string, approve: boolean) {
  const a = patch<Approval>("approvals", approvalId, { status: approve ? "approved" : "declined", resolvedAt: nowIso() });
  if (!a) return a;
  const task = a.taskId ? find<Task>("tasks", a.taskId) : undefined;
  void guarded(a.taskId ?? a.channelId, async () => {
    const real = approve ? await carryOut(a) : undefined;
    const what = a.email ? tr("the email to {to}", { to: a.email.to }) : a.payment ? tr("the {merchant} payment", { merchant: a.payment.merchant }) : a.action?.tool ?? tr("that");
    const outcome = !approve
      ? tr("Declined: {what} didn't happen.", { what })
      : real ?? (a.kind === "payment" && state().settings.paymentsTestMode
        ? tr("Approved: paid for {what} (test mode, nothing charged).", { what })
        : a.kind === "email" ? tr("Approved: sent — {what}.", { what }) : tr("Approved: done — {what}.", { what }));
    if (task?.agent && isLive()) {
      system(task.channelId, outcome, "note", task.id);
      taskUpdate(task.id, outcome, a.kind === "email" ? "Gmail" : "Cloud Duet");
      taskPatch(task.id, { status: "working", latest: approve ? tr("Approved") : tr("Skipped one step") });
      spawnTask(task.id, `(app note: ${outcome} Wrap up or continue.)`);
    } else if (real) {
      status(a.channelId, null, a.taskId);
      const prefix = tr("Approved: ");
      await say(a.channelId, real.startsWith(prefix) ? real.slice(prefix.length) : real, { taskId: a.taskId, delay: 500 });
      if (a.taskId) readyForReview(a.taskId);
    } else await demo.afterApproval(a);
  });
  return a;
}

/** Runs what an approval stands for in a real app. Undefined when it's sample-only. */
async function carryOut(a: Approval): Promise<string | undefined> {
  status(a.channelId, "Working on it", a.taskId);
  try {
    if (a.kind === "email" && a.email?.app === "mailbox") {
      await direct.run("mailbox", "send", a.email as unknown as Record<string, unknown>);
      return tr("Approved: sent the email to {to} from {from}.", { to: a.email.to, from: a.email.from ?? tr("your mailbox") });
    }
    if (a.kind === "email" && a.email && realApps().includes("gmail")) {
      const r = await sendGmail(a.email);
      return r.ok ? tr("Approved: sent the email to {to} from your Gmail.", { to: a.email.to }) : tr("Gmail couldn't send it: {error}", { error: r.error ?? tr("unknown error") });
    }
    const exec = a.action?.exec;
    if (exec?.kind === "composio") {
      const r = await runAction(exec.slug, exec.arguments);
      return r.ok ? tr("Approved: done — {what}.", { what: a.action!.tool }) : tr("{tool} failed: {error}", { tool: a.action!.tool, error: r.error ?? tr("unknown error") });
    }
    if (exec?.kind === "direct") {
      await direct.run(exec.app, exec.op, exec.arguments);
      return tr("Approved: done — {what}.", { what: a.action!.tool });
    }
    if (exec?.kind === "browser" && a.taskId) {
      await browser.click(a.taskId, exec.ref);
      return tr("Approved: clicked it — {tool}. Look at the page to confirm it went through.", { tool: a.action!.tool });
    }
  } catch (e) {
    return tr("That failed: {error}", { error: (e as Error).message.split("\n")[0].slice(0, 200) });
  } finally {
    status(a.channelId, null, a.taskId);
  }
  return undefined;
}

/** The person signed in on a card from a model-run browser task. */
export async function finishLogin(messageId: string, email: string, password: string): Promise<boolean> {
  const l = browser.takeLogin(messageId);
  if (!l) return false;
  const m = find<Message>("messages", messageId);
  if (m?.card?.kind === "signin") patch<Message>("messages", messageId, { card: { ...m.card, state: "sent", email } });
  let note: string;
  try {
    await browser.fillLogin(l.taskId, { user: l.user, pass: l.pass, submit: l.submit }, email, password);
    note = `The person entered their login (${email}) and it was submitted. Look at the page to check it worked.`;
  } catch (e) {
    note = `Typing their login failed: ${(e as Error).message.slice(0, 160)}. Look at the page.`;
  }
  taskPatch(l.taskId, { status: "working", latest: tr("Signed in") });
  spawnTask(l.taskId, `(app note: ${note})`);
  return true;
}

export async function startSuggestion(channelId: string, prompt: string, source: "user" | "proactive" = "user"): Promise<Task> {
  if (!isLive()) return demo.startTaskFromPrompt(channelId, prompt, source);
  const task = createTask({
    channelId, prompt, source, agent: true, noticed: source === "proactive",
    title: prompt.length > 60 ? `${prompt.slice(0, 57).trimEnd()}…` : prompt,
    description: prompt,
  });
  spawnTask(task.id);
  return task;
}

export function firstDayScan() {
  void guarded("main", demo.firstDayScan);
}

export function scanForWork() {
  void guarded("main", () => demo.scanForWork());
}

export async function runRoutine(id: "brief" | "checkin") {
  const r = find<Routine>("routines", id);
  if (!r) return;
  const s = state().settings;
  // Move the schedule on first, so a failing run can't repeat every tick.
  patch<Routine>("routines", id, { nextRunAt: id === "brief" ? nextBriefAt(s.briefTime) : nextCheckinAt(s.checkinHours, s.checkinMinute) });
  let outcome: "Resolved" | "Posted" = "Resolved";
  if (id === "brief") {
    await guarded("main", () => demo.morningBrief("main"));
    outcome = "Posted";
    notify({ title: "Cloud Duet", body: tr("Morning, {name}! For today: Launch review. Maya's deck. Overdue invoices.", { name: state().user.firstName }), channelId: "main" });
  } else {
    await guarded("main", async () => {
      if (await demo.checkIn()) outcome = "Posted";
    });
  }
  const latest = find<Routine>("routines", id);
  if (latest) patch<Routine>("routines", id, { runs: [{ at: nowIso(), outcome }, ...latest.runs].slice(0, 20) });
}

function tick() {
  for (const a of accounts()) {
    try {
      runAs(a.id, tickAccount);
    } catch (e) {
      console.error("tick", a.id, e);
    }
  }
}

function tickAccount() {
  const s = state();
  if (!s.user.onboarded) return;
  const now = Date.now();
  const weekend = [0, 6].includes(new Date().getDay());
  for (const r of s.routines) {
    if (Date.parse(r.nextRunAt) <= now) {
      if (weekend && !s.settings.weekendsOn) {
        patch<Routine>("routines", r.id, {
          runs: [{ at: nowIso(), outcome: "Skipped" as const }, ...r.runs].slice(0, 20),
          nextRunAt: r.id === "brief" ? nextBriefAt(s.settings.briefTime) : nextCheckinAt(s.settings.checkinHours, s.settings.checkinMinute),
        });
      } else void runRoutine(r.id).catch((e) => console.error("[duet] routine", r.id, e));
    }
  }
  for (const rem of s.reminders) {
    if (!rem.fired && Date.parse(rem.at) <= now) {
      rem.fired = true;
      void say(rem.channelId, tr("Reminder: {text}", { text: rem.text }));
      notify({ title: "Cloud Duet", body: tr("Reminder: {text}", { text: rem.text }), channelId: rem.channelId });
    }
  }
}

export function ensureStarted() {
  if (g.__duetTimer) return;
  g.__duetTimer = setInterval(tick, 20_000);
}

export function isBusy(key: string) {
  return busy.has(laneOf(key));
}
