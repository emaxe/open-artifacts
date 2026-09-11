import { NavLink, Outlet, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function TeamLayout() {
  const { orgId } = useParams();
  const { me } = useAuth();
  if (!me) return null;

  const membership = me.orgs.find((o) => o.orgId === orgId);
  if (!membership && !me.isSuperadmin) {
    return <div style={{ padding: 24 }}>У вас нет доступа к этой команде</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", paddingLeft: 24 }}>
      <nav style={{ display: "flex", gap: 16, borderBottom: "1px solid var(--border)", paddingBottom: 16, marginBottom: 24 }}>
        <NavLink to={`/t/${orgId}/artifacts`} className={({ isActive }) => (isActive ? "active" : "")}>Артефакты</NavLink>
        <NavLink to={`/t/${orgId}/agents`} className={({ isActive }) => (isActive ? "active" : "")}>Агенты</NavLink>
        <NavLink to={`/t/${orgId}/settings`} className={({ isActive }) => (isActive ? "active" : "")}>Настройки команды</NavLink>
      </nav>
      <div style={{ flex: 1 }}>
        <Outlet />
      </div>
    </div>
  );
}
