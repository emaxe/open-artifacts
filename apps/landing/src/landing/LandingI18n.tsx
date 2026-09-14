import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LANDING_COPY, detectInitialLang, type Lang, type LandingCopy } from "./copy";

const STORAGE_KEY = "oa_site_lang";

interface LandingLangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: LandingCopy;
}

const LandingLangContext = createContext<LandingLangState | null>(null);

/**
 * Mirrors apps/web/src/pages/landing/LandingI18n.tsx, minus react-router-dom — this standalone
 * site never had a router to begin with (see apps/landing/package.json), so `?lang=` is read and
 * written directly against `window.location`/`history.replaceState`. Also drops the app version's
 * unmount cleanup that restored the pre-landing title/lang/description: on a standalone site
 * nothing above this ever unmounts, so there is nothing to restore.
 */
export function LandingI18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectInitialLang(new URLSearchParams(window.location.search).get("lang")));

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort only, same discipline as lib/theme.tsx.
    }
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
  };

  const t = LANDING_COPY[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", t.meta.description);
  }, [lang, t]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <LandingLangContext.Provider value={value}>{children}</LandingLangContext.Provider>;
}

export function useLandingCopy(): LandingLangState {
  const ctx = useContext(LandingLangContext);
  if (!ctx) throw new Error("useLandingCopy must be used within LandingI18nProvider");
  return ctx;
}
