// A mailbox reached over IMAP and SMTP with the address and an auth code, which
// is how QQ Mail, NetEase (163/126/yeah), Sina, Aliyun, Tencent Exmail and most
// Chinese providers let other apps in. Each call opens its own connection.
import { ImapFlow, type SearchObject } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { isPrivateHost } from "../net";
import { tr } from "../i18n";

export interface MailCreds {
  email: string;
  password: string;
  provider: string;
  imapHost?: string;
  imapPort?: string;
  smtpHost?: string;
  smtpPort?: string;
  /** The account owner may point at a server on a private network. */
  allowPrivate?: boolean;
}

interface Preset {
  label: string;
  domains: string[];
  imap: [string, number];
  smtp: [string, number];
  /** Where to switch on IMAP/SMTP and get an auth code. */
  help?: string;
}

export const PRESETS: Record<string, Preset> = {
  qq: { label: "QQ 邮箱", domains: ["qq.com", "foxmail.com", "vip.qq.com"], imap: ["imap.qq.com", 993], smtp: ["smtp.qq.com", 465], help: "https://wx.mail.qq.com/list/readtemplate?name=app_intro.html#/agreement/authorizationCode" },
  netease163: { label: "网易 163 邮箱", domains: ["163.com", "vip.163.com"], imap: ["imap.163.com", 993], smtp: ["smtp.163.com", 465], help: "https://help.mail.163.com/faqDetail.do?code=d7a5dc8471cd0c0e8b4b8f4f8e49998b374173cfe9171305fa1ce630d7f67ac2a5feb28b66796d3b" },
  netease126: { label: "网易 126 邮箱", domains: ["126.com", "vip.126.com"], imap: ["imap.126.com", 993], smtp: ["smtp.126.com", 465] },
  yeah: { label: "网易 yeah.net", domains: ["yeah.net"], imap: ["imap.yeah.net", 993], smtp: ["smtp.yeah.net", 465] },
  exmail: { label: "腾讯企业邮箱", domains: [], imap: ["imap.exmail.qq.com", 993], smtp: ["smtp.exmail.qq.com", 465] },
  qiye163: { label: "网易企业邮箱", domains: [], imap: ["imap.qiye.163.com", 993], smtp: ["smtp.qiye.163.com", 465] },
  aliyun: { label: "阿里邮箱（个人）", domains: ["aliyun.com"], imap: ["imap.aliyun.com", 993], smtp: ["smtp.aliyun.com", 465] },
  aliqiye: { label: "阿里企业邮箱", domains: [], imap: ["imap.qiye.aliyun.com", 993], smtp: ["smtp.qiye.aliyun.com", 465] },
  sina: { label: "新浪邮箱", domains: ["sina.com", "sina.cn"], imap: ["imap.sina.com", 993], smtp: ["smtp.sina.com", 465] },
  sohu: { label: "搜狐邮箱", domains: ["sohu.com"], imap: ["imap.sohu.com", 993], smtp: ["smtp.sohu.com", 465] },
  mobile139: { label: "139 邮箱", domains: ["139.com"], imap: ["imap.139.com", 993], smtp: ["smtp.139.com", 465] },
  icloud: { label: "iCloud", domains: ["icloud.com", "me.com", "mac.com"], imap: ["imap.mail.me.com", 993], smtp: ["smtp.mail.me.com", 587] },
  gmail: { label: "Gmail（应用专用密码）", domains: ["gmail.com", "googlemail.com"], imap: ["imap.gmail.com", 993], smtp: ["smtp.gmail.com", 465] },
};

/** The preset for an address's domain, if there is one. */
export function presetFor(email: string): string | undefined {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return Object.entries(PRESETS).find(([, p]) => p.domains.includes(domain))?.[0];
}

function servers(c: MailCreds) {
  const id = c.provider === "auto" || !c.provider ? presetFor(c.email) : c.provider;
  if (id && id !== "custom" && PRESETS[id]) {
    const p = PRESETS[id];
    return { imap: { host: p.imap[0], port: p.imap[1] }, smtp: { host: p.smtp[0], port: p.smtp[1] } };
  }
  if (!c.imapHost || !c.smtpHost) throw new Error(tr("Pick your mail provider, or enter its IMAP and SMTP servers."));
  return {
    imap: { host: c.imapHost.trim(), port: Number(c.imapPort) || 993 },
    smtp: { host: c.smtpHost.trim(), port: Number(c.smtpPort) || 465 },
  };
}

async function checkHost(host: string, c: MailCreds) {
  if (!c.allowPrivate && (await isPrivateHost(host))) throw new Error(tr("{host} isn't a public mail server.", { host }));
}

