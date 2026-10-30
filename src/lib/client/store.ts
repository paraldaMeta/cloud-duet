"use client";

import { create } from "zustand";
import { t } from "./i18n";
import type { AppNotice, AppState, Attachment, ServerEvent } from "@/lib/shared/types";

export type Tab = "chat" | "tasks" | "make" | "pinned";

export type Sheet =
  | null
  | "claude"
  | "profile"
  | "usage"
  | "memory"
  | "notifications"
  | "payments"
  | "model"
  | "services"
  | "newChannel"
  | "addTask"
  | { connector: string };

interface Ui {
  data: AppState | null;
  /** "out" shows the sign-in screen. */
  auth: "unknown" | "in" | "out";
  providers: { google: boolean; apple: boolean };
  connected: boolean;
  tab: Tab;
  channelId: string;
  taskId: string | null;
  menuOpen: boolean;
  sheet: Sheet;
  viewerId: string | null;
  buildId: string | null;
  describeType: string | null;
  voice: boolean;
  replay: boolean;
  notices: AppNotice[];
  setData: (d: AppState) => void;
  apply: (e: ServerEvent) => void;
  set: (p: Partial<Omit<Ui, "set" | "apply" | "setData">>) => void;
  dismissNotice: (id: string) => void;
}

const VIEW = {
  tab: "chat" as Tab,
  channelId: "main",
  taskId: null,
  menuOpen: false,
  sheet: null,
  viewerId: null,
  buildId: null,
  describeType: null,
  voice: false,
  replay: false,
  notices: [],
} satisfies Partial<Ui>;

export const useDuet = create<Ui>((set, get) => ({
  data: null,
  auth: "unknown",
  providers: { google: false, apple: false },
  connected: true,
  tab: "chat",
  channelId: "main",
  taskId: null,
  menuOpen: false,
  sheet: null,
  viewerId: null,
  buildId: null,
  describeType: null,
  voice: false,
  replay: false,
  notices: [],
  setData: (d) => set({ data: d }),
  set: (p) => set(p),
  dismissNotice: (id) => set({ notices: get().notices.filter((n) => n.id !== id) }),
  apply: (e) => {
    const d = get().data;
    if (!d) return;
    switch (e.type) {
      case "upsert": {
        const list = d[e.collection] as unknown as { id?: string; name?: string }[];
        const key = e.item.id ?? e.item.name;
        const i = list.findIndex((x) => (x.id ?? x.name) === key);
        const next = [...list];
        if (i >= 0) next[i] = e.item;
        else next.push(e.item);
        set({ data: { ...d, [e.collection]: next } });
        return;
      }
      case "remove": {
        const list = d[e.collection] as unknown as { id?: string; name?: string }[];
        set({ data: { ...d, [e.collection]: list.filter((x) => (x.id ?? x.name) !== e.id) } });
        return;
      }
      case "set":
        set({ data: { ...d, [e.key]: e.value } });
        return;
      case "status":
        set({ data: { ...d, status: { ...d.status, [e.key]: e.status } } });
        return;
      case "typing":
        set({ data: { ...d, typing: { ...d.typing, [e.key]: e.typing } } });
        return;
      case "notify": {
        const ui = get();
        const onScreen = ui.tab === "chat" && !ui.taskId && ui.channelId === (e.notice.channelId ?? "main") && !e.notice.taskId;
        if (onScreen && document.visibilityState === "visible") return;
        set({ notices: [...ui.notices.slice(-2), e.notice] });
        if (d.settings.notifications && document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(e.notice.title, { body: e.notice.body, icon: "/icon.svg" });
          } catch {}
        }
        return;
      }
      case "reset":
        void refresh().catch(() => {});
        return;
    }
  },
}));

let snapshot = 0;
let loading = 0;
let buffered: ServerEvent[] = [];

/**
 * Loads the full state. Events that arrive while it loads are replayed on top,
 * and a response older than one already applied is dropped.
 */
export async function refresh() {
  const mine = ++snapshot;
  loading++;
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.status === 401) return signedOut();
    if (!res.ok) throw new Error(`state ${res.status}`);
    const data = (await res.json()) as AppState;
    if (mine !== snapshot) return;
    useDuet.getState().setData(data);
    const replay = buffered;
    buffered = [];
    for (const e of replay) useDuet.getState().apply(e);
  } finally {
    loading--;
    if (!loading) buffered = [];
  }
}

let es: EventSource | null = null;
let poll: ReturnType<typeof setInterval> | null = null;
let fallback: ReturnType<typeof setTimeout> | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let attempts = 0;

