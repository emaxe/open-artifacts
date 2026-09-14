import { useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { sanitizeNextPath, isServerRenderedPath } from "../../lib/next-path";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Field } from "../../components/ui/Field";
import { useAuthCopy } from "./AuthI18n";
import { useInstanceConfig } from "./useInstanceConfig";
import { authErrorMessage } from "./authErrors";

export type AuthTab = "login" | "register";

/**
 * The sign-in/sign-up form — moved from the former landing's inline `AuthCard.tsx` (see
 * apps/web/src/pages/RootRoute.tsx's git history) when `/` stopped being the marketing page and
 * became this screen. Posts straight to `/api/v1/auth/login` and `/api/v1/auth/register`, then
 * reuses `useAuth().refresh()` so `AuthPage` picks up the session itself.
 *
 * Unlike the old `AuthCard`, this never renders a "signed in as ..." state — `AuthPage` redirects
 * an already-authenticated visitor away before this component ever mounts — and it no longer
 * needs an imperative `focus()` handle, since there is no longer a separate hero/header pair that
 * scrolls to it from elsewhere on the page.
 */
export function AuthForm() {
  const { t } = useAuthCopy();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { mode, setMode } = useInstanceConfig();

  const tab: AuthTab = location.pathname === "/register" || searchParams.get("mode") === "register" ? "register" : "login";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const next = sanitizeNextPath(searchParams.get("next"));

  function setTab(nextTab: AuthTab) {
    const params = new URLSearchParams(searchParams);
    if (nextTab === "register") params.set("mode", "register");
    else params.delete("mode");
    setSearchParams(params, { replace: true });
    setPassword("");
    setError(null);
  }

  const registrationDisabled = mode === "invite_only" || mode === "closed";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (tab === "login") {
        await api.post("/auth/login", { email, password });
      } else {
        await api.post("/auth/register", { name, email, password });
      }
      await refresh();
      if (next !== null && isServerRenderedPath(next)) window.location.assign(next);
      else navigate(next || "/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        // Self-healing: if an admin flipped registration off after this page loaded, the tab
        // disables itself immediately instead of staying clickable and dead.
        if (err.code === "registration_closed") setMode("closed");
        else if (err.code === "invite_required") setMode("invite_only");
        setError(authErrorMessage(t.errors, err.code));
      } else {
        setError(t.errors.unknown);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div role="tablist" aria-label={`${t.tabLogin} / ${t.tabRegister}`} className="mb-4 flex gap-1 border-b border-border">
        <TabButton active={tab === "login"} onClick={() => setTab("login")}>
          {t.tabLogin}
        </TabButton>
        <TabButton active={tab === "register"} onClick={() => setTab("register")}>
          {t.tabRegister}
        </TabButton>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {tab === "register" && (
          <Field label={t.nameLabel} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </Field>
        )}
        <Field label={t.emailLabel} required>
          <Input
            ref={emailRef}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </Field>
        <Field label={t.passwordLabel} hint={tab === "register" ? t.passwordHint : undefined} required>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={tab === "register" ? 8 : undefined}
            autoComplete={tab === "register" ? "new-password" : "current-password"}
          />
        </Field>

        {tab === "register" && registrationDisabled && (
          <p className="text-xs text-muted">{mode === "closed" ? t.registrationClosedNote : t.registrationInviteOnlyNote}</p>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
            {tab === "register" && error === t.errors.emailTaken && (
              <>
                {" "}
                <button type="button" onClick={() => setTab("login")} className="underline">
                  {t.switchToLogin}
                </button>
              </>
            )}
          </p>
        )}

        <Button type="submit" loading={busy}>
          {tab === "login" ? t.loginSubmit : t.registerSubmit}
        </Button>
      </form>

      <div className="mt-3 flex flex-col gap-1 text-xs text-muted">
        {tab === "login" ? (
          <p>
            {t.loginAltPrompt}{" "}
            <button type="button" onClick={() => setTab("register")} className="underline">
              {t.loginAltLink}
            </button>
          </p>
        ) : (
          <p>
            {t.registerAltPrompt}{" "}
            <button type="button" onClick={() => setTab("login")} className="underline">
              {t.registerAltLink}
            </button>
          </p>
        )}
        <p>
          <Link to="/activate" className="underline">
            {t.connectAgent}
          </Link>
        </p>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}
    >
      {children}
    </button>
  );
}
