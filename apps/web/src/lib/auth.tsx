import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Me } from "./api";

interface AuthState {
  me: Me | null;
  loading: boolean;
  currentOrgId: string | null;
  setCurrentOrgId: (id: string) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(localStorage.getItem("oa_org_id"));

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Me>("/auth/me");
      setMe(data);
      if (!currentOrgId && data.orgs.length > 0) {
        setCurrentOrgIdState(data.orgs[0]!.orgId);
      }
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setCurrentOrgId = (id: string) => {
    localStorage.setItem("oa_org_id", id);
    setCurrentOrgIdState(id);
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setMe(null);
  };

  return (
    <AuthContext.Provider value={{ me, loading, currentOrgId, setCurrentOrgId, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
