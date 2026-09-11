import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { PageContainer } from "../../components/PageContainer";
import { PageHeader } from "../../components/ui/PageHeader";
import { Tabs } from "../../components/ui/Tabs";
import { Spinner } from "../../components/ui/Spinner";

/**
 * Superadmin guard + real routed tabs, replacing AdminPage.tsx's single component that derived
 * its active tab from both the pathname AND a `?tab=` query param at once. Every tab is now its
 * own route; `/admin?tab=instructions` and `/admin/instructions` (old bookmarks) both redirect to
 * /help/agents, where the agent-connection instructions now live for every user, not just admins.
 */
export function AdminLayout() {
  const { me, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!me) return <Navigate to="/login" replace />;
  if (!me.isSuperadmin) return <Navigate to="/" replace />;
  if (new URLSearchParams(location.search).get("tab") === "instructions") return <Navigate to="/help/agents" replace />;

  return (
    <PageContainer wide>
      <PageHeader title="Админка" />
      <Tabs
        className="mb-6"
        items={[
          { to: "/admin", label: "Обзор", end: true },
          { to: "/admin/users", label: "Пользователи" },
          { to: "/admin/teams", label: "Команды" },
          { to: "/admin/audit", label: "Аудит" },
          { to: "/admin/settings", label: "Настройки инстанса" },
        ]}
      />
      <Outlet />
    </PageContainer>
  );
}
