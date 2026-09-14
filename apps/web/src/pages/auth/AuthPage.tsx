import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth, hasSessionHint } from "../../lib/auth";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { sanitizeNextPath, isServerRenderedPath } from "../../lib/next-path";
import { Spinner } from "../../components/ui/Spinner";
import { LogoLockup } from "../../components/Logo";
import { ThemeSwitch } from "../../components/ui/ThemeSwitch";
import { AuthI18nProvider, useAuthCopy } from "./AuthI18n";
import { AuthForm } from "./AuthForm";
import { BrandPanel } from "./BrandPanel";
import { LangToggle } from "./LangToggle";
import { EXTERNAL_LINKS, APP_VERSION } from "./links";

const THEME_LABELS = { light: "☀︎", system: "◐", dark: "☾" };

function AuthPageContent() {
  const { t } = useAuthCopy();
  const { me, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const wide = useMediaQuery("(min-width: 1024px)");

  // Old invite links point at /register?invite=TOKEN or /?invite=TOKEN. /invite/:token is the
  // canonical landing page for one — it knows how to prefill/lock the email and handle every
  // signed-in/out state, none of which this form can do since it never learns the invite's real
  // address. Checked unconditionally, ahead of the auth redirect below: InvitePage itself handles
  // both the signed-out (register) and signed-in (accept/decline) cases.
  const invite = searchParams.get("invite");
  if (invite) return <Navigate to={`/invite/${invite}`} replace />;

  // hasSessionHint() is a same-tab, non-authoritative guess (see lib/auth.tsx) used only to pick
  // what a single frame shows while `loading` is still true: someone who was signed in on their
  // last visit gets a spinner instead of a flash of the sign-in form; someone who wasn't gets the
  // form immediately instead of waiting on a spinner for no reason.
  if (loading && hasSessionHint()) return <Spinner />;

  if (me) {
    const next = sanitizeNextPath(searchParams.get("next"));
    if (next) {
      if (isServerRenderedPath(next)) {
        window.location.assign(next);
        return <Spinner />;
      }
      return <Navigate to={next} replace />;
    }
    return <Navigate to={me.mainOrgId ? `/t/${me.mainOrgId}/artifacts` : "/teams"} replace />;
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col gap-6 px-4 py-8 sm:px-8 sm:py-10">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeSwitch labels={THEME_LABELS} />
          </div>
        </div>

        {/* Top-anchored (not vertically centered) so the register tab's extra "name" field can
            grow the form downward without ever moving the logo above it. */}
        <div className="flex flex-1 flex-col items-center gap-6 pt-2 sm:pt-4">
          <LogoLockup className="h-16 w-44" />
          <AuthForm />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted">
          <a href={EXTERNAL_LINKS.github} target="_blank" rel="noreferrer" className="hover:underline">
            GitHub
          </a>
          <span aria-hidden="true">·</span>
          <span>v{APP_VERSION}</span>
        </div>
      </div>

      {wide && <BrandPanel />}
    </div>
  );
}

/**
 * `/`, `/login`, and `/register` all render this — see App.tsx's comment on why `/login` must
 * keep existing as a route (apps/api/src/routes/public.ts redirects there for a restricted share).
 * Absorbs the old RootRoute.tsx's signed-in redirect (this used to be the marketing landing's
 * job) plus RegisterPage.tsx's `?invite=` redirect — both pages are gone, see App.tsx.
 */
export function AuthPage() {
  return (
    <AuthI18nProvider>
      <AuthPageContent />
    </AuthI18nProvider>
  );
}
