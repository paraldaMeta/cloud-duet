// The things Cloud Duet can do, shared by the demo engine and the model-backed
// engine. Each one changes the store, which streams to the app.
import type {
  AgentStatus, Approval, ApprovalKind, Artifact, ArtifactType, Attachment, Card, Message, ProactiveSuggestion,
  Task, TaskResource, TaskStep, UpNextItem,
} from "@/lib/shared/types";
import { find, id, notify, nowIso, patch, set, setStatus, setTyping, state, upsert } from "../store";
import { tr } from "../i18n";
import { renderArtifact } from "./artifacts";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The key status and typing are tracked under: a task id, or the channel id. */
export const laneKey = (channelId: string, taskId?: string) => taskId ?? channelId;

export function status(channelId: string, s: AgentStatus | null, taskId?: string) {
  setStatus(laneKey(channelId, taskId), s);
}

export function markSeen(channelId: string, taskId?: string) {
  for (const m of state().messages) {
    if (m.channelId === channelId && m.taskId === taskId && m.role === "user" && m.status !== "seen") {
      patch<Message>("messages", m.id, { status: "seen" });
    }
  }
}

export function postUser(channelId: string, text: string, taskId?: string, attachments?: Attachment[]): Message {
  const m: Message = {
    id: id(), channelId, taskId, role: "user", text, reactions: [], status: "delivered", createdAt: nowIso(),
    ...(attachments?.length ? { attachments } : {}),
  };
  return upsert("messages", m);
}

export function system(channelId: string, text: string, kind: "note" | "date" = "note", taskId?: string): Message {
  return upsert<Message>("messages", {
    id: id(), channelId, taskId, role: "system", systemKind: kind, text, reactions: [], status: "sent", createdAt: nowIso(),
  });
}

interface SayOptions {
  taskId?: string;
  card?: Card;
  quickReplies?: string[];
  /** Typing time before the bubble lands; scales with length when omitted. */
  delay?: number;
}

/** Posts one Cloud Duet bubble after a typing indicator. */
export async function say(channelId: string, text: string, opts: SayOptions = {}): Promise<Message> {
  const key = laneKey(channelId, opts.taskId);
  markSeen(channelId, opts.taskId);
  setTyping(key, true);
  await sleep(opts.delay ?? Math.min(1800, 500 + text.length * 8));
  setTyping(key, false);
  const m: Message = {
    id: id(), channelId, taskId: opts.taskId, role: "claude", text, card: opts.card,
    quickReplies: opts.quickReplies?.map((label) => ({ label })),
    reactions: [], status: "sent", createdAt: nowIso(),
  };
  upsert("messages", m);
  return m;
}

/** Posts several bubbles one at a time, the way Duet splits long replies. */
export async function sayAll(channelId: string, texts: string[], opts: SayOptions = {}) {
  let last: Message | undefined;
  for (const t of texts) last = await say(channelId, t, { ...opts, card: undefined, quickReplies: undefined });
  if (opts.card || opts.quickReplies) {
    last = await say(channelId, "", { ...opts, delay: 250 });
  }
  return last;
}

export async function card(channelId: string, c: Card, opts: { taskId?: string; text?: string; delay?: number } = {}) {
  return say(channelId, opts.text ?? "", { card: c, taskId: opts.taskId, delay: opts.delay ?? 400 });
}

export function channelName(channelId: string) {
  return channelId === "main" ? "main" : (find<{ id: string; name: string }>("channels", channelId)?.name ?? "main");
}

// ── tasks ───────────────────────────────────────────────────────────────

export function createTask(input: {
  channelId: string; title: string; prompt: string; description?: string; steps?: string[];
  source?: "user" | "proactive"; noticed?: boolean; status?: Task["status"]; agent?: boolean;
}): Task {
  const now = nowIso();
  const task: Task = {
    id: id(),
    channelId: input.channelId,
    title: input.title,
    prompt: input.prompt,
    description: input.description ?? "",
    status: input.status ?? "working",
    source: input.source ?? "user",
    noticedAt: input.noticed ? now : undefined,
    steps: (input.steps ?? []).map((text, i) => ({ text, state: i === 0 ? "current" : "pending" }) as TaskStep),
    updates: [],
    resources: [],
    latest: tr("Just started"),
    updateCount: 0,
    archived: false,
    agent: input.agent,
    createdAt: now,
    updatedAt: now,
  };
  return upsert("tasks", task);
}

export function taskPatch(taskId: string, changes: Partial<Task>) {
  return patch<Task>("tasks", taskId, { ...changes, updatedAt: nowIso() });
}

