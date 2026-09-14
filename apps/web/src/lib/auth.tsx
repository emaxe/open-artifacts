import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Me } from "./api";

interface AuthState {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// A same-tab-only hint, never used for authorization (the real check is always the httpOnly
// session cookie via GET /auth/me) — it only lets pages/auth/AuthPage.tsx pick, for a single
// frame, between "probably signed in, wait rather than flash the sign-in form" and "probably
// signed out, paint the sign-in form immediately instead of a spinner". Stale in either direction
// is harmless: a leftover "1" after the cookie expired just costs one brief spinner before the
// form shows; a missing hint after clearing site data just costs one brief form flash before the
// redirect — exactly what happened everywhere before this hint existed.
const SESSION_HINT_KEY = "oa_has_session";

export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function setSessionHint(present: boolean) {
  try {
    if (present) localStorage.setItem(SESSION_HINT_KEY, "1");
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Best-effort only, same as lib/theme.tsx's persistence — a private tab or blocked site data
    // just means every visit takes the "unknown" path above instead of the fast one.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Me>("/auth/me");
      setMe(data);
      setSessionHint(true);
    } catch {
      setMe(null);
      setSessionHint(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = async () => {
    await api.post("/auth/logout");
    setMe(null);
    setSessionHint(false);
  };

  return (
    <AuthContext.Provider value={{ me, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
