import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Field } from "../components/ui/Field";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  // Only a same-origin, root-relative path is a valid redirect target — `next=//evil.com` (or
  // any absolute URL) is an open-redirect attempt and is dropped.
  const rawNext = params.get("next");
  const next = rawNext && /^\/(?!\/)/.test(rawNext) ? rawNext : null;
  // /s/:token and /embed/:token are rendered server-side by the API, not SPA routes — react-router's
  // navigate() would just render nothing for them, so those two prefixes get a real navigation.
  const isServerRenderedPath = next !== null && /^\/(s|embed)\//.test(next);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/login", { email, password });
      await refresh();
      if (isServerRenderedPath) window.location.assign(next!);
      else navigate(next || "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-[10vh] max-w-sm px-4">
      <h2 className="mb-4 text-xl font-semibold text-fg">Вход</h2>
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Пароль" required>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={busy}>
            Войти
          </Button>
        </form>
      </Card>
      <p className="mt-3 text-sm text-muted">
        Нет аккаунта?{" "}
        <Link to="/register" className="underline">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}
