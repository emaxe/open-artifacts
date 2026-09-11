import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

import { ActivatePage } from "./pages/ActivatePage";
import { InvitePage } from "./pages/InvitePage";
import { InvitesPage } from "./pages/InvitesPage";
import { TeamsPage } from "./pages/TeamsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PersonalKeysPage } from "./pages/PersonalKeysPage";
import { HomeRedirect } from "./pages/HomeRedirect";
import { TeamLayout } from "./components/TeamLayout";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { ArtifactDetailPage } from "./pages/ArtifactDetailPage";
import { AgentsPage } from "./pages/AgentsPage";
import { TeamSettingsPage } from "./pages/team/TeamSettingsPage";
import { AgentInstructionsPage } from "./pages/help/AgentInstructionsPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminTeamsPage } from "./pages/admin/AdminTeamsPage";
import { AdminAuditPage } from "./pages/admin/AdminAuditPage";
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/activate" element={<ActivatePage />} />
          {/* Public: works signed-out (registration) or signed-in (accept/decline) — never gated behind Layout's auth redirect. */}
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/invites" element={<InvitesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/keys" element={<PersonalKeysPage />} />
            <Route path="/help/agents" element={<AgentInstructionsPage />} />

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverviewPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="teams" element={<AdminTeamsPage />} />
              <Route path="audit" element={<AdminAuditPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
              {/* Old bookmarks: instructions used to live under /admin. */}
              <Route path="instructions" element={<Navigate to="/help/agents" replace />} />
            </Route>

            <Route path="/t/:orgId" element={<TeamLayout />}>
              <Route path="" element={<ArtifactsPage />} />
              <Route path="artifacts" element={<ArtifactsPage />} />
              <Route path="artifacts/:id" element={<ArtifactDetailPage />} />
              <Route path="agents" element={<AgentsPage />} />
              <Route path="settings" element={<TeamSettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
