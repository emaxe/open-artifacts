import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Layout() {
  const { me, loading, currentOrgId, setCurrentOrgId, logout } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (!me) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Open Artifacts</h1>
        {me.orgs.length > 1 && (
          <select value={currentOrgId ?? ""} onChange={(e) => setCurrentOrgId(e.target.value)} style={{ marginBottom: 12 }}>
            {me.orgs.map((o) => (
              <option key={o.orgId} value={o.orgId}>{o.orgId.slice(0, 8)} ({o.role})</option>
            ))}
          </select>
        )}
        <nav className="stack">
          <NavLink to="/artifacts" className={({ isActive }) => (isActive ? "active" : "")}>Артефакты</NavLink>
          <NavLink to="/agents" className={({ isActive }) => (isActive ? "active" : "")}>Агенты и ключи</NavLink>
          <NavLink to="/org" className={({ isActive }) => (isActive ? "active" : "")}>Команда</NavLink>
          {me.isSuperadmin && <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>Админка</NavLink>}
        </nav>
        <div style={{ marginTop: 24 }}>
          <p className="muted">{me.email}</p>
          <button className="btn secondary" onClick={() => logout()}>Выйти</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
