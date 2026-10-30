"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDuet } from "@/lib/client/store";

export function useUnreadChannels() {
  const data = useDuet((s) => s.data);
  const channelId = useDuet((s) => s.channelId);
  if (!data) return 0;
  return data.channels.filter(
    (c) => !c.archived && c.id !== channelId && data.messages.some((m) => m.channelId === c.id && !m.taskId && m.role === "claude" && m.createdAt > c.lastReadAt),
  ).length;
}

export function useTaskBadge() {
  const data = useDuet((s) => s.data);
  if (!data) return 0;
  return data.tasks.filter((t) => !t.archived && (t.status === "needs_input" || t.status === "ready_for_review")).length;
}

/** Re-renders every `ms` so relative times stay fresh. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function useIsDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setD(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return d;
}

/**
 * Guards an async action against double taps: while it runs, `busy` is true and
 * further calls are ignored. A failure shows a toast and resolves to false.
 */
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (e) {
      toast((e as Error).message);
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return [busy, run] as const;
}
