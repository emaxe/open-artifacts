import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Spinner } from "../components/ui/Spinner";

/** Replaces the old hardcoded `<Navigate to="/teams">` — lands the user straight in their own main workspace instead of an extra click through the teams list. */
export function HomeRedirect() {
  const { me, loading } = useAuth();
  if (loading) return <Spinner />;
  if (me?.mainOrgId) return <Navigate to={`/t/${me.mainOrgId}/artifacts`} replace />;
  return <Navigate to="/teams" replace />;
}
