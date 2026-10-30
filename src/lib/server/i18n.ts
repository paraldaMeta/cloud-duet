import { DEFAULT_LANG, translate, type Lang, type Vars } from "@/lib/i18n";
import { state } from "./store";

/** The signed-in person's language, or the default outside a request. */
export function userLang(): Lang {
  try {
    return state().settings.language ?? DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

/** Translates server-made copy (replies, notes, errors) into the person's language. */
export function tr(text: string, vars?: Vars) {
  return translate(userLang(), text, vars);
}
