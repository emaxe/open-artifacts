import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { Layout } from "./components/Layout";
import { AuthPage } from "./pages/auth/AuthPage";

import { ActivatePage } from "./pages/ActivatePage";
import { InvitePage } from "./pages/InvitePage";
import { InvitesPage } from "./pages/InvitesPage";
import { TeamsPage } from "./pages/TeamsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PersonalKeysPage } from "./pages/PersonalKeysPage";
import { HomePage } from "./pages/HomePage";
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
          {/* Sign-in/sign-up screen. Handles the redirect to a signed-in user's own workspace
              itself (see pages/auth/AuthPage.tsx), so it must stay outside Layout's auth-gated
              block. /login and /register both render the same screen — /login MUST keep existing
              as a route: apps/api/src/routes/public.ts redirects here (?next=/s/:token) for a
              restricted share, and /register keeps old ?invite=/?mode=register links working. The
              marketing site that used to live at "/" moved to https://emaxe.github.io/open-artifacts/
              (apps/landing) — /welcome now just bounces back to "/" for old bookmarks/links. */}
          <Route path="/" element={<AuthPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route path="/welcome" element={<Navigate to="/" replace />} />
          <Route path="/activate" element={<ActivatePage />} />
          {/* Public: works signed-out (registration) or signed-in (accept/decline) — never gated behind Layout's auth redirect. */}
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route element={<Layout />}>
            <Route path="/home" element={<HomePage />} />
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
