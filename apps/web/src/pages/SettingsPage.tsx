import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageContainer } from "../components/PageContainer";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Field } from "../components/ui/Field";

export function SettingsPage() {
  const navigate = useNavigate();
  const { me, refresh } = useAuth();
  const [email, setEmail] = useState(me?.email || "");
  const [name, setName] = useState(me?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!me) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setBusy(true);

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
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Настройки аккаунта" />
      <Card className="max-w-xl">
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Имя" required>
            <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>

          <hr className="my-2 border-border" />

          <Field label="Новый пароль" hint="Оставьте пустым, если не хотите менять">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Field label="Текущий пароль" hint="Обязательно для применения изменений" required>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </Field>

          {error && <p className="text-sm text-danger">{error}</p>}
          {success && <p className="text-sm text-success">Изменения сохранены!</p>}

          <Button type="submit" loading={busy} className="self-start">
            Сохранить
          </Button>
        </form>
      </Card>

      <Card className="mt-4 max-w-xl">
        <CardHeader title="Личные API-ключи" description="Для CLI и MCP-подключений от вашего имени — действуют во всех ваших командах." />
        <Button variant="secondary" onClick={() => navigate("/settings/keys")}>
          Управлять ключами
        </Button>
      </Card>
    </PageContainer>
  );
}