function stopAll() {
  es?.close();
  es = null;
  if (poll) clearInterval(poll);
  poll = null;
  if (fallback) clearTimeout(fallback);
  fallback = null;
  if (retry) clearTimeout(retry);
  retry = null;
}

function signedOut() {
  stopAll();
  useDuet.getState().set({ ...VIEW, auth: "out", data: null, connected: true });
}

export async function signOut() {
  // This device shouldn't keep getting the account's notifications.
  try {
    const sub = await (await navigator.serviceWorker?.getRegistration())?.pushManager.getSubscription();
    if (sub) {
      await api.post("push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch {}
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  signedOut();
}

/** Some proxies and tunnels buffer event streams; if nothing arrives, poll the full state instead. */
function startPolling() {
  if (poll) return;
  let inFlight = false;
  const tick = () => {
    if (inFlight) return;
    inFlight = true;
    refresh()
      .then(() => useDuet.getState().set({ connected: true }))
      .catch(() => useDuet.getState().set({ connected: false }))
      .finally(() => {
        inFlight = false;
      });
  };
  tick();
  poll = setInterval(tick, 1500);
}

function retryLater(fn: () => void) {
  if (retry) return;
  const wait = Math.min(30_000, 1000 * 2 ** Math.min(attempts++, 5));
  retry = setTimeout(() => {
    retry = null;
    fn();
  }, wait);
}

export function connect() {
  if (es || poll) return;
  void fetch("/api/auth/me", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(`me ${r.status}`);
      return r.json() as Promise<{ user: unknown; providers: Ui["providers"] }>;
    })
    .then((me) => {
      attempts = 0;
      useDuet.getState().set({ providers: me.providers, connected: true });
      if (!me.user) return signedOut();
      useDuet.getState().set({ auth: "in" });
      openStream();
    })
    .catch(() => {
      useDuet.getState().set({ connected: false });
      retryLater(connect);
    });
}

function openStream() {
  if (es) return;
  const stream = new EventSource("/api/events");
  es = stream;
  let live = false;
  fallback = setTimeout(() => !live && startPolling(), 4000);
  stream.onopen = () => {
    attempts = 0;
    refresh()
      .then(() => useDuet.getState().set({ connected: true }))
      .catch(() => useDuet.getState().set({ connected: false }));
  };
  stream.onerror = () => {
    if (!poll) useDuet.getState().set({ connected: false });
    // The browser gives up for good after an HTTP error (an expired session, a
    // proxy 502). Check the session, then open a fresh stream.
    if (stream.readyState === EventSource.CLOSED && es === stream) {
      es = null;
      if (fallback) clearTimeout(fallback);
      fallback = null;
      refresh().then(
        () => useDuet.getState().auth === "in" && retryLater(openStream),
        () => retryLater(openStream),
      );
    }
  };
  stream.onmessage = (m) => {
    live = true;
    if (fallback) clearTimeout(fallback);
    fallback = null;
    if (poll) {
      clearInterval(poll);
      poll = null;
    }
    let e: ServerEvent | { type: "hello" };
    try {
      e = JSON.parse(m.data) as ServerEvent | { type: "hello" };
    } catch {
      return;
    }
    if (e.type === "hello") return;
    if (loading) buffered.push(e);
    else useDuet.getState().apply(e);
  };
}

export const api = {
  async call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`/api/${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) signedOut();
    if (!res.ok) throw new Error((json as { error?: string }).error || res.statusText);
    return json as T;
  },
  post<T = unknown>(path: string, body?: unknown) {
    return this.call<T>("POST", path, body ?? {});
  },
  patch<T = unknown>(path: string, body: unknown) {
    return this.call<T>("PATCH", path, body);
  },
  put<T = unknown>(path: string, body: unknown) {
    return this.call<T>("PUT", path, body);
  },
  del<T = unknown>(path: string) {
    return this.call<T>("DELETE", path);
  },
};

export function send(text: string, opts: { channelId?: string; taskId?: string; files?: string[] } = {}) {
  const ui = useDuet.getState();
  const channelId = opts.channelId ?? ui.channelId;
  window.dispatchEvent(new CustomEvent("duet:sent"));
  return api.post(`channels/${channelId}/messages`, { text, taskId: opts.taskId, files: opts.files });
}

/** Uploads one file and reports progress from 0 to 1. */
export function uploadFile(file: File, onProgress?: (p: number) => void): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let json: Attachment & { error?: string };
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        return reject(new Error(t("Upload failed")));
      }
      if (xhr.status === 401) signedOut();
      if (xhr.status >= 400) return reject(new Error(json.error || t("Upload failed")));
      resolve(json);
    };
    xhr.onerror = () => reject(new Error(t("Upload failed. Check your connection.")));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
