// Accounts and sessions. Email and password works with no setup; Google and
// Apple sign-in turn on when their OAuth credentials are in the environment.
// Sessions are an HMAC-signed account id plus a session id in an httpOnly
// cookie; the session id must still be on the account, so signing out ends it.
import fs from "node:fs";
import path from "node:path";
import { createHmac, createPrivateKey, randomBytes, randomUUID, scrypt, sign as cryptoSign, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { currentUserId, DATA_DIR, runAs, userDir } from "./context";
import { readJson, writeJson } from "./fsx";
import { defaultConnectors } from "./fixtures";
import { set, state, upsert } from "./store";
import { tr } from "./i18n";

export interface Account {
  id: string;
  email: string;
  name: string;
  password?: { salt: string; hash: string };
  googleSub?: string;
  appleSub?: string;
  createdAt: string;
  /** The first account owns the server: it may use keys set in the environment. */
  owner?: boolean;
  sessions?: { id: string; at: number }[];
}

const USERS = path.join(DATA_DIR, "users.json");
const COOKIE = "duet_sid";

const SESSION_DAYS = 180;
const MAX_SESSIONS = 20;

export function accounts(): Account[] {
  const list = readJson<Account[]>(USERS, []);
  // Accounts from before ownership existed: the oldest one owns the server.
  if (list.length && !list.some((a) => a.owner)) list[0].owner = true;
  return list;
}

function saveAccounts(list: Account[]) {
  writeJson(USERS, list);
}

/**
 * Whether the signed-in account may fall back to keys from the environment.
 * Only the owner can, unless SHARED_KEYS_FOR lists the email (or is "*"), so
 * strangers who sign up never spend the operator's keys.
 */
export function mayUseEnvKeys(): boolean {
  let uid: string;
  try {
    uid = currentUserId();
  } catch {
    return false;
  }
  const a = accounts().find((x) => x.id === uid);
  if (!a) return false;
  if (a.owner) return true;
  const shared = (process.env.SHARED_KEYS_FOR ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return shared.includes("*") || shared.includes(a.email);
}

/** New accounts after the first need ALLOW_SIGNUP not set to false, and an email on ALLOWED_EMAILS when that's set. */
function signupAllowed(email: string, list: Account[]) {
  if (!list.length) return true;
  if (process.env.ALLOW_SIGNUP === "false") return false;
  const allowed = (process.env.ALLOWED_EMAILS ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return !allowed.length || allowed.includes(email) || allowed.some((x) => x.startsWith("@") && email.endsWith(x));
}

function secret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const file = path.join(DATA_DIR, "auth-secret");
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    const s = randomBytes(32).toString("hex");
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(file, s, { mode: 0o600 });
    return s;
  }
}

const mac = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

function cookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {}
  }
  return out;
}

export function readCookie(req: Request, name: string) {
  return cookies(req)[name];
}

export function accountFromRequest(req: Request): Account | null {
  const raw = cookies(req)[COOKIE];
  if (!raw) return null;
  const [uid, sid, sig] = raw.split(".");
  if (!uid || !sid || !sig) return null;
  const want = Buffer.from(mac(`${uid}.${sid}`));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const a = accounts().find((x) => x.id === uid);
  const session = a?.sessions?.find((x) => x.id === sid);
  if (!a || !session || Date.now() - session.at > SESSION_DAYS * 86400_000) return null;
  return a;
}

const secure = (req: Request) => publicOrigin(req).startsWith("https:");

/** Starts a new session for the account and returns its cookie. */
export function sessionCookie(req: Request, uid: string) {
  const list = accounts();
  const a = list.find((x) => x.id === uid);
  if (!a) throw new Error("No such account");
  const sid = randomBytes(16).toString("base64url");
  const cutoff = Date.now() - SESSION_DAYS * 86400_000;
  a.sessions = [...(a.sessions ?? []).filter((x) => x.at > cutoff), { id: sid, at: Date.now() }].slice(-MAX_SESSIONS);
  saveAccounts(list);
  return `${COOKIE}=${uid}.${sid}.${mac(`${uid}.${sid}`)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure(req) ? "; Secure" : ""}`;
}

