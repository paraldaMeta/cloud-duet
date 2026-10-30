// Duet's service worker: shows push notifications and opens the app when one is tapped.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: "Cloud Duet", body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || "Cloud Duet", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.taskId || data.channelId || "duet",
      data: { url: data.taskId ? "/?task=" + encodeURIComponent(data.taskId) : data.channelId && data.channelId !== "main" ? "/?channel=" + encodeURIComponent(data.channelId) : "/", channelId: data.channelId, taskId: data.taskId },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.postMessage({ type: "open", ...e.notification.data });
          return c.focus();
        }
      }
      return self.clients.openWindow(e.notification.data?.url || "/");
    }),
  );
});
