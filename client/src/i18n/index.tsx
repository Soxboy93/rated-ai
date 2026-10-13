import { createContext, Fragment, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "@shared/jordan";
import { AR } from "./ar";

/**
 * Tiny translation layer. The English sentence IS the key: `t("Play a game")`. Arabic lives in ./ar.ts and a unit
 * test fails if a string passed to t()/T() has no Arabic entry, so nothing silently falls back to English.
 *
 * `t` reads a module-level language so it can be used in plain helpers; the provider re-mounts its subtree when the
 * language changes, which makes every component pick the new language up without each one subscribing.
 */
let current: Lang = "en";

export function t(en: string, vars?: Record<string, string | number | null | undefined>): string {
  let out = current === "ar" ? (AR[en] ?? en) : en;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v == null ? "" : String(v));
  return out;
}

/** Marks a string as translatable without translating it yet (data tables); translate later with t(value). */
export const T = (en: string) => en;

export const currentLang = () => current;
export const isRtl = (lang: Lang) => lang === "ar";

const STORE_KEY = "ra_lang";
function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (stored === "ar" || stored === "en") return stored;
  } catch { /* storage may be unavailable */ }
  try { if (navigator.language?.toLowerCase().startsWith("ar")) return "ar"; } catch { /* ignore */ }
  return "en";
}

type Ctx = { lang: Lang; dir: "rtl" | "ltr"; setLang: (l: Lang) => void };
const LangCtx = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  current = lang; // set during render so children (rendered after this) see the right language
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
  }
  const setLang = useCallback((l: Lang) => {
    try { localStorage.setItem(STORE_KEY, l); } catch { /* ignore */ }
    setLangState(l);
  }, []);
  const value = useMemo<Ctx>(() => ({ lang, dir: isRtl(lang) ? "rtl" : "ltr", setLang }), [lang, setLang]);
  return (
    <LangCtx.Provider value={value}>
      <Fragment key={lang}>{children}</Fragment>
    </LangCtx.Provider>
  );
}

export function useLang(): Ctx {
  const c = useContext(LangCtx);
  if (!c) throw new Error("useLang must be used inside LangProvider");
  return c;
}

/** Dates follow the language but keep Western digits (0-9) for now; Arabic-Indic digits need educator sign-off. */
const locale = () => (current === "ar" ? "ar-JO-u-nu-latn" : undefined);
type DateLike = Date | string | number;
export const fmtDate = (d: DateLike) => new Date(d).toLocaleDateString(locale());
export const fmtDateTime = (d: DateLike) => new Date(d).toLocaleString(locale());
export const fmtTime = (d: DateLike) => new Date(d).toLocaleTimeString(locale());
