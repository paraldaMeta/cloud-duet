// Which account a piece of server work belongs to. Every request, background
// task and timer tick runs inside `runAs`, so the store, the model key and the
// connected apps all resolve to that person's data without passing ids around.
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "./fsx";

export const DATA_DIR = process.env.DUET_DATA_DIR || path.join(process.cwd(), "data");

const g = globalThis as unknown as { __duetCtx?: AsyncLocalStorage<string> };
const als: AsyncLocalStorage<string> = (g.__duetCtx ??= new AsyncLocalStorage<string>());

export function runAs<T>(userId: string, fn: () => T): T {
  return als.run(userId, fn);
}

export function currentUserId(): string {
  const id = als.getStore();
  if (!id) throw new Error("No signed-in account for this request.");
  return id;
}

export function userDir(userId = currentUserId()) {
  const dir = path.join(DATA_DIR, "users", userId.replace(/[^a-zA-Z0-9_-]/g, ""));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Small per-account JSON files: model.json, keys.json, push.json. */
export function readUserJson<T>(name: string, fallback: T, userId?: string): T {
  try {
    return readJson(path.join(userDir(userId), name), fallback);
  } catch (e) {
    console.error(`[duet] ${name} couldn't be read: ${(e as Error).message}`);
    return fallback;
  }
}

export function writeUserJson(name: string, value: unknown, userId?: string) {
  writeJson(path.join(userDir(userId), name), value);
}
