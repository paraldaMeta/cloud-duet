// Cloud Duet's own browser. With a Browserbase key each task gets a cloud browser
// (with a live view you can watch); without one it runs a headless Chrome on
// this server. The model sees pages as numbered controls plus a screenshot.
// Passwords are typed into the page here and never reach the model or disk.
import fs from "node:fs";
import type { Browser, Page } from "playwright-core";
import { currentUserId } from "./context";
import { getKey } from "./keys";
import { tr } from "./i18n";
import { isPrivateHost } from "./net";

interface Session {
  browser: Browser;
  page: Page;
  liveUrl?: string;
  bb?: { id: string; projectId: string; key: string };
  lastUsed: number;
}

const g = globalThis as unknown as { __duetBrowsers?: Map<string, Session>; __duetBrowserSweep?: NodeJS.Timeout };
const sessions: Map<string, Session> = (g.__duetBrowsers ??= new Map());
const IDLE_MS = 15 * 60_000;
const MAX_PER_USER = 3;
const MAX_LOCAL = 6;
// Local Chrome runs inside this server's network, so it may only reach the public
// internet. BROWSER_ALLOW_PRIVATE=1 lifts that for local development.
const allowPrivate = () => process.env.BROWSER_ALLOW_PRIVATE === "1";

g.__duetBrowserSweep ??= setInterval(() => {
  for (const [k, s] of sessions) if (Date.now() - s.lastUsed > IDLE_MS) void closeKey(k);
}, 60_000);

const keyFor = (taskId: string) => `${currentUserId()}:${taskId}`;

