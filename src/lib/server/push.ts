// System notifications through Web Push. The VAPID key pair is generated on
// first use and kept in data/vapid.json, so push needs no outside account.
// Each browser or installed app that turns notifications on stores its
// subscription under the account.
import fs from "node:fs";
import path from "node:path";
import webpush, { type PushSubscription } from "web-push";
import type { AppNotice } from "@/lib/shared/types";
import { DATA_DIR, readUserJson, writeUserJson } from "./context";

interface Vapid { publicKey: string; privateKey: string }

const g = globalThis as unknown as { __duetVapid?: Vapid };

function vapid(): Vapid {
  if (g.__duetVapid) return g.__duetVapid;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    g.__duetVapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const file = path.join(DATA_DIR, "vapid.json");
    try {
      g.__duetVapid = JSON.parse(fs.readFileSync(file, "utf8")) as Vapid;
    } catch {
      g.__duetVapid = webpush.generateVAPIDKeys();
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(g.__duetVapid), { mode: 0o600 });
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:duet@example.com", g.__duetVapid!.publicKey, g.__duetVapid!.privateKey);
  return g.__duetVapid!;
}

export const vapidPublicKey = () => vapid().publicKey;

const subs = (uid?: string) => readUserJson<PushSubscription[]>("push.json", [], uid);

export function addSubscription(sub: PushSubscription) {
  const list = subs().filter((s) => s.endpoint !== sub.endpoint);
  writeUserJson("push.json", [...list, sub]);
}

export function removeSubscription(endpoint: string) {
  writeUserJson("push.json", subs().filter((s) => s.endpoint !== endpoint));
}

export const pushCount = () => subs().length;

export async function sendPush(uid: string, notice: Omit<AppNotice, "id" | "at">) {
  const list = subs(uid);
  if (!list.length) return;
  vapid();
  const payload = JSON.stringify({ title: notice.title, body: notice.body, channelId: notice.channelId, taskId: notice.taskId });
  const gone: string[] = [];
  await Promise.all(
    list.map((s) =>
      webpush.sendNotification(s, payload, { TTL: 3600 }).catch((e: { statusCode?: number }) => {
        if (e.statusCode === 404 || e.statusCode === 410) gone.push(s.endpoint);
      }),
    ),
  );
  if (gone.length) writeUserJson("push.json", list.filter((s) => !gone.includes(s.endpoint)), uid);
}
