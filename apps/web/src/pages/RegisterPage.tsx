import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const qs = invite ? `?invite=${encodeURIComponent(invite)}` : "";
      await api.post(`/auth/register${qs}`, { name, email, password });
      await refresh();
      navigate("/artifacts");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "10vh auto" }}>
      <h2>Регистрация</h2>
      <form onSubmit={onSubmit} className="stack card">
        <input placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Пароль (мин. 8 символов)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        {error && <div className="error">{error}</div>}
        <button className="btn" disabled={busy} type="submit">Создать аккаунт</button>
      </form>
      <p className="muted">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
    </div>
  );
}
