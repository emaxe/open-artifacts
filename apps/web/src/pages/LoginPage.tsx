import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/login", { email, password });
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
      <h2>Вход</h2>
      <form onSubmit={onSubmit} className="stack card">
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div className="error">{error}</div>}
        <button className="btn" disabled={busy} type="submit">Войти</button>
      </form>
      <p className="muted">Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></p>
    </div>
  );
}