export function advanceStep(taskId: string) {
  const t = find<Task>("tasks", taskId);
  if (!t) return;
  const steps = t.steps.map((s) => ({ ...s }));
  const cur = steps.findIndex((s) => s.state === "current");
  if (cur >= 0) steps[cur].state = "done";
  const next = steps.findIndex((s) => s.state === "pending");
  if (next >= 0) steps[next].state = "current";
  taskPatch(taskId, { steps, latest: next >= 0 ? steps[next].text : t.latest });
}

export function finishSteps(taskId: string) {
  const t = find<Task>("tasks", taskId);
  if (!t) return;
  taskPatch(taskId, { steps: t.steps.map((s) => ({ ...s, state: "done" })) });
}

export function taskUpdate(taskId: string, text: string, source: string) {
  const t = find<Task>("tasks", taskId);
  if (!t) return;
  taskPatch(taskId, {
    updates: [...t.updates, { text, source, at: nowIso() }],
    latest: text,
    updateCount: t.updateCount + 1,
  });
}

export function taskResource(taskId: string, r: TaskResource) {
  const t = find<Task>("tasks", taskId);
  if (!t) return;
  taskPatch(taskId, { resources: [...t.resources, r] });
}

export function readyForReview(taskId: string, latest = tr("Ready for review")) {
  const t = taskPatch(taskId, { status: "ready_for_review", latest });
  if (t) {
    finishSteps(taskId);
    notify({ title: "Cloud Duet", body: tr("{title} is ready for review.", { title: t.title }), channelId: t.channelId, taskId });
  }
}

// ── approvals ───────────────────────────────────────────────────────────

export async function requestApproval(
  channelId: string,
  kind: ApprovalKind,
  payload: Partial<Pick<Approval, "email" | "payment" | "sign" | "delete" | "action">>,
  opts: { taskId?: string; lead?: string } = {},
): Promise<Approval> {
  const approval: Approval = { id: id(), kind, channelId, taskId: opts.taskId, status: "pending", createdAt: nowIso(), ...payload };
  upsert("approvals", approval);
  if (opts.lead) await say(channelId, opts.lead, { taskId: opts.taskId });
  const msg = await card(channelId, { kind: "approval", approvalId: approval.id }, { taskId: opts.taskId });
  patch<Approval>("approvals", approval.id, { messageId: msg.id });
  // Approvals raised inside a task also surface in the task's channel thread.
  if (opts.taskId) {
    taskPatch(opts.taskId, { status: "needs_input", latest: tr("Needs your OK") });
    await card(channelId, { kind: "approval", approvalId: approval.id });
  }
  notify({
    title: "Cloud Duet",
    body: kind === "email" ? tr("Draft to {to} is ready for your OK.", { to: payload.email?.to ?? "" }) : tr("Something needs your approval."),
    channelId,
    taskId: opts.taskId,
  });
  return find<Approval>("approvals", approval.id)!;
}

export function pendingEmail(channelId: string): Approval | undefined {
  return [...state().approvals].reverse().find((a) => a.channelId === channelId && a.kind === "email" && a.status === "pending");
}

// ── artifacts ───────────────────────────────────────────────────────────

export function createArtifact(input: { type: ArtifactType; title: string; prompt: string; channelId: string; taskId?: string; html?: string; sources?: string[] }): Artifact {
  const rendered = renderArtifact(input.type, input.title, input.prompt);
  const now = nowIso();
  const a: Artifact = {
    id: id(),
    type: input.type,
    title: input.title,
    html: input.html ?? rendered.html,
    channelId: input.channelId,
    taskId: input.taskId,
    sources: input.sources ?? rendered.sources,
    refresh: input.type === "dashboard" ? tr("Refreshes daily at 5:30 AM") : undefined,
    metrics: rendered.metrics,
    inTabBar: false,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
  return upsert("artifacts", a);
}

// ── suggestions ─────────────────────────────────────────────────────────

export async function proposeTask(channelId: string, s: { title: string; body: string; prompt: string }) {
  const sug: ProactiveSuggestion = { id: id(), channelId, state: "open", ...s };
  upsert("suggestions", sug);
  await say(channelId, tr("A task I could help with:"), { delay: 700 });
  await card(channelId, { kind: "proactive", suggestionId: sug.id });
  return sug;
}

export function addUpNext(item: Omit<UpNextItem, "id" | "createdAt">) {
  return upsert<UpNextItem>("upNext", { ...item, id: id(), createdAt: nowIso() });
}

export function remember(fact: string) {
  const s = state();
  const line = `- ${fact.trim()}`;
  if (s.memory.includes(line)) return;
  set("memory", s.memory ? `${s.memory.trimEnd()}\n${line}\n` : `# ${tr("What Cloud Duet knows about you")}\n\n${line}\n`);
}