function chromePath() {
  const candidates = [process.env.CHROME_PATH, "/usr/local/bin/google-chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  const found = candidates.find((p) => p && fs.existsSync(p));
  if (!found) throw new Error("No browser available. Add a Browserbase key in Profile → Keys & services, or install Chrome and set CHROME_PATH.");
  return found;
}

async function bb<T>(key: string, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`https://api.browserbase.com/v1${path}`, {
    method: init?.method ?? "GET",
    headers: { "X-BB-API-Key": key, "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Browserbase ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return (await res.json()) as T;
}

export function browserKind() {
  return getKey("browserbase") ? "Browserbase" : tr("this server's Chrome");
}

async function open(taskId: string): Promise<Session> {
  const k = keyFor(taskId);
  const cur = sessions.get(k);
  if (cur && cur.browser.isConnected()) {
    cur.lastUsed = Date.now();
    return cur;
  }
  const uid = currentUserId();
  if ([...sessions.keys()].filter((x) => x.startsWith(`${uid}:`)).length >= MAX_PER_USER) {
    throw new Error("Too many browser tasks are open. Finish one first.");
  }
  const { chromium } = await import("playwright-core");
  const key = getKey("browserbase");
  let s: Session;
  if (key) {
    const projectId = getKey("browserbaseProject");
    const made = await bb<{ id: string; projectId: string; connectUrl: string }>(key, "/sessions", {
      method: "POST",
      body: { ...(projectId ? { projectId } : {}), timeout: 30 * 60, userMetadata: { app: "duet" } },
    });
    const browser = await chromium.connectOverCDP(made.connectUrl);
    const ctx = browser.contexts()[0] ?? (await browser.newContext());
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    let liveUrl: string | undefined;
    try {
      liveUrl = (await bb<{ debuggerFullscreenUrl?: string }>(key, `/sessions/${made.id}/debug`)).debuggerFullscreenUrl;
    } catch {}
    s = { browser, page, liveUrl, bb: { id: made.id, projectId: made.projectId, key }, lastUsed: Date.now() };
  } else {
    if ([...sessions.values()].filter((x) => !x.bb).length >= MAX_LOCAL) throw new Error("This server's browser is busy. Try again in a few minutes.");
    // Chrome's sandbox can't start as root (containers); everywhere else keep it on.
    const args = ["--disable-dev-shm-usage", ...(process.getuid?.() === 0 ? ["--no-sandbox"] : [])];
    const browser = await chromium.launch({ executablePath: chromePath(), headless: true, args });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: "en-US", acceptDownloads: false });
    if (!allowPrivate()) {
      const seen = new Map<string, boolean>();
      await ctx.route("**/*", async (route) => {
        let u: URL;
        try {
          u = new URL(route.request().url());
        } catch {
          return route.abort("blockedbyclient");
        }
        if (u.protocol === "data:" || u.protocol === "blob:") return route.continue();
        if (u.protocol !== "http:" && u.protocol !== "https:") return route.abort("blockedbyclient");
        if (!seen.has(u.hostname)) seen.set(u.hostname, await isPrivateHost(u.hostname));
        return seen.get(u.hostname) ? route.abort("blockedbyclient") : route.continue();
      });
    }
    s = { browser, page: await ctx.newPage(), lastUsed: Date.now() };
  }
  sessions.set(k, s);
  return s;
}

async function closeKey(k: string) {
  const s = sessions.get(k);
  if (!s) return;
  sessions.delete(k);
  await s.browser.close().catch(() => {});
  if (s.bb) await bb(s.bb.key, `/sessions/${s.bb.id}`, { method: "POST", body: { projectId: s.bb.projectId, status: "REQUEST_RELEASE" } }).catch(() => {});
}

export const closeBrowser = (taskId: string) => closeKey(keyFor(taskId));

export const hasSession = (taskId: string) => sessions.has(keyFor(taskId));

export async function currentHost(taskId: string) {
  try {
    return new URL((await open(taskId)).page.url()).host || tr("the site");
  } catch {
    return tr("the site");
  }
}

interface PendingLogin { uid: string; taskId: string; user?: string; pass: string; submit?: string }
const gl = globalThis as unknown as { __duetLogins?: Map<string, PendingLogin> };
const logins: Map<string, PendingLogin> = (gl.__duetLogins ??= new Map());

/** Remembers which fields a sign-in card fills, keyed by the card's message id. */
export function expectLogin(messageId: string, l: Omit<PendingLogin, "uid">) {
  logins.set(messageId, { ...l, uid: currentUserId() });
}

export function takeLogin(messageId: string): PendingLogin | undefined {
  const l = logins.get(messageId);
  if (!l || l.uid !== currentUserId()) return undefined;
  logins.delete(messageId);
  return l;
}

export async function liveUrl(taskId: string) {
  return (await open(taskId)).liveUrl;
}

export interface PageView {
  url: string;
  title: string;
  controls: { ref: string; kind: string; label: string; value?: string }[];
  text: string;
  image: string;
}

/** Tags every visible control with a ref and reads the page. */
export async function look(taskId: string): Promise<PageView> {
  const { page } = await open(taskId);
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  const data = await page.evaluate(() => {
    const out: { ref: string; kind: string; label: string; value?: string }[] = [];
    const sel = "a[href],button,input,select,textarea,[role=button],[role=link],[role=checkbox],[role=tab],[contenteditable=true]";
    let n = 0;
    for (const old of Array.from(document.querySelectorAll("[data-duet-ref]"))) old.removeAttribute("data-duet-ref");
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (r.width < 2 || r.height < 2 || st.visibility === "hidden" || st.display === "none") continue;
      if ((el as HTMLInputElement).type === "hidden") continue;
      const ref = String(++n);
      el.setAttribute("data-duet-ref", ref);
      const input = el as HTMLInputElement;
      const id = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      const label = (el.getAttribute("aria-label") || (id && id.textContent) || input.placeholder || el.innerText || input.name || el.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 80);
      const tag = el.tagName.toLowerCase();
      const kind = tag === "input" ? `input:${input.type || "text"}` : tag === "a" ? "link" : el.getAttribute("role") || tag;
      const value = tag === "input" || tag === "textarea" || tag === "select" ? (input.type === "password" ? (input.value ? "(filled)" : "") : input.type === "checkbox" ? String(input.checked) : input.value) : undefined;
      out.push({ ref, kind, label, ...(value ? { value: value.slice(0, 80) } : {}) });
      if (n >= 90) break;
    }
    return { controls: out, text: document.body?.innerText.replace(/\n{3,}/g, "\n\n").slice(0, 3500) ?? "" };
  });
  const shot = await page.screenshot({ type: "jpeg", quality: 55 });
  return { url: page.url(), title: await page.title(), ...data, image: `data:image/jpeg;base64,${shot.toString("base64")}` };
}

