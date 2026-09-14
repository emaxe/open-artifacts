import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { AUTH_COPY, detectInitialLang, type Lang, type AuthCopy } from "./authCopy";

const STORAGE_KEY = "oa_landing_lang";

interface AuthLangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: AuthCopy;
}

const AuthLangContext = createContext<AuthLangState | null>(null);

/**
 * Scoped to the sign-in/sign-up screen only — mirrors the former landing's LandingI18nProvider
 * (same storage key, `oa_landing_lang`, so a returning visitor's language choice survives the
 * landing's move to apps/landing). The rest of the app chrome stays Russian-only (lib/labels.ts),
 * so this provider must never wrap anything outside pages/auth/.
 */
export function AuthI18nProvider({ children }: { children: ReactNode }) {
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

  const t = AUTH_COPY[lang];

  useEffect(() => {
    const root = document.documentElement;
    const prevLang = root.lang;
    const prevTitle = document.title;
    root.lang = lang;
    document.title = t.meta.title;
    return () => {
      root.lang = prevLang;
      document.title = prevTitle;
    };
  }, [lang, t]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <AuthLangContext.Provider value={value}>{children}</AuthLangContext.Provider>;
}

export function useAuthCopy(): AuthLangState {
  const ctx = useContext(AuthLangContext);
  if (!ctx) throw new Error("useAuthCopy must be used within AuthI18nProvider");
  return ctx;
}
