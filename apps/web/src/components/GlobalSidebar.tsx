import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { TeamSwitcher } from "./TeamSwitcher";

export function GlobalSidebar() {
  const { me, logout } = useAuth();
  if (!me) return null;

  return (
    <aside className="sidebar" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <h1>Open Artifacts</h1>
      <TeamSwitcher />
      <nav className="stack" style={{ flex: 1, marginTop: 24 }}>
        <NavLink to="/teams" className={({ isActive }) => (isActive ? "active" : "")}>Команды</NavLink>
        {me.isSuperadmin && <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>Админка</NavLink>}
        <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")}>Настройки</NavLink>
      </nav>
      <div style={{ padding: "16px 0", borderTop: "1px solid var(--border)" }}>
        <p className="muted" style={{ marginBottom: 8, wordBreak: "break-all" }}>{me.email}</p>
        <button className="btn secondary" style={{ width: "100%" }} onClick={() => logout()}>Выйти</button>
      </div>
    </aside>
  );
}
