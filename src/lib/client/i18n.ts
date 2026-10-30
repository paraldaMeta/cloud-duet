"use client";
import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_LANG, isLang, locale, translate, type Lang, type Vars } from "@/lib/i18n";

const KEY = "duet.lang";
const EVENT = "duet-lang";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function getLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const v = localStorage.getItem(KEY);
  return isLang(v) ? v : DEFAULT_LANG;
}

const serverLang = () => DEFAULT_LANG;

/** Saves the choice in this browser. The server copy is synced by the app shell. */
export function setLang(lang: Lang) {
  localStorage.setItem(KEY, lang);
  document.documentElement.lang = locale(lang);
  window.dispatchEvent(new Event(EVENT));
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, serverLang);
}

/** Translator for render code. */
export function useT() {
  const lang = useLang();
  return useCallback((text: string, vars?: Vars) => translate(lang, text, vars), [lang]);
}

/** Translator for event handlers, toasts and other code outside render. */
export function t(text: string, vars?: Vars) {
  return translate(getLang(), text, vars);
}
