// Apps Cloud Duet reaches directly with credentials the person types into the
// app: a mailbox (QQ Mail, 163…), Feishu, DingTalk and WeCom. Credentials are
// kept per account in data/users/<id>/direct.json and never sent back to the
// browser; the form only learns which secrets are saved and their last four.
import type { Connector, DirectApp, DirectField, DirectForm } from "@/lib/shared/types";
import { readUserJson, writeUserJson } from "../context";
import { isOwner } from "../auth";
import { patch, state } from "../store";
import { tr } from "../i18n";
import * as mail from "./mail";
import * as chat from "./chat";

export const DIRECT_APPS: DirectApp[] = ["mailbox", "feishu", "dingtalk", "wecom"];
export const isDirect = (id: string): id is DirectApp => (DIRECT_APPS as string[]).includes(id);

type Creds = Record<string, string>;
const FILE = "direct.json";
const SECRET = new Set(["password", "appSecret", "webhook", "webhookSecret", "secret"]);

const all = () => readUserJson<Partial<Record<DirectApp, Creds>>>(FILE, {});
export const creds = (app: DirectApp): Creds | undefined => all()[app];

function fields(app: DirectApp): DirectField[] {
  switch (app) {
    case "mailbox":
      return [
        { key: "email", label: tr("Email address"), type: "email", placeholder: "12345678@qq.com" },
        {
          key: "password", label: tr("Auth code"), type: "password", placeholder: tr("16-character auth code"),
          help: tr("Not your login password. In QQ Mail: Settings → Account → POP3/IMAP/SMTP → turn on IMAP/SMTP and generate an auth code."),
        },
        {
          key: "provider", label: tr("Mail provider"), type: "select",
          options: [{ value: "auto", label: tr("Detect from the address") }, ...Object.entries(mail.PRESETS).map(([value, p]) => ({ value, label: p.label })), { value: "custom", label: tr("Other (enter servers)") }],
        },
        { key: "imapHost", label: tr("IMAP server"), type: "text", placeholder: "imap.example.com", showIf: { key: "provider", value: "custom" } },
        { key: "imapPort", label: tr("IMAP port"), type: "number", placeholder: "993", optional: true, showIf: { key: "provider", value: "custom" } },
        { key: "smtpHost", label: tr("SMTP server"), type: "text", placeholder: "smtp.example.com", showIf: { key: "provider", value: "custom" } },
        { key: "smtpPort", label: tr("SMTP port"), type: "number", placeholder: "465", optional: true, showIf: { key: "provider", value: "custom" } },
      ];
    case "feishu":
      return [
        { key: "appId", label: "App ID", type: "text", placeholder: "cli_a1b2c3…", optional: true, help: tr("From a custom app on the Feishu Open Platform, with the bot feature and message permissions. Lets Cloud Duet read and send in chats the bot is in.") },
        { key: "appSecret", label: "App Secret", type: "password", optional: true },
        { key: "webhook", label: tr("Group bot webhook"), type: "url", placeholder: "https://open.feishu.cn/open-apis/bot/v2/hook/…", optional: true, help: tr("Or just post to one group: Group settings → Bots → Add bot → Custom bot.") },
        { key: "webhookSecret", label: tr("Signing secret"), type: "password", optional: true },
      ];
    case "dingtalk":
      return [
        { key: "webhook", label: tr("Group bot webhook"), type: "url", placeholder: "https://oapi.dingtalk.com/robot/send?access_token=…", help: tr("Group settings → Bots → Add robot → Custom. Choose Sign (加签) for security and paste the secret below.") },
        { key: "secret", label: tr("Signing secret"), type: "password", placeholder: "SEC…", optional: true },
      ];
    case "wecom":
      return [
        { key: "webhook", label: tr("Group bot webhook"), type: "url", placeholder: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…", help: tr("In a WeCom group: ⋯ → Group bots → Add. Copy its webhook URL.") },
      ];
  }
}

const INTRO: Record<DirectApp, string> = {
  mailbox: "Read, search and send from QQ Mail, NetEase 163/126, Sina, Aliyun, Tencent Exmail and any IMAP mailbox.",
  feishu: "Read and reply in Feishu chats, message colleagues, or post to a group.",
  dingtalk: "Post updates and reminders to a DingTalk group.",
  wecom: "Post updates and reminders to a WeCom group.",
};

const LINKS: Record<DirectApp, { label: string; url: string }[]> = {
  mailbox: [
    { label: "How to get a QQ Mail auth code", url: "https://service.mail.qq.com/detail/0/75" },
    { label: "NetEase 163 auth code", url: "https://help.mail.163.com/faqDetail.do?code=d7a5dc8471cd0c0e8b4b8f4f8e49998b374173cfe9171305fa1ce630d7f67ac2a5feb28b66796d3b" },
  ],
  feishu: [
    { label: "Feishu Open Platform", url: "https://open.feishu.cn/app" },
    { label: "Custom bot guide", url: "https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot" },
  ],
  dingtalk: [{ label: "DingTalk custom robot guide", url: "https://open.dingtalk.com/document/robots/custom-robot-access" }],
  wecom: [{ label: "WeCom group bot guide", url: "https://developer.work.weixin.qq.com/document/path/91770" }],
};

const hint = (v: string) => `…${v.slice(-4)}`;

export function form(app: DirectApp): DirectForm {
  const c = creds(app) ?? {};
  const values: Record<string, string> = {};
  const saved: Record<string, string> = {};
  for (const [k, v] of Object.entries(c)) {
    if (k === "allowPrivate") continue;
    if (SECRET.has(k)) saved[k] = hint(v);
    else values[k] = v;
  }
  if (app === "mailbox" && !values.provider) values.provider = "auto";
  return {
    id: app, intro: tr(INTRO[app]), fields: fields(app), values, saved, configured: !!creds(app),
    links: LINKS[app].map((l) => ({ label: tr(l.label), url: l.url })),
  };
}

/** What the connector shows as its account. */
function label(app: DirectApp, c: Creds) {
  if (app === "mailbox") return c.email;
  if (app === "feishu") return c.appId ? `App ${c.appId}` : tr("Group bot");
  return tr("Group bot");
}

/** Checks, tests and saves the form. Blank secrets keep what's saved. */
export async function save(app: DirectApp, input: Record<string, unknown>) {
  const prev = creds(app) ?? {};
  const next: Creds = {};
  for (const f of fields(app)) {
    const raw = typeof input[f.key] === "string" ? (input[f.key] as string).trim().slice(0, 2000) : "";
    const v = raw || (SECRET.has(f.key) ? prev[f.key] ?? "" : "");
    if (v) next[f.key] = v;
  }
  if (app === "mailbox") {
    if (!/^\S+@\S+\.\S+$/.test(next.email ?? "")) throw new Error(tr("Enter a valid email."));
    if (!next.password) throw new Error(tr("Enter the auth code."));
    next.provider ||= "auto";
    if (next.provider === "auto" && !mail.presetFor(next.email)) {
      throw new Error(tr("Cloud Duet doesn't know {domain}'s servers. Pick the provider, or choose Other and enter them.", { domain: next.email.split("@")[1] }));
    }
    if (next.provider !== "custom") for (const k of ["imapHost", "imapPort", "smtpHost", "smtpPort"]) delete next[k];
    if (prev.email && prev.email !== next.email && !input.password) throw new Error(tr("Enter the auth code."));
    await mail.verify({ ...(next as unknown as mail.MailCreds), allowPrivate: isOwner() });
  }
  if (app === "feishu") {
    if (!(next.appId && next.appSecret) && !next.webhook) throw new Error(tr("Enter an App ID and App Secret, a group bot webhook, or both."));
    if (!!next.appId !== !!next.appSecret) throw new Error(tr("Enter both the App ID and the App Secret."));
    if (next.webhook) {
      const bad = chat.checkHook("feishu", next.webhook);
      if (bad) throw new Error(bad);
    }
    if (next.appId) await chat.feishuToken(next.appId, next.appSecret);
  }
  if (app === "dingtalk" || app === "wecom") {
    if (!next.webhook) throw new Error(tr("Paste the group bot webhook URL."));
    const bad = chat.checkHook(app, next.webhook);
    if (bad) throw new Error(bad);
  }
  writeUserJson(FILE, { ...all(), [app]: next });
  patch<Connector>("connectors", app, { connected: true, real: true, direct: true, accounts: [label(app, next)] });
  return form(app);
}

export function remove(app: DirectApp) {
  const rest = all();
  delete rest[app];
  writeUserJson(FILE, rest);
  patch<Connector>("connectors", app, { connected: false, real: false, accounts: [] });
}

/** Set up and switched on. */
export function ready(app: DirectApp) {
  return !!creds(app) && !!state().connectors.find((c) => c.id === app && c.connected);
}

const need = (app: DirectApp) => {
  const c = creds(app);
  if (!c) throw new Error(tr("{app} isn't set up yet.", { app: state().connectors.find((x) => x.id === app)?.name ?? app }));
  return c;
};
const mailCreds = () => ({ ...(need("mailbox") as unknown as mail.MailCreds), allowPrivate: isOwner() });
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** Runs one operation and returns what the model reads. */
export async function run(app: DirectApp, op: string, args: Record<string, unknown>): Promise<unknown> {
  if (app === "mailbox") {
    if (op === "list") return mail.list(mailCreds(), { query: s(args.query), unreadOnly: !!args.unread_only, limit: Number(args.limit) || 10, folder: s(args.folder) || undefined });
    if (op === "read") return (await mail.read(mailCreds(), Number(args.uid), s(args.folder) || "INBOX")) ?? "No message with that uid.";
    if (op === "folders") return mail.folders(mailCreds());
    if (op === "send") {
      await mail.send(mailCreds(), { to: s(args.to), cc: s(args.cc) || undefined, subject: s(args.subject), body: s(args.body), inReplyTo: s(args.in_reply_to) || undefined });
      return "sent";
    }
  }
  if (app === "feishu") {
    const c = need("feishu");
    const token = async () => {
      if (!c.appId || !c.appSecret) throw new Error(tr("Reading Feishu needs an App ID and App Secret. A group bot webhook can only post."));
      return chat.feishuToken(c.appId, c.appSecret);
    };
    if (op === "chats") return chat.feishuChats(await token());
    if (op === "messages") return chat.feishuMessages(await token(), s(args.chat_id), Number(args.limit) || 20);
    if (op === "send") {
      if (args.chat_id || args.email) await chat.feishuSend(await token(), { chatId: s(args.chat_id) || undefined, email: s(args.email) || undefined }, s(args.text));
      else if (c.webhook) await chat.feishuHook(c.webhook, c.webhookSecret, s(args.text));
      else throw new Error(tr("Say which Feishu chat or person to send it to."));
      return "sent";
    }
  }
  if (app === "dingtalk" && op === "send") {
    const c = need("dingtalk");
    await chat.dingtalkHook(c.webhook, c.secret, s(args.text));
    return "sent";
  }
  if (app === "wecom" && op === "send") {
    await chat.wecomHook(need("wecom").webhook, s(args.text));
    return "sent";
  }
  throw new Error(`Unknown operation ${app}.${op}`);
}
