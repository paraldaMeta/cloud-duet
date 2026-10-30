// Events for each account's open tabs. A tab only hears its own account.
import type { ServerEvent } from "@/lib/shared/types";

type Listener = (event: ServerEvent) => void;

const g = globalThis as unknown as { __duetBus?: Map<string, Set<Listener>> };
const listeners: Map<string, Set<Listener>> = (g.__duetBus ??= new Map());

export function publish(userId: string, event: ServerEvent) {
  for (const l of listeners.get(userId) ?? []) {
    try {
      l(event);
    } catch {
      // A closed stream drops its listener on its own.
    }
  }
}

export function subscribe(userId: string, listener: Listener): () => void {
  const set = listeners.get(userId) ?? new Set();
  set.add(listener);
  listeners.set(userId, set);
  return () => set.delete(listener);
}
