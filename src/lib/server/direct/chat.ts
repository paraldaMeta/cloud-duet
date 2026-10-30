// Feishu, DingTalk and WeCom. Feishu can use a custom app (App ID and Secret)
// to read and send in chats its bot is in, or a group bot webhook to post; DingTalk
// and WeCom post through group bot webhooks, signed when a secret is set.
import { createHmac } from "node:crypto";
import { tr } from "../i18n";

const FEISHU = "https://open.feishu.cn";

/** Webhook hosts each app really uses, so a saved URL can't point anywhere else. */
const HOOKS: Record<"feishu" | "dingtalk" | "wecom", RegExp> = {
  feishu: /^https:\/\/open\.(feishu\.cn|larksuite\.com)\/open-apis\/bot\/v2\/hook\/[\w-]+$/,
  dingtalk: /^https:\/\/oapi\.dingtalk\.com\/robot\/send\?access_token=\w+$/,
  wecom: /^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=[\w-]+$/,
};

export function checkHook(app: keyof typeof HOOKS, url: string): string | null {
  return HOOKS[app].test(url.trim()) ? null : tr("That doesn't look like a {app} group bot webhook URL.", { app: tr(app === "feishu" ? "Feishu" : app === "dingtalk" ? "DingTalk" : "WeCom") });
}

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

// ── Feishu app ───────────────────────────────────────────────────────────

const g = globalThis as unknown as { __duetFeishuTokens?: Map<string, { token: string; until: number }> };
const tokens: Map<string, { token: string; until: number }> = (g.__duetFeishuTokens ??= new Map());

export async function feishuToken(appId: string, appSecret: string): Promise<string> {
  const key = `${appId}:${createHmac("sha256", appSecret).update(appId).digest("hex")}`;
  const hit = tokens.get(key);
  if (hit && hit.until > Date.now()) return hit.token;
  const { json } = await post(`${FEISHU}/open-apis/auth/v3/tenant_access_token/internal`, { app_id: appId, app_secret: appSecret });
  if (json.code !== 0 || typeof json.tenant_access_token !== "string") {
    throw new Error(tr("Feishu didn't accept that App ID and App Secret ({msg}).", { msg: String(json.msg ?? json.code ?? "error") }));
  }
  tokens.set(key, { token: json.tenant_access_token, until: Date.now() + (Number(json.expire) || 7200) * 1000 - 300_000 });
  return json.tenant_access_token;
}

async function feishu(token: string, method: "GET" | "POST", path: string, body?: unknown) {
  const res = await fetch(`${FEISHU}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=utf-8" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { code?: number; msg?: string; data?: Record<string, unknown> };
  if (json.code !== 0) throw new Error(tr("Feishu: {msg}", { msg: json.msg ?? `HTTP ${res.status}` }));
  return json.data ?? {};
}

/** Group chats the app's bot has been added to. */
export async function feishuChats(token: string) {
  const d = await feishu(token, "GET", "/open-apis/im/v1/chats?page_size=50");
  return ((d.items as Record<string, string>[]) ?? []).map((c) => ({ chat_id: c.chat_id, name: c.name, description: c.description }));
}

function feishuText(type: string, content: string) {
  try {
    const c = JSON.parse(content) as Record<string, unknown>;
    if (type === "text") return String(c.text ?? "");
    if (type === "post") {
      const post = (c.content ?? (Object.values(c)[0] as Record<string, unknown>)?.content) as { text?: string }[][] | undefined;
      return [c.title, ...(post ?? []).map((line) => line.map((x) => x.text ?? "").join(""))].filter(Boolean).join("\n");
    }
    return `[${type}]`;
  } catch {
    return `[${type}]`;
  }
}

export async function feishuMessages(token: string, chatId: string, limit = 20) {
  const n = Math.min(Math.max(limit, 1), 50);
  const d = await feishu(token, "GET", `/open-apis/im/v1/messages?container_id_type=chat&container_id=${encodeURIComponent(chatId)}&sort_type=ByCreateTimeDesc&page_size=${n}`);
  return ((d.items as Record<string, unknown>[]) ?? []).map((m) => ({
    from: (m.sender as { id?: string; sender_type?: string } | undefined)?.sender_type === "app" ? "bot" : (m.sender as { id?: string } | undefined)?.id,
    at: new Date(Number(m.create_time)).toISOString(),
    text: feishuText(String(m.msg_type), String((m.body as { content?: string } | undefined)?.content ?? "")).slice(0, 2000),
  }));
}

/** Sends a text message to a chat id, or to a person by their work email. */
export async function feishuSend(token: string, to: { chatId?: string; email?: string }, text: string) {
  const type = to.chatId ? "chat_id" : "email";
  const id = to.chatId || to.email;
  if (!id) throw new Error(tr("Say which Feishu chat or person to send it to."));
  await feishu(token, "POST", `/open-apis/im/v1/messages?receive_id_type=${type}`, { receive_id: id, msg_type: "text", content: JSON.stringify({ text }) });
}

// ── group bot webhooks ───────────────────────────────────────────────────

export async function feishuHook(url: string, secret: string | undefined, text: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sign = secret ? createHmac("sha256", `${timestamp}\n${secret}`).update("").digest("base64") : undefined;
  const { json } = await post(url, { ...(sign ? { timestamp, sign } : {}), msg_type: "text", content: { text } });
  const code = json.code ?? json.StatusCode;
  if (code !== 0) throw new Error(tr("Feishu: {msg}", { msg: String(json.msg ?? json.StatusMessage ?? code) }));
}

export async function dingtalkHook(url: string, secret: string | undefined, text: string) {
  let target = url;
  if (secret) {
    const timestamp = Date.now();
    const sign = createHmac("sha256", secret).update(`${timestamp}\n${secret}`).digest("base64");
    target += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
  }
  const { json } = await post(target, { msgtype: "text", text: { content: text } });
  if (json.errcode !== 0) {
    // 310000 is DingTalk's security check: a missing keyword, a bad signature or a blocked IP.
    const hint = json.errcode === 310000 ? tr(" Check the bot's security settings: its keyword must appear in the message, or set the signing secret.") : "";
    throw new Error(tr("DingTalk: {msg}", { msg: String(json.errmsg ?? json.errcode) }) + hint);
  }
}

export async function wecomHook(url: string, text: string) {
  const { json } = await post(url, { msgtype: "text", text: { content: text } });
  if (json.errcode !== 0) throw new Error(tr("WeCom: {msg}", { msg: String(json.errmsg ?? json.errcode) }));
}
