// Strings are written in English in the code and looked up here by that exact
// English text. A missing entry falls back to the English, so untranslated
// copy still reads fine. Placeholders use {name}.
import { chat } from "./zh/chat";
import { server } from "./zh/server";
import { server2 } from "./zh/server2";
import { sheets } from "./zh/sheets";
import { shell } from "./zh/shell";
import { work } from "./zh/work";

export type Lang = "zh" | "en";
export const LANGS: { id: Lang; label: string }[] = [
  { id: "zh", label: "中文" },
  { id: "en", label: "English" },
];
export const DEFAULT_LANG: Lang = "zh";

const zh: Record<string, string> = { ...shell, ...chat, ...work, ...sheets, ...server, ...server2 };

export type Vars = Record<string, string | number>;

export function isLang(v: unknown): v is Lang {
  return v === "zh" || v === "en";
}

export function translate(lang: Lang, text: string, vars?: Vars): string {
  const s = lang === "zh" ? (zh[text] ?? text) : text;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** BCP 47 tag for Intl date and number formatting. */
export function locale(lang: Lang) {
  return lang === "zh" ? "zh-CN" : "en-US";
}
