import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { ArtifactDetailPage } from "./pages/ArtifactDetailPage";
import { AgentsPage } from "./pages/AgentsPage";
import { OrgPage } from "./pages/OrgPage";
import { AdminPage } from "./pages/AdminPage";
import { ActivatePage } from "./pages/ActivatePage";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/activate" element={<ActivatePage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/artifacts" replace />} />
            <Route path="/artifacts" element={<ArtifactsPage />} />
            <Route path="/artifacts/:id" element={<ArtifactDetailPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/org" element={<OrgPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
