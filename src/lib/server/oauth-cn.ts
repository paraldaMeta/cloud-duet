// Sign in with QQ, WeChat, Feishu and DingTalk. Each turns on when its app
// credentials are in the environment. QQ and WeChat don't share an email, so
// those accounts are keyed by the provider's id; Feishu and DingTalk emails are
// set by the person's company and aren't treated as verified.
import { tr } from "./i18n";

export type CnProvider = "qq" | "wechat" | "feishu" | "dingtalk";
export const CN_PROVIDERS: CnProvider[] = ["qq", "wechat", "feishu", "dingtalk"];

const ENV: Record<CnProvider, [string, string]> = {
  qq: ["QQ_APP_ID", "QQ_APP_KEY"],
  wechat: ["WECHAT_APP_ID", "WECHAT_APP_SECRET"],
  feishu: ["FEISHU_APP_ID", "FEISHU_APP_SECRET"],
  dingtalk: ["DINGTALK_CLIENT_ID", "DINGTALK_CLIENT_SECRET"],
};

const NAMES: Record<CnProvider, string> = { qq: "QQ", wechat: "WeChat", feishu: "Feishu", dingtalk: "DingTalk" };
export const cnName = (p: CnProvider) => tr(NAMES[p]);

export const isCnProvider = (p: string): p is CnProvider => (CN_PROVIDERS as string[]).includes(p);
export const cnEnv = (p: CnProvider) => ENV[p].join(", ");
export const cnConfigured = (p: CnProvider) => ENV[p].every((k) => !!process.env[k]);

const id = (p: CnProvider) => process.env[ENV[p][0]]!;
const secret = (p: CnProvider) => process.env[ENV[p][1]]!;
const callback = (origin: string, p: CnProvider) => `${origin}/api/auth/${p}/callback`;

export function cnAuthUrl(p: CnProvider, origin: string, state: string): string {
  const redirect = callback(origin, p);
  switch (p) {
    case "qq":
      return `https://graph.qq.com/oauth2.0/authorize?${new URLSearchParams({ response_type: "code", client_id: id(p), redirect_uri: redirect, state, scope: "get_user_info" })}`;
    case "wechat":
      return `https://open.weixin.qq.com/connect/qrconnect?${new URLSearchParams({ appid: id(p), redirect_uri: redirect, response_type: "code", scope: "snsapi_login", state })}#wechat_redirect`;
    case "feishu":
      return `https://accounts.feishu.cn/open-apis/authen/v1/authorize?${new URLSearchParams({ client_id: id(p), redirect_uri: redirect, response_type: "code", state })}`;
    case "dingtalk":
      return `https://login.dingtalk.com/oauth2/auth?${new URLSearchParams({ client_id: id(p), redirect_uri: redirect, response_type: "code", scope: "openid", state, prompt: "consent" })}`;
  }
}

export interface CnProfile {
  sub: string;
  name?: string;
  email: string;
}

async function json(res: Response, p: CnProvider) {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(tr("{provider} sign-in failed ({status})", { provider: cnName(p), status: res.status }));
  }
}

const opts = () => ({ signal: AbortSignal.timeout(15_000) });

export async function cnExchange(p: CnProvider, origin: string, code: string): Promise<CnProfile> {
  const fail = (detail: unknown) => new Error(tr("{provider} sign-in failed ({status})", { provider: cnName(p), status: String(detail ?? "error").slice(0, 80) }));
  if (p === "qq") {
    const t = await json(await fetch(`https://graph.qq.com/oauth2.0/token?${new URLSearchParams({
      grant_type: "authorization_code", client_id: id(p), client_secret: secret(p), code, redirect_uri: callback(origin, p), fmt: "json",
    })}`, opts()), p);
    if (typeof t.access_token !== "string") throw fail(t.error_description ?? t.error);
    const me = await json(await fetch(`https://graph.qq.com/oauth2.0/me?access_token=${encodeURIComponent(t.access_token)}&fmt=json`, opts()), p);
    if (typeof me.openid !== "string" || me.client_id !== id(p)) throw fail(me.error_description ?? "openid");
    const info = await json(await fetch(`https://graph.qq.com/user/get_user_info?${new URLSearchParams({ access_token: t.access_token, oauth_consumer_key: id(p), openid: me.openid })}`, opts()), p);
    return { sub: me.openid, name: typeof info.nickname === "string" ? info.nickname : undefined, email: "" };
  }
  if (p === "wechat") {
    const t = await json(await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?${new URLSearchParams({ appid: id(p), secret: secret(p), code, grant_type: "authorization_code" })}`, opts()), p);
    if (typeof t.access_token !== "string" || typeof t.openid !== "string") throw fail(t.errmsg ?? t.errcode);
    const info = await json(await fetch(`https://api.weixin.qq.com/sns/userinfo?${new URLSearchParams({ access_token: t.access_token, openid: t.openid, lang: "zh_CN" })}`, opts()), p);
    // The unionid stays the same across a company's WeChat apps; the openid is per app.
    const sub = (typeof t.unionid === "string" && t.unionid) || (typeof info.unionid === "string" && info.unionid) || t.openid;
    return { sub, name: typeof info.nickname === "string" ? info.nickname : undefined, email: "" };
  }
  if (p === "feishu") {
    const t = await json(await fetch("https://open.feishu.cn/open-apis/authen/v2/oauth/token", {
      ...opts(), method: "POST", headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ grant_type: "authorization_code", client_id: id(p), client_secret: secret(p), code, redirect_uri: callback(origin, p) }),
    }), p);
    if (typeof t.access_token !== "string") throw fail(t.error_description ?? t.msg ?? t.code);
    const info = await json(await fetch("https://open.feishu.cn/open-apis/authen/v1/user_info", { ...opts(), headers: { authorization: `Bearer ${t.access_token}` } }), p);
    const d = (info.data ?? {}) as Record<string, string>;
    if (info.code !== 0 || !(d.union_id || d.open_id)) throw fail(info.msg ?? info.code);
    return { sub: d.union_id || d.open_id, name: d.name, email: d.enterprise_email || d.email || "" };
  }
  const t = await json(await fetch("https://api.dingtalk.com/v1.0/oauth2/userAccessToken", {
    ...opts(), method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId: id(p), clientSecret: secret(p), code, grantType: "authorization_code" }),
  }), p);
  if (typeof t.accessToken !== "string") throw fail(t.message ?? t.code);
  const info = await json(await fetch("https://api.dingtalk.com/v1.0/contact/users/me", { ...opts(), headers: { "x-acs-dingtalk-access-token": t.accessToken } }), p);
  const sub = (typeof info.unionId === "string" && info.unionId) || (typeof info.openId === "string" && info.openId);
  if (!sub) throw fail(info.message ?? info.code);
  return { sub, name: typeof info.nick === "string" ? info.nick : undefined, email: typeof info.email === "string" ? info.email : "" };
}
