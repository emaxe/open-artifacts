import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { GlobalSidebar } from "./GlobalSidebar";

export function Layout() {
  const { me, loading } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (!me) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell" style={{ display: "flex" }}>
      <GlobalSidebar />
      <main className="main" style={{ flex: 1, padding: 24, marginLeft: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
