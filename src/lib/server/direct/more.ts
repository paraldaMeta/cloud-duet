// WeChat notifications through Server酱 or PushPlus, Yuque docs, and web search
// through Bocha (博查) or Tavily for models without a search of their own.
import { tr } from "../i18n";

const timeout = () => AbortSignal.timeout(15_000);

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
    body: JSON.stringify(body),
    signal: timeout(),
    redirect: "error",
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

// ── WeChat notifications ─────────────────────────────────────────────────

/** Sends a message to the person's own WeChat. */
export async function wxpush(service: string, key: string, title: string, text: string) {
  if (service === "pushplus") {
    const { json } = await postJson("https://www.pushplus.plus/send", { token: key, title: title.slice(0, 100), content: text, template: "markdown" });
    if (json.code !== 200) throw new Error(tr("PushPlus: {msg}", { msg: String(json.msg ?? json.code) }));
    return;
  }
  // Server酱³ keys carry the user id (sctp<uid>t…) and use their own host.
  const uid = /^sctp(\d+)t/i.exec(key)?.[1];
  if (!/^[\w-]+$/.test(key)) throw new Error(tr("That SendKey doesn't look right."));
  const url = uid ? `https://${uid}.push.ft07.com/send/${key}.send` : `https://sctapi.ftqq.com/${key}.send`;
  const { json } = await postJson(url, { title: title.slice(0, 32), desp: text });
  if (json.code !== 0) throw new Error(tr("Server酱: {msg}", { msg: String(json.message ?? json.info ?? json.code) }));
}

// ── Yuque ────────────────────────────────────────────────────────────────

export interface YuqueCreds {
  token: string;
  host?: string;
  login?: string;
}

export function yuqueHost(raw?: string) {
  const host = (raw || "https://www.yuque.com").trim().replace(/\/+$/, "");
  let u: URL;
  try {
    u = new URL(host);
  } catch {
    throw new Error(tr("Use your Yuque address, like https://www.yuque.com or https://yourteam.yuque.com."));
  }
  if (u.protocol !== "https:" || !(u.hostname === "yuque.com" || u.hostname.endsWith(".yuque.com"))) {
    throw new Error(tr("Use your Yuque address, like https://www.yuque.com or https://yourteam.yuque.com."));
  }
  return u.origin;
}

async function yuque(c: YuqueCreds, method: "GET" | "POST", path: string, body?: unknown) {
  const res = await fetch(`${yuqueHost(c.host)}/api/v2${path}`, {
    method,
    headers: { "X-Auth-Token": c.token, "User-Agent": "Cloud Duet", "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: timeout(),
    redirect: "error",
  });
  const json = (await res.json().catch(() => ({}))) as { data?: unknown; message?: string };
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error(tr("Yuque didn't accept that token ({msg}). Personal tokens need a Yuque membership.", { msg: json.message ?? res.status }));
    throw new Error(tr("Yuque: {msg}", { msg: json.message ?? `HTTP ${res.status}` }));
  }
  return json.data;
}

export async function yuqueMe(c: YuqueCreds) {
  const d = (await yuque(c, "GET", "/user")) as { login?: string; name?: string };
  if (!d?.login) throw new Error(tr("Yuque: {msg}", { msg: "no user" }));
  return { login: d.login, name: d.name ?? d.login };
}

const pick = <T extends Record<string, unknown>>(o: T, keys: string[]) => Object.fromEntries(keys.filter((k) => o[k] != null).map((k) => [k, o[k]]));

export async function yuqueRepos(c: YuqueCreds) {
  const login = c.login ?? (await yuqueMe(c)).login;
  const list = ((await yuque(c, "GET", `/users/${encodeURIComponent(login)}/repos?type=Book&limit=100`)) as Record<string, unknown>[]) ?? [];
  return list.map((r) => pick(r, ["namespace", "name", "description", "items_count", "updated_at"]));
}

export async function yuqueDocs(c: YuqueCreds, namespace: string) {
  const list = ((await yuque(c, "GET", `/repos/${namespace.split("/").map(encodeURIComponent).join("/")}/docs?limit=100`)) as Record<string, unknown>[]) ?? [];
  return list.map((d) => pick(d, ["slug", "title", "description", "updated_at", "word_count"]));
}

export async function yuqueRead(c: YuqueCreds, namespace: string, slug: string) {
  const d = (await yuque(c, "GET", `/repos/${namespace.split("/").map(encodeURIComponent).join("/")}/docs/${encodeURIComponent(slug)}`)) as Record<string, unknown>;
  const body = String(d.body ?? "");
  return { title: d.title, updated_at: d.updated_at, url: `${yuqueHost(c.host)}/${namespace}/${slug}`, body: body.length > 12000 ? `${body.slice(0, 12000)}… (truncated)` : body };
}

export async function yuqueSearch(c: YuqueCreds, q: string) {
  const list = ((await yuque(c, "GET", `/search?type=doc&q=${encodeURIComponent(q)}`)) as Record<string, unknown>[]) ?? [];
  return list.slice(0, 15).map((r) => {
    const target = (r.target ?? {}) as Record<string, unknown>;
    const book = (target.book ?? {}) as Record<string, unknown>;
    return { title: String(r.title ?? target.title ?? "").replace(/<[^>]+>/g, ""), summary: String(r.summary ?? "").replace(/<[^>]+>/g, "").slice(0, 300), namespace: book.namespace, slug: target.slug, url: r.url };
  });
}

export async function yuqueCreate(c: YuqueCreds, namespace: string, title: string, body: string) {
  const d = (await yuque(c, "POST", `/repos/${namespace.split("/").map(encodeURIComponent).join("/")}/docs`, { title, body, format: "markdown" })) as Record<string, unknown>;
  return { url: `${yuqueHost(c.host)}/${namespace}/${d.slug}`, slug: d.slug };
}

// ── web search ───────────────────────────────────────────────────────────

export async function webSearch(service: "bocha" | "tavily", key: string, query: string, count = 8) {
  const n = Math.min(Math.max(count, 1), 10);
  if (service === "bocha") {
    const { status, json } = await postJson("https://api.bochaai.com/v1/web-search", { query, summary: true, count: n, freshness: "noLimit" }, { authorization: `Bearer ${key}` });
    const data = json.data as { webPages?: { value?: Record<string, string>[] } } | undefined;
    if (status !== 200 || !data) throw new Error(tr("Bocha search failed: {msg}", { msg: String(json.msg ?? json.message ?? status) }));
    return (data.webPages?.value ?? []).map((r) => ({ title: r.name, url: r.url, site: r.siteName, date: r.datePublished || r.dateLastCrawled, text: (r.summary || r.snippet || "").slice(0, 800) }));
  }
  const { status, json } = await postJson("https://api.tavily.com/search", { query, max_results: n }, { authorization: `Bearer ${key}` });
  if (status !== 200) throw new Error(tr("Tavily search failed: {msg}", { msg: String((json.detail as { error?: string } | undefined)?.error ?? json.detail ?? status) }));
  return ((json.results as Record<string, string>[]) ?? []).map((r) => ({ title: r.title, url: r.url, date: r.published_date, text: (r.content ?? "").slice(0, 800) }));
}
