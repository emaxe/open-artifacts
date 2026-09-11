import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageContainer } from "../components/PageContainer";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { Spinner } from "../components/ui/Spinner";

interface PendingRequest {
  agentName: string;
  scopes: string[];
  grantKind: "agent" | "user";
  expiresAt: string;
}

export function ActivatePage() {
  const { me, loading } = useAuth();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [orgId, setOrgId] = useState(me?.orgs[0]?.orgId ?? "");
  const [status, setStatus] = useState<"idle" | "done" | "denied">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me && me.orgs.length > 0 && !orgId) setOrgId(me.orgs[0]!.orgId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  async function lookup() {
    setError(null);
    try {
      const data = await api.get<PendingRequest>(`/oauth/device/pending?code=${encodeURIComponent(code)}`);
      setPending(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Код не найден или устарел");
      setPending(null);
    }
  }

  useEffect(() => {
    if (code) lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approve() {
    // A personal-key request isn't locked to one team — no orgId to send (see routes/oauth-device.ts).
    await api.post("/oauth/device/approve", pending?.grantKind === "user" ? { userCode: code } : { userCode: code, orgId });
    setStatus("done");
  }

  async function deny() {
    await api.post("/oauth/device/deny", { userCode: code });
    setStatus("denied");
  }

  if (loading) return <Spinner />;
  if (!me)
    return (
      <PageContainer>
        <p className="text-sm text-muted">
          Сначала <Link to="/login" className="underline">войдите</Link>, чтобы подтвердить агента.
        </p>
      </PageContainer>
    );

  if (status === "done")
    return (
      <PageContainer>
        <Card className="mx-auto max-w-md text-center">Готово! Агент авторизован, вернитесь в CLI/агента.</Card>
      </PageContainer>
    );
  if (status === "denied")
    return (
      <PageContainer>
        <Card className="mx-auto max-w-md text-center">Запрос отклонён.</Card>
      </PageContainer>
    );

  return (
    <div className="mx-auto mt-[10vh] max-w-md px-4">
      <h2 className="mb-4 text-xl font-semibold text-fg">Подтверждение агента</h2>
      <Card>
        <div className="flex flex-col gap-3">
          <Field label="Код из терминала">
            <Input placeholder="например, WXYZ-1234" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </Field>
          <Button variant="secondary" onClick={lookup}>
            Найти запрос
          </Button>
          {error && <p className="text-sm text-danger">{error}</p>}

          {pending && (
            <>
              <p className="text-sm text-fg">
                <strong>{pending.agentName}</strong> запрашивает {pending.grantKind === "user" ? "личный доступ" : "доступ"}:
              </p>
              <div className="flex flex-wrap gap-1">
                {pending.scopes.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
              {pending.grantKind === "user" ? (
                <p className="text-sm text-muted">
                  Ключ будет действовать во всех ваших командах (сейчас и в будущем) с вашей текущей ролью в каждой из них.
                  Административные функции ему недоступны.
                </p>
              ) : (
                <Field label="Команда">
                  <Select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                    {me.orgs.map((o) => (
                      <option key={o.orgId} value={o.orgId}>
                        {o.name || o.orgId.slice(0, 8)}
                        {o.role ? ` (${o.role})` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <div className="flex gap-2">
                <Button onClick={approve}>Разрешить</Button>
                <Button variant="danger" onClick={deny}>
                  Отклонить
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
