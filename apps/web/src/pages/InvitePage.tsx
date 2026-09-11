import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, ApiError, type InvitePreview } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ORG_ROLE_LABELS, INVITE_STATUS_LABELS, maskEmailClient } from "../lib/labels";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";
import { OrgIdentity } from "../components/OrgIdentity";

/**
 * The canonical landing page for an invite link (/invite/:token). Covers every state a visitor
 * can arrive in: signed out with or without an account yet, signed in as the invited person, or
 * signed in as someone else — plus a resolved (accepted/declined/revoked) or expired invite.
 * Old `/register?invite=TOKEN` links redirect here (see RegisterPage.tsx).
 */
export function InvitePage() {
  const { token } = useParams();
  const { me, refresh } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined); // undefined = loading, null = not found
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Registration form state, used only in the "signed out, no account yet" branch.
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [emailTakenToken, setEmailTakenToken] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .get<InvitePreview>(`/invites/${token}`)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [token]);

  if (!token) return null;

  if (preview === undefined) return <Spinner />;

  if (preview === null) {
    return (
      <Card className="mx-auto mt-16 max-w-md text-center">
        <p className="text-sm font-medium text-fg">Приглашение не найдено</p>
        <p className="mt-1 text-sm text-muted">Проверьте, что ссылка скопирована полностью.</p>
      </Card>
    );
  }

  const orgRef = { id: preview.orgId, name: preview.orgName, slug: "", kind: preview.orgKind };

  if (preview.status !== "pending") {
    return (
      <Card className="mx-auto mt-16 max-w-md">
        <div className="mb-4 flex justify-center">
          <OrgIdentity org={orgRef} secondary="none" />
        </div>
        <p className="text-center text-sm text-muted">
          Это приглашение {INVITE_STATUS_LABELS[preview.status]?.toLowerCase() ?? preview.status}.
          {preview.status === "accepted" && " Если это были вы — просто войдите в аккаунт."}
        </p>
        <div className="mt-4 flex justify-center">
          <Link to="/login">
            <Button variant="secondary">Войти</Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (preview.expired) {
    return (
      <Card className="mx-auto mt-16 max-w-md text-center">
        <p className="text-sm font-medium text-fg">Срок приглашения истёк</p>
        <p className="mt-1 text-sm text-muted">Попросите пригласившего отправить ссылку заново.</p>
      </Card>
    );
  }

  const roleLabel = ORG_ROLE_LABELS[preview.role] ?? preview.role;

  async function handleAccept() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/invites/${token}/accept`);
      await refresh();
      toast.show(`Вы присоединились к команде «${preview!.orgName}»`, "success");
      navigate(`/t/${preview!.orgId}/artifacts`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось принять приглашение");
    } finally {
      setBusy(false);
    }
  }

  async function handleDecline() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/invites/${token}/decline`);
      toast.show("Приглашение отклонено", "info");
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось отклонить приглашение");
    } finally {
      setBusy(false);
    }
  }

  // Signed in — decide whether it's the same person the invite was addressed to by comparing the
  // client-side mask of our own email against the server's masked value (see lib/labels.ts).
  if (me) {
    const isForMe = maskEmailClient(me.email) === preview.emailMasked;

    if (!isForMe) {
      return (
        <Card className="mx-auto mt-16 max-w-md text-center">
          <p className="text-sm font-medium text-fg">Приглашение выписано на другой адрес</p>
          <p className="mt-1 text-sm text-muted">
            Вы вошли как <strong>{me.email}</strong>, а приглашение адресовано {preview.emailMasked}.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link to="/login">
              <Button variant="secondary">Выйти и войти под другим аккаунтом</Button>
            </Link>
          </div>
        </Card>
      );
    }

    return (
      <Card className="mx-auto mt-16 max-w-md">
        <div className="mb-4 flex justify-center">
          <OrgIdentity org={orgRef} secondary="none" size="md" />
        </div>
        <p className="text-center text-sm text-muted">
          {preview.inviterName ?? "Кто-то"} приглашает вас в команду «{preview.orgName}» с ролью{" "}
          <Badge variant="accent">{roleLabel}</Badge>
        </p>
        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="secondary" onClick={handleDecline} disabled={busy}>
            Отклонить
          </Button>
          <Button onClick={handleAccept} loading={busy}>
            Принять
          </Button>
        </div>
      </Card>
    );
  }

  // Signed out. We can't tell in advance whether an account already exists for this address (the
  // public preview deliberately doesn't say — see services/invites.ts) — so if registration comes
  // back 409 email_taken, we switch to "log in instead" using the inviteToken the server attaches.
  if (emailTakenToken) {
    return (
      <Card className="mx-auto mt-16 max-w-md text-center">
        <p className="text-sm font-medium text-fg">Аккаунт с таким email уже существует</p>
        <p className="mt-1 text-sm text-muted">Войдите, чтобы принять приглашение.</p>
        <div className="mt-4 flex justify-center">
          <Link to={`/login?next=${encodeURIComponent(`/invite/${emailTakenToken}`)}`}>
            <Button>Войти</Button>
          </Link>
        </div>
      </Card>
    );
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // No `email` field: the public preview only ever gives us the masked form (see
      // services/invites.ts), so the server derives the real address from the invite itself.
      const res = await api.post<{ mainOrgId: string; orgId: string }>(`/auth/register?invite=${token}`, { name, password });
      await refresh();
      toast.show(`Вы присоединились к команде «${preview!.orgName}»`, "success");
      navigate(`/t/${res.orgId}/artifacts`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "email_taken") {
        const returnedToken = (err.body?.inviteToken as string | undefined) ?? token;
        setEmailTakenToken(returnedToken ?? null);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Что-то пошло не так");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto mt-16 max-w-md">
      <div className="mb-4 flex justify-center">
        <OrgIdentity org={orgRef} secondary="none" />
      </div>
      <p className="text-center text-sm text-muted">
        {preview.inviterName ?? "Кто-то"} приглашает вас в команду «{preview.orgName}» ({preview.emailMasked}) с ролью{" "}
        <Badge variant="accent">{roleLabel}</Badge>
      </p>

      <form onSubmit={handleRegister} className="mt-5 flex flex-col gap-3">
        <Field label="Имя" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Пароль" hint="Минимум 8 символов" required>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={busy}>
          Создать аккаунт и присоединиться
        </Button>
      </form>
      <p className="mt-3 text-center text-xs text-muted">
        Уже есть аккаунт?{" "}
        <Link to={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="underline">
          Войти
        </Link>
      </p>
    </Card>
  );
}
