import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

export function SettingsPage() {
  const { me, refresh } = useAuth();
  const [email, setEmail] = useState(me?.email || "");
  const [name, setName] = useState(me?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!me) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      await api.patch("/auth/me", {
        email: email !== me!.email ? email : undefined,
        name: name !== me!.name ? name : undefined,
        newPassword: newPassword || undefined,
        currentPassword,
      });
      await refresh();
      setCurrentPassword("");
      setNewPassword("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка");
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h2>Настройки аккаунта</h2>
      <form onSubmit={onSubmit} className="card stack">
        <label>
          <div className="muted">Email</div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          <div className="muted">Имя</div>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        
        <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--border)" }} />
        
        <label>
          <div className="muted">Новый пароль (оставьте пустым, если не хотите менять)</div>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </label>
        
        <label>
          <div className="muted">Текущий пароль (обязательно для применения изменений)</div>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </label>

        {error && <div className="error">{error}</div>}
        {success && <div style={{ color: "green" }}>Изменения сохранены!</div>}
        
        <button type="submit" className="btn">Сохранить</button>
      </form>
    </div>
  );
}