/** Ends the session the request carries, on the server as well as in the browser. */
export function endSession(req: Request) {
  const [uid, sid] = (cookies(req)[COOKIE] ?? "").split(".");
  if (!uid || !sid || !accountFromRequest(req)) return;
  const list = accounts();
  const a = list.find((x) => x.id === uid);
  if (!a?.sessions) return;
  a.sessions = a.sessions.filter((x) => x.id !== sid);
  saveAccounts(list);
}

/** Rejects cross-site writes (login CSRF, forged form posts). */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  try {
    const o = new URL(origin);
    return o.host === new URL(publicOrigin(req)).host || o.host === req.headers.get("host");
  } catch {
    return false;
  }
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** The origin people reach this app at, for OAuth and Composio callbacks. */
export function publicOrigin(req: Request): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const h = req.headers;
  // Forwarded headers are only trusted behind a proxy that sets them (TRUST_PROXY=1).
  const proxied = process.env.TRUST_PROXY === "1";
  const host = (proxied && h.get("x-forwarded-host")) || h.get("host");
  const proto = (proxied && h.get("x-forwarded-proto")?.split(",")[0]) || new URL(req.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

// ── passwords ───────────────────────────────────────────────────────────

const scryptAsync = promisify(scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

async function hashPassword(pw: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: (await scryptAsync(pw, salt, 64)).toString("hex") };
}

async function checkPassword(a: Account, pw: string) {
  if (!a.password) return false;
  const h = Buffer.from((await hashPassword(pw, a.password.salt)).hash, "hex");
  const want = Buffer.from(a.password.hash, "hex");
  return h.length === want.length && timingSafeEqual(h, want);
}

// Failed sign-ins per email and per client address, kept in memory.
const g = globalThis as unknown as { __duetFails?: Map<string, number[]> };
const fails: Map<string, number[]> = (g.__duetFails ??= new Map());
const WINDOW = 15 * 60_000;
const MAX_FAILS = 8;

function recent(key: string) {
  const list = (fails.get(key) ?? []).filter((t) => Date.now() - t < WINDOW);
  if (list.length) fails.set(key, list);
  else fails.delete(key);
  return list;
}

export function tooManyAttempts(...keys: string[]) {
  return keys.some((k) => recent(k).length >= MAX_FAILS);
}

function noteFailure(...keys: string[]) {
  for (const k of keys) fails.set(k, [...recent(k), Date.now()]);
}

const nameFromEmail = (email: string) => {
  const local = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, "").trim();
  return local ? local.replace(/\b\w/g, (c) => c.toUpperCase()) : "Friend";
};

/** Signs in, or creates the account on first use. `client` is the caller's address, for throttling. */
export async function emailSignIn(email: string, password: string, name: string | undefined, client?: string): Promise<{ account?: Account; error?: string; created?: boolean }> {
  const e = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(e) || e.length > 254) return { error: tr("Enter a valid email.") };
  if (password.length < 8) return { error: tr("Use at least 8 characters for your password.") };
  if (password.length > 1024) return { error: tr("That password is too long.") };
  const keys = client ? [`e:${e}`, `c:${client}`] : [`e:${e}`];
  if (tooManyAttempts(...keys)) return { error: tr("Too many attempts. Wait a few minutes and try again.") };
  const list = accounts();
  const found = list.find((a) => a.email === e);
  if (found) {
    if (found.password && (await checkPassword(found, password))) return { account: found };
    noteFailure(...keys);
    return { error: tr("That email and password don't match.") };
  }
  if (!signupAllowed(e, list)) {
    noteFailure(...keys);
    return { error: tr("New accounts aren't open on this server.") };
  }
  const account = createAccount({ email: e, name: name?.trim().slice(0, 80) || nameFromEmail(e), password: await hashPassword(password) });
  return { account, created: true };
}

/**
 * Finds or creates the account for an OAuth identity. An existing account with
 * the same email is only linked when the provider verified the email and the
 * account has no password, so nobody can pre-register someone else's address.
 */
