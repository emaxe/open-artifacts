import { useState } from "react";
import { useNavigate, useSearchParams, Link, Navigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { LogoLockup } from "../components/Logo";

export function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  const invite = params.get("invite");

  // Old invite links pointed at /register?invite=TOKEN. /invite/:token is now the canonical
  // landing page — it knows how to prefill/lock the email and handle every signed-in/out state,
  // none of which this bare form can do since it never learns the invite's real address.
  if (invite) return <Navigate to={`/invite/${invite}`} replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/register", { name, email, password });
      await refresh();
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-[10vh] max-w-sm px-4">
      <LogoLockup className="mx-auto mb-6 h-36 w-32" />
      <h2 className="mb-4 text-center text-xl font-semibold text-fg">Регистрация</h2>
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label="Имя" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Пароль" hint="Минимум 8 символов" required>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={busy}>
            Создать аккаунт
          </Button>
        </form>
      </Card>
      <p className="mt-3 text-sm text-muted">
        Уже есть аккаунт?{" "}
        <Link to="/login" className="underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
