// Each account's state, kept in memory and saved to data/users/<id>/state.json.
// Every change goes through these helpers so that account's tabs hear about it
// over SSE. The account comes from the request context (see ./context).
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentStatus, AppNotice, AppState, Collection, ServerEvent } from "@/lib/shared/types";
import { publish } from "./bus";
import { currentUserId, userDir } from "./context";
import { readJson, writeJson } from "./fsx";
import { defaultConnectors, initialState } from "./fixtures";
import { sendPush } from "./push";

const g = globalThis as unknown as { __duetStates?: Map<string, AppState>; __duetSaveTimers?: Map<string, NodeJS.Timeout> };
const states: Map<string, AppState> = (g.__duetStates ??= new Map());
const timers: Map<string, NodeJS.Timeout> = (g.__duetSaveTimers ??= new Map());

const fileFor = (uid: string) => path.join(userDir(uid), "state.json");

function load(uid: string): AppState {
  const file = fileFor(uid);
  let raw: Partial<AppState>;
  try {
    raw = readJson<Partial<AppState>>(file, {});
  } catch (e) {
    // Keep the unreadable file next to the fresh one instead of saving over it.
    const aside = `${file}.corrupt-${Date.now()}`;
    try {
      fs.renameSync(file, aside);
    } catch {}
    console.error(`[duet] ${file} couldn't be read (${(e as Error).message}); moved it to ${aside} and started fresh.`);
    raw = {};
  }
  const base = initialState();
  // Connectors added in later versions show up in workspaces saved before them.
  const connectors = raw.connectors ? [...raw.connectors, ...base.connectors.filter((c) => !raw.connectors!.some((x) => x.id === c.id))] : base.connectors;
  return { ...base, ...raw, connectors, status: {}, typing: {}, usage: { ...base.usage, ...raw.usage } } as AppState;
}

export function state(): AppState {
  const uid = currentUserId();
  let s = states.get(uid);
  if (!s) {
    s = load(uid);
    states.set(uid, s);
  }
  return s;
}

function scheduleSave() {
  const uid = currentUserId();
  clearTimeout(timers.get(uid));
  timers.set(uid, setTimeout(() => {
    const s = states.get(uid);
    if (!s) return;
    const { status: _s, typing: _t, ...rest } = s;
    void _s;
    void _t;
    writeJson(fileFor(uid), rest);
  }, 250));
}

export const id = () => randomUUID().slice(0, 12);
export const nowIso = () => new Date().toISOString();

function emit(event: ServerEvent) {
  publish(currentUserId(), event);
}

type Item = { id?: string; name?: string };
const keyOf = (item: Item) => (item.id ?? item.name) as string;

export function upsert<T extends Item>(collection: Collection, item: T): T {
  const list = state()[collection] as unknown as T[];
  const i = list.findIndex((x) => keyOf(x) === keyOf(item));
  if (i >= 0) list[i] = item;
  else list.push(item);
  emit({ type: "upsert", collection, item: item as unknown as Item & Record<string, unknown> });
  scheduleSave();
  return item;
}

export function patch<T extends Item>(collection: Collection, key: string, changes: Partial<T>): T | undefined {
  const list = state()[collection] as unknown as T[];
  const cur = list.find((x) => keyOf(x) === key);
  if (!cur) return undefined;
  return upsert(collection, { ...cur, ...changes });
}

export function find<T extends Item>(collection: Collection, key: string): T | undefined {
  return (state()[collection] as unknown as T[]).find((x) => keyOf(x) === key);
}

export function remove(collection: Collection, key: string) {
  const s = state();
  (s[collection] as unknown as Item[]) = (s[collection] as unknown as Item[]).filter((x) => keyOf(x) !== key);
  emit({ type: "remove", collection, id: key });
  scheduleSave();
}

export function set<K extends "user" | "settings" | "memory" | "usage" | "engine">(key: K, value: AppState[K]) {
  (state() as AppState)[key] = value;
  emit({ type: "set", key, value });
  scheduleSave();
}

export function setStatus(key: string, status: AgentStatus | null) {
  state().status[key] = status;
  emit({ type: "status", key, status });
}

export function setTyping(key: string, typing: boolean) {
  state().typing[key] = typing;
  emit({ type: "typing", key, typing });
}

export function notify(notice: Omit<AppNotice, "id" | "at">) {
  emit({ type: "notify", notice: { ...notice, id: id(), at: nowIso() } });
  if (state().settings.notifications) void sendPush(currentUserId(), notice);
}

export function resetAll() {
  const uid = currentUserId();
  const prev = states.get(uid);
  const next = initialState();
  // Resetting the workspace keeps the account itself.
  if (prev) {
    next.user = { ...prev.user, onboarded: false, scanned: false };
    next.connectors = defaultConnectors(prev.user.email);
  }
  states.set(uid, next);
  scheduleSave();
  emit({ type: "reset" });
}

/** Counts tokens against the session and weekly limits. */
export function addUsage(tokens: number) {
  const u = { ...state().usage };
  const now = Date.now();
  if (!u.sessionStartedAt || now - Date.parse(u.sessionStartedAt) > 5 * 3600_000) {
    u.sessionStartedAt = new Date(now).toISOString();
    u.sessionUsed = 0;
  }
  u.sessionUsed += tokens;
  u.weeklyUsed += tokens;
  set("usage", u);
}