export function oauthSignIn(provider: "google" | "apple", sub: string, email: string, verified: boolean, name?: string): Account {
  const key = provider === "google" ? "googleSub" : "appleSub";
  const list = accounts();
  const e = verified ? email.trim().toLowerCase() : "";
  const byId = list.find((a) => a[key] === sub);
  if (byId) return byId;
  const byEmail = e ? list.find((a) => a.email === e) : undefined;
  if (byEmail) {
    if (byEmail.password || byEmail[key]) throw new Error(tr("That email already has an account. Sign in the way you did before."));
    byEmail[key] = sub;
    saveAccounts(list);
    return byEmail;
  }
  const newEmail = e || `${sub.slice(0, 8)}@${provider}.user`;
  if (!signupAllowed(newEmail, list)) throw new Error(tr("New accounts aren't open on this server."));
  return createAccount({ email: newEmail, name: name?.trim().slice(0, 80) || nameFromEmail(e || "friend"), [key]: sub });
}

function createAccount(input: Omit<Account, "id" | "createdAt">): Account {
  const list = accounts();
  const account: Account = { id: randomUUID().replace(/-/g, "").slice(0, 16), createdAt: new Date().toISOString(), ...input, ...(list.length ? {} : { owner: true }) };
  // The first account inherits the workspace from before accounts existed.
  if (!list.length) {
    for (const f of ["state.json", "model.json"]) {
      const from = path.join(/*turbopackIgnore: true*/ DATA_DIR, f);
      if (fs.existsSync(from)) fs.renameSync(from, path.join(/*turbopackIgnore: true*/ userDir(account.id), f));
    }
  }
  saveAccounts([...list, account]);
  return account;
}

/** Makes sure the account's workspace knows who it belongs to. */
export function touchWorkspace(account: Account, timezone?: string) {
  runAs(account.id, () => {
    const s = state();
    const name = s.user.name && s.user.signedIn ? s.user.name : account.name;
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
    set("user", {
      ...s.user, name, firstName: name.split(" ")[0], email: account.email, initials, signedIn: true,
      timezone: timezone || s.user.timezone || "UTC",
    });
    if (!s.connectors.some((c) => c.accounts.length)) {
      for (const c of defaultConnectors(account.email)) upsert("connectors", { ...c, connected: s.connectors.find((x) => x.id === c.id)?.connected ?? c.connected });
    }
  });
}

// ── OAuth ───────────────────────────────────────────────────────────────

export const providers = () => ({
  google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  apple: !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY),
});

export const newState = () => randomBytes(16).toString("hex");

export function googleAuthUrl(origin: string, st: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: `${origin}/api/auth/google/callback`, response_type: "code",
    scope: "openid email profile", state: st, prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function googleExchange(origin: string, code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/auth/google/callback`, grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(tr("Google sign-in failed ({status})", { status: res.status }));
  const { access_token } = (await res.json()) as { access_token: string };
  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${access_token}` } });
  if (!info.ok) throw new Error(tr("Couldn't read your Google profile"));
  const p = (await info.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string };
  return { sub: p.sub, email: p.email ?? "", verified: p.email_verified === true, name: p.name };
}

export function appleAuthUrl(origin: string, st: string) {
  const p = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID!, redirect_uri: `${origin}/api/auth/apple/callback`, response_type: "code",
    response_mode: "form_post", scope: "name email", state: st,
  });
  return `https://appleid.apple.com/auth/authorize?${p}`;
}

/** Apple's client secret is a short-lived ES256 JWT signed with your .p8 key. */
function appleClientSecret() {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: process.env.APPLE_KEY_ID });
  const body = b64({ iss: process.env.APPLE_TEAM_ID, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: process.env.APPLE_CLIENT_ID });
  const key = createPrivateKey(process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n"));
  const sig = cryptoSign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${head}.${body}.${sig}`;
}

export async function appleExchange(origin: string, code: string) {
  const res = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: process.env.APPLE_CLIENT_ID!, client_secret: appleClientSecret(),
      redirect_uri: `${origin}/api/auth/apple/callback`, grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(tr("Apple sign-in failed ({status})", { status: res.status }));
  const { id_token } = (await res.json()) as { id_token: string };
  // Fetched straight from Apple over TLS with our client secret, so the claims are trusted.
  const claims = JSON.parse(Buffer.from(id_token.split(".")[1], "base64url").toString()) as { sub: string; email?: string; email_verified?: boolean | string };
  return { sub: claims.sub, email: claims.email ?? "", verified: claims.email_verified === true || claims.email_verified === "true" };
}
