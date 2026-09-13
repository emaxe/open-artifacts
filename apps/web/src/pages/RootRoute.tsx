import { Navigate } from "react-router-dom";
import { useAuth, hasSessionHint } from "../lib/auth";
import { Spinner } from "../components/ui/Spinner";
import { LandingPage } from "./landing/LandingPage";

/**
 * Replaces the old `<Route path="/" element={<HomeRedirect/>}>` (which lived inside `Layout`'s
 * auth-gated block, so a signed-out visitor never saw anything but `/login`). `/` is now public:
 * a signed-in user still lands in their own workspace, everyone else gets the marketing landing —
 * which also carries the inline sign-in/sign-up card, so `/` is no longer just a redirect target.
 *
 * `me`/`loading` come from `AuthProvider`, which fires `GET /auth/me` on every mount and does NOT
 * block rendering while it's in flight — good for an anonymous visitor (the landing paints on the
 * first frame, no network round trip to wait on) but it means a signed-in visitor would otherwise
 * see a flash of the landing before the redirect fires. `hasSessionHint()` (see lib/auth.tsx) is a
 * same-tab, non-authoritative guess used only to pick what a single frame shows while `loading` is
 * still true: someone who was signed in on their last visit gets a spinner instead of a flash;
 * someone who wasn't gets the landing immediately instead of waiting on a spinner for no reason.
 */
export function RootRoute() {
  const { me, loading } = useAuth();
  if (loading && hasSessionHint()) return <Spinner />;
  if (me) return <Navigate to={me.mainOrgId ? `/t/${me.mainOrgId}/artifacts` : "/teams"} replace />;
  return <LandingPage />;
}