export async function goto(taskId: string, url: string) {
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("That isn't a valid web address.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http(s) pages can be opened.");
  if (!allowPrivate() && (await isPrivateHost(u.hostname))) throw new Error("That address is on a private network, so it can't be opened.");
  const { page } = await open(taskId);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(800);
}

const at = async (taskId: string, ref: string) => (await open(taskId)).page.locator(`[data-duet-ref="${ref.replace(/\D/g, "")}"]`).first();

export async function click(taskId: string, ref: string) {
  const { page } = await open(taskId);
  await (await at(taskId, ref)).click({ timeout: 10_000 });
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(900);
}

/**
 * Whether activating this control (a click, or Enter in a field) would submit a
 * form or look like a final action. Those go through browser_submit and the
 * person's approval instead.
 */
export async function submits(taskId: string, ref: string, enter: boolean): Promise<boolean> {
  const el = await at(taskId, ref);
  return el.evaluate((e, enter) => {
    const tag = e.tagName.toLowerCase();
    const type = ((e as HTMLInputElement).type || "").toLowerCase();
    const form = (e as HTMLInputElement).form ?? e.closest("form");
    if (enter) return !!form && tag !== "textarea";
    if (tag === "input" && (type === "submit" || type === "image")) return true;
    if (tag === "button" && form && type !== "button" && type !== "reset") return true;
    const label = `${e.getAttribute("aria-label") ?? ""} ${(e as HTMLElement).innerText ?? ""} ${(e as HTMLInputElement).value ?? ""}`.toLowerCase();
    return /\b(submit|buy|pay|purchase|place order|checkout|check out|send|book|reserve|confirm|register|sign up|subscribe|delete|remove|transfer)\b/.test(label);
  }, enter);
}

export async function type(taskId: string, ref: string, text: string, submit = false) {
  const el = await at(taskId, ref);
  if ((await el.getAttribute("type")) === "password") throw new Error("That's a password field. Ask the person to sign in with request_login instead.");
  const tag = await el.evaluate((e) => e.tagName.toLowerCase());
  if (tag === "select") await el.selectOption({ label: text }).catch(() => el.selectOption(text));
  else await el.fill(text, { timeout: 10_000 });
  if (submit) {
    await el.press("Enter");
    await (await open(taskId)).page.waitForTimeout(1200);
  }
}

export async function scroll(taskId: string, direction: "down" | "up") {
  const { page } = await open(taskId);
  await page.mouse.wheel(0, direction === "down" ? 700 : -700);
  await page.waitForTimeout(400);
}

export async function back(taskId: string) {
  const { page } = await open(taskId);
  await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
}

/** Types the person's login into the page. The password is never stored or returned. */
export async function fillLogin(taskId: string, refs: { user?: string; pass: string; submit?: string }, email: string, password: string) {
  if (refs.user) await (await at(taskId, refs.user)).fill(email, { timeout: 10_000 });
  await (await at(taskId, refs.pass)).fill(password, { timeout: 10_000 });
  if (refs.submit) await click(taskId, refs.submit);
  else {
    await (await at(taskId, refs.pass)).press("Enter");
    await (await open(taskId)).page.waitForTimeout(1500);
  }
}
