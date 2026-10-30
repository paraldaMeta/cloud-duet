// The model hook. With no key, Cloud Duet runs the scripted demo engine. With a
// key (from Settings → Model, or ANTHROPIC_API_KEY / OPENAI_API_KEY), replies and
// tasks come from the model's tool loop in ../agent. Each account's key lives in
// data/users/<id>/model.json and never reaches the browser.
import { mayUseEnvKeys } from "../auth";
import { readUserJson, writeUserJson } from "../context";
import { set, state } from "../store";
import { DEFAULT_LANG } from "@/lib/i18n";
import { tr } from "../i18n";

export type ProviderKind = "anthropic" | "openai";

export interface ModelConfig {
  provider: ProviderKind;
  apiKey: string;
  model: string;
  baseURL: string;
}

export const DEFAULT_MODELS: Record<ProviderKind, string> = { anthropic: "claude-opus-5-5", openai: "gpt-5.6" };

export function readConfig(): ModelConfig {
  const saved = readUserJson<Partial<ModelConfig>>("model.json", {});
  const env = mayUseEnvKeys();
  const provider: ProviderKind = saved.provider ?? (env && process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY ? "openai" : "anthropic");
  if (saved.apiKey) {
    return { provider, apiKey: saved.apiKey, model: saved.model || DEFAULT_MODELS[provider], baseURL: saved.baseURL || "" };
  }
  // An environment key only ever goes to the endpoint the environment names,
  // never to a base URL someone typed into the app.
  const envKey = env ? (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY) || "" : "";
  const envBase = provider === "openai" ? process.env.OPENAI_BASE_URL || "" : "";
  return { provider, apiKey: envKey, model: saved.model || DEFAULT_MODELS[provider], baseURL: envKey ? envBase : saved.baseURL || "" };
}

export function writeConfig(next: Partial<ModelConfig>) {
  const saved = readUserJson<Partial<ModelConfig>>("model.json", {});
  const merged = { ...saved, ...next };
  if (next.provider && next.provider !== readConfig().provider && !next.model) merged.model = DEFAULT_MODELS[next.provider];
  writeUserJson("model.json", merged);
  syncEngine();
}

/** What the browser may see: never the key itself. */
export function publicConfig() {
  const c = readConfig();
  return { provider: c.provider, model: c.model, baseURL: c.baseURL, hasKey: !!c.apiKey, keyHint: c.apiKey ? `…${c.apiKey.slice(-4)}` : "" };
}

export function isLive() {
  return !!readConfig().apiKey;
}

export function syncEngine() {
  const c = readConfig();
  const next = c.apiKey ? { mode: c.provider, model: c.model } : { mode: "demo" as const, model: "demo" };
  const cur = state().engine;
  if (cur.mode !== next.mode || cur.model !== next.model) set("engine", next);
}

export function localNow(timeZone: string) {
  try {
    return new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: timeZone || "UTC" });
  } catch {
    return new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: "UTC" });
  }
}

export function systemPrompt(channelId: string) {
  const s = state();
  const ch = s.channels.find((c) => c.id === channelId);
  return [
    "You are Cloud Duet, a proactive work agent. You message the person like a trusted teammate: short, warm, plain sentences.",
    "Split longer replies into a few short paragraphs; each paragraph becomes its own chat bubble. Use **bold run-ins** and short lists when they help.",
    "Never claim to have sent, paid, signed or deleted anything: those always wait for the person's approval in the app.",
    (s.settings.language ?? DEFAULT_LANG) === "zh"
      ? "Write in Simplified Chinese unless the person writes to you in another language. Keep names, email addresses and app names as they are."
      : "Write in English unless the person writes to you in another language.",
    `Today is ${localNow(s.user.timezone)} (${s.user.timezone || "UTC"}).`,
    `The person: ${s.user.name || "unknown"} (${s.user.email || "no email"}).`,
    ch && ch.id !== "main" ? `This is the #${ch.name} channel. Purpose: ${ch.purpose}` : "This is the main thread.",
    s.memory ? `What you remember about them:\n${s.memory}` : "",
    s.skills.length ? `Their saved skills:\n${s.skills.map((k) => `${k.name}: ${k.instructions}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

/** A one-token round trip to check the saved key, model and base URL. */
export async function ping(): Promise<{ ok: boolean; error?: string; ms: number }> {
  const c = readConfig();
  const t0 = Date.now();
  if (!c.apiKey) return { ok: false, error: tr("No API key saved"), ms: 0 };
  try {
    if (c.provider === "anthropic") {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: c.apiKey, baseURL: c.baseURL || undefined });
      await client.messages.create({ model: c.model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] });
    } else {
      const base = (c.baseURL || "https://api.openai.com/v1").replace(/\/$/, "");
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${c.apiKey}` },
        body: JSON.stringify({ model: c.model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
    }
    return { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : String(e), ms: Date.now() - t0 };
  }
}
