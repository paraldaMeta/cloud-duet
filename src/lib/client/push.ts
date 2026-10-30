"use client";

import { t } from "./i18n";
import { api } from "./store";

export function registerWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.register("/sw.js").catch(() => {});
}

function urlB64(key: string) {
  const pad = "=".repeat((4 - (key.length % 4)) % 4);
  const raw = atob((key + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Asks for permission and subscribes this device to push. Returns why it couldn't, or null. */
export async function enablePush(): Promise<string | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return /iPhone|iPad/.test(navigator.userAgent)
      ? t("On iPhone, add Duet to your Home Screen (Share → Add to Home Screen), open it from there, then turn this on.")
      : t("This browser doesn't support push notifications.");
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return t("Notifications are blocked for this site in your browser settings.");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const { key } = await api.call<{ key: string }>("GET", "push/key");
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(key) }));
  await api.post("push/subscribe", { subscription: sub.toJSON() });
  return null;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api.post("push/unsubscribe", { endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
}