async function imap<T>(c: MailCreds, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const { imap: s } = servers(c);
  await checkHost(s.host, c);
  const client = new ImapFlow({
    host: s.host, port: s.port, secure: s.port === 993,
    auth: { user: c.email, pass: c.password },
    // NetEase refuses logins from clients that don't say who they are.
    clientInfo: { name: "Cloud Duet", version: "1.0", vendor: "Cloud Duet" },
    logger: false, disableAutoIdle: true,
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 60_000,
  });
  client.on("error", () => {});
  try {
    await client.connect();
  } catch (e) {
    throw new Error(friendly(e));
  }
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

function friendly(e: unknown): string {
  const err = e as { message?: string; responseText?: string; authenticationFailed?: boolean; code?: string };
  const text = `${err.responseText ?? ""} ${err.message ?? ""}`;
  if (err.authenticationFailed || /auth|login|password|LOGIN|密码|授权/i.test(text)) {
    return tr("The mail server didn't accept that address and auth code. Use the auth code from your mailbox settings, not your login password, and check IMAP/SMTP is switched on.");
  }
  if (/Unsafe Login/i.test(text)) return tr("NetEase blocked the sign-in as unsafe. Open your mailbox settings and allow IMAP for this client.");
  if (err.code === "ENOTFOUND" || err.code === "ETIMEDOUT" || err.code === "ECONNREFUSED") return tr("Couldn't reach the mail server ({code}).", { code: err.code });
  return (err.message ?? String(e)).split("\n")[0].slice(0, 200);
}

/** Signs in to both servers without changing anything. */
export async function verify(c: MailCreds) {
  await imap(c, async () => undefined);
  const t = await transport(c);
  try {
    await t.verify();
  } catch (e) {
    throw new Error(friendly(e));
  } finally {
    t.close();
  }
}

async function transport(c: MailCreds) {
  const { smtp: s } = servers(c);
  await checkHost(s.host, c);
  return nodemailer.createTransport({
    host: s.host, port: s.port, secure: s.port === 465, requireTLS: s.port !== 465,
    auth: { user: c.email, pass: c.password },
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 60_000,
  });
}

const addr = (list?: { address?: string; name?: string }[]) =>
  (list ?? []).map((a) => (a.name ? `${a.name} <${a.address}>` : a.address ?? "")).filter(Boolean).join(", ");

/** Recent messages in a folder, newest first, optionally matching words or only unread. */
export async function list(c: MailCreds, opts: { query?: string; unreadOnly?: boolean; limit?: number; folder?: string }) {
  const limit = Math.min(Math.max(Number(opts.limit) || 10, 1), 25);
  return imap(c, async (client) => {
    const lock = await client.getMailboxLock(opts.folder || "INBOX");
    try {
      const q = opts.query?.trim();
      const search: SearchObject = { ...(opts.unreadOnly ? { seen: false } : {}), ...(q ? { or: [{ subject: q }, { from: q }, { body: q }] } : {}) };
      let uids: number[];
      if (Object.keys(search).length) {
        uids = ((await client.search(search, { uid: true })) || []) as number[];
      } else {
        const total = client.mailbox ? client.mailbox.exists : 0;
        if (!total) return [];
        const from = Math.max(1, total - limit + 1);
        const msgs = await client.fetchAll(`${from}:*`, { uid: true });
        uids = msgs.map((m) => m.uid);
      }
      const pick = uids.sort((a, b) => b - a).slice(0, limit);
      if (!pick.length) return [];
      const msgs = await client.fetchAll(pick.join(","), { uid: true, envelope: true, flags: true, internalDate: true }, { uid: true });
      return msgs
        .sort((a, b) => b.uid - a.uid)
        .map((m) => ({
          uid: m.uid,
          from: addr(m.envelope?.from),
          to: addr(m.envelope?.to),
          subject: m.envelope?.subject ?? "",
          date: new Date(m.envelope?.date ?? m.internalDate ?? 0).toISOString(),
          unread: !m.flags?.has("\\Seen"),
        }));
    } finally {
      lock.release();
    }
  });
}

/** One message as plain text, without marking it read. */
export async function read(c: MailCreds, uid: number, folder = "INBOX") {
  return imap(c, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const m = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!m || !m.source) return null;
      const p = await simpleParser(m.source);
      const text = (p.text || (typeof p.html === "string" ? p.html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ") : "")).replace(/\n{3,}/g, "\n\n").trim();
      const one = (v: typeof p.to) => (Array.isArray(v) ? v.map((x) => x.text).join(", ") : v?.text ?? "");
      return {
        uid, from: one(p.from), to: one(p.to), cc: one(p.cc), subject: p.subject ?? "", date: p.date?.toISOString(),
        message_id: p.messageId, text: text.length > 8000 ? `${text.slice(0, 8000)}… (truncated)` : text,
        attachments: p.attachments.map((a) => a.filename ?? a.contentType).slice(0, 20),
      };
    } finally {
      lock.release();
    }
  });
}

export async function folders(c: MailCreds) {
  return imap(c, async (client) => (await client.list()).map((f) => ({ path: f.path, name: f.name, special: f.specialUse })));
}

export async function send(c: MailCreds, email: { to: string; cc?: string; subject: string; body: string; inReplyTo?: string }) {
  const t = await transport(c);
  try {
    await t.sendMail({
      from: c.email, to: email.to, cc: email.cc || undefined, subject: email.subject, text: email.body,
      ...(email.inReplyTo ? { inReplyTo: email.inReplyTo, references: email.inReplyTo } : {}),
    });
  } catch (e) {
    throw new Error(friendly(e));
  } finally {
    t.close();
  }
}
