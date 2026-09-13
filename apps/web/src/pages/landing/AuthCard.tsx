import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { sanitizeNextPath, isServerRenderedPath } from "../../lib/next-path";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Field } from "../../components/ui/Field";
import { useLandingCopy } from "./LandingI18n";
import { useInstanceConfig } from "./useInstanceConfig";
import { authErrorMessage } from "./authErrors";

export type AuthTab = "login" | "register";

export interface AuthCardHandle {
  /** Switches tab and moves keyboard focus to the first field — used by header/CTA buttons elsewhere on the page. */
  focus: (tab: AuthTab) => void;
}

/**
 * The hero's inline sign-in/sign-up card — the whole reason `/` stopped being a bare redirect.
 * Posts straight to the existing `/api/v1/auth/login` and `/api/v1/auth/register` (no new backend
 * auth surface), then reuses `useAuth().refresh()` so `RootRoute` picks up the session itself.
 */
export const AuthCard = forwardRef<AuthCardHandle>(function AuthCard(_props, ref) {
  const { t } = useLandingCopy();
  const { me, refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { mode, setMode } = useInstanceConfig();

  const tab: AuthTab = searchParams.get("mode") === "register" ? "register" : "login";
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

  useImperativeHandle(ref, () => ({
    focus(nextTab) {
      setTab(nextTab);
      emailRef.current?.focus({ preventScroll: true });
    },
  }));

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
        setError(authErrorMessage(t.auth.errors, err.code));
      } else {
        setError(t.auth.errors.unknown);
      }
    } finally {
      setBusy(false);
    }
  }

  if (me) {
    return (
      <Card className="flex flex-col items-start gap-3 shadow-sm">
        <p className="text-sm text-muted">
          {t.auth.signedInAs} <span className="font-medium text-fg">{me.email}</span>
        </p>
        <Button onClick={() => navigate("/")}>{t.auth.openApp}</Button>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <div role="tablist" aria-label={`${t.auth.tabLogin} / ${t.auth.tabRegister}`} className="mb-4 flex gap-1 border-b border-border">
        <TabButton active={tab === "login"} onClick={() => setTab("login")}>
          {t.auth.tabLogin}
        </TabButton>
        <TabButton active={tab === "register"} onClick={() => setTab("register")}>
          {t.auth.tabRegister}
        </TabButton>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {tab === "register" && (
          <Field label={t.auth.nameLabel} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </Field>
        )}
        <Field label={t.auth.emailLabel} required>
          <Input
            ref={emailRef}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </Field>
        <Field label={t.auth.passwordLabel} hint={tab === "register" ? t.auth.passwordHint : undefined} required>
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
          <p className="text-xs text-muted">{mode === "closed" ? t.auth.registrationClosedNote : t.auth.registrationInviteOnlyNote}</p>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
            {tab === "register" && error === t.auth.errors.emailTaken && (
              <>
                {" "}
                <button type="button" onClick={() => setTab("login")} className="underline">
                  {t.auth.switchToLogin}
                </button>
              </>
            )}
          </p>
        )}

        <Button type="submit" loading={busy}>
          {tab === "login" ? t.auth.loginSubmit : t.auth.registerSubmit}
        </Button>
      </form>

      <div className="mt-3 flex flex-col gap-1 text-xs text-muted">
        {tab === "login" ? (
          <p>
            {t.auth.loginAltPrompt}{" "}
            <button type="button" onClick={() => setTab("register")} className="underline">
              {t.auth.loginAltLink}
            </button>
          </p>
        ) : (
          <p>
            {t.auth.registerAltPrompt}{" "}
            <button type="button" onClick={() => setTab("login")} className="underline">
              {t.auth.registerAltLink}
            </button>
          </p>
        )}
        <p className="flex flex-wrap gap-x-3">
          <Link to={`/${tab}`} className="underline">
            {t.auth.fullPageLogin}
          </Link>
          <Link to="/activate" className="underline">
            {t.auth.connectAgent}
          </Link>
        </p>
      </div>
    </Card>
  );
});

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
