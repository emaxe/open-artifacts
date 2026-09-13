import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { LANDING_COPY, detectInitialLang, type Lang, type LandingCopy } from "./copy";

const STORAGE_KEY = "oa_landing_lang";

interface LandingLangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: LandingCopy;
}

const LandingLangContext = createContext<LandingLangState | null>(null);

/**
 * Scoped to the landing only — the rest of the app stays hardcoded Russian (see lib/labels.ts), so
 * this provider must never wrap anything outside `pages/landing/`. Owns `<html lang>` and the
 * document title/description while the landing is mounted, and restores the app's Russian default
 * on unmount so a screen reader doesn't keep reading the rest of the UI in the wrong language.
 */
export function LandingI18nProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lang, setLangState] = useState<Lang>(() => detectInitialLang(searchParams.get("lang")));

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort only, same discipline as lib/theme.tsx.
    }
    const params = new URLSearchParams(searchParams);
    params.set("lang", next);
    setSearchParams(params, { replace: true });
  };

  const t = LANDING_COPY[lang];

  useEffect(() => {
    const root = document.documentElement;
    const prevLang = root.lang;
    const prevTitle = document.title;
    const descriptionTag = document.querySelector('meta[name="description"]');
    const prevDescription = descriptionTag?.getAttribute("content") ?? null;

    root.lang = lang;
    document.title = t.meta.title;
    if (descriptionTag) descriptionTag.setAttribute("content", t.meta.description);

    return () => {
      root.lang = prevLang;
      document.title = prevTitle;
      if (descriptionTag && prevDescription !== null) descriptionTag.setAttribute("content", prevDescription);
    };
  }, [lang, t]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <LandingLangContext.Provider value={value}>{children}</LandingLangContext.Provider>;
}

export function useLandingCopy(): LandingLangState {
  const ctx = useContext(LandingLangContext);
  if (!ctx) throw new Error("useLandingCopy must be used within LandingI18nProvider");
  return ctx;
}
