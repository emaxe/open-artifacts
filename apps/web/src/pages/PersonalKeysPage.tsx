import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/labels";
import { PageContainer } from "../components/PageContainer";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { Table, THead, TBody, TR, TH, TD } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { CopyButton } from "../components/ui/CopyButton";
import { EmptyState } from "../components/ui/EmptyState";
import { ShieldIcon } from "../components/ui/icons";

interface PersonalKeySummary {
  id: string;
  name: string | null;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

const ALL_SCOPES = ["artifacts:read", "artifacts:write", "artifacts:delete", "shares:write"];

export function PersonalKeysPage() {
  const [keys, setKeys] = useState<PersonalKeySummary[]>([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["artifacts:read", "artifacts:write", "shares:write"]);
  const [ttl, setTtl] = useState("90d");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  async function load() {
    const data = await api.get<{ keys: PersonalKeySummary[] }>("/me/keys");
    setKeys(data.keys);
  }

  useEffect(() => {
    load();
  }, []);

  function toggleScope(scope: string) {
    setScopes((s) => (s.includes(scope) ? s.filter((x) => x !== scope) : [...s, scope]));
  }

  async function issueKey(e: React.FormEvent) {
    e.preventDefault();
    const res = await api.post<{ token: string }>("/me/keys", { name: name || undefined, scopes, expires: ttl || "0" });
    setIssuedToken(res.token);
    setName("");
    await load();
  }

  async function revoke(keyId: string) {
    await api.delete(`/me/keys/${keyId}`);
    await load();
  }

  return (
    <PageContainer>
      <PageHeader title="Личные API-ключи" />
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Личный ключ привязан к вам, а не к одной команде — он действует во всех командах, где вы состоите, с вашей текущей ролью в
        каждой из них. Административные функции (управление командами, участниками, настройками инстанса) ему недоступны. Используйте
        его для CLI (<code>oa login</code>) или MCP-подключения агента от своего имени.
      </p>

      <Card className="mb-4 max-w-2xl">
        <form onSubmit={issueKey} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start gap-3">
            <Field label="Название" className="min-w-56 flex-1" hint="например, MacBook CLI">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="MacBook CLI" />
            </Field>
            <Field label="TTL" className="w-32">
              <Input value={ttl} onChange={(e) => setTtl(e.target.value)} placeholder="90d" />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {ALL_SCOPES.map((scope) => (
              <label key={scope} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} className="size-3.5" />
                <span className="text-muted">{scope}</span>
              </label>
            ))}
          </div>
          <Button type="submit" className="self-start" disabled={scopes.length === 0}>
            Выпустить ключ
          </Button>
        </form>
      </Card>

      {issuedToken && (
        <Card className="mb-4 max-w-2xl border-accent">
          <p className="mb-2 text-sm font-medium text-fg">Новый API-ключ (показывается один раз):</p>
          <div className="mb-2 flex items-start gap-2">
            <pre className="flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-control bg-panel-muted p-2.5 text-xs">{issuedToken}</pre>
            <CopyButton value={issuedToken} />
          </div>
          <p className="mb-2 text-xs text-muted">
            Сохраните его в <code>oa login</code> или как <code>OA_TOKEN</code> — повторно он не показывается.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setIssuedToken(null)}>
            Скрыть
          </Button>
        </Card>
      )}

      {keys.length === 0 ? (
        <EmptyState icon={<ShieldIcon size={28} />} title="Личных ключей пока нет" description="Выпустите ключ выше, чтобы подключить CLI или MCP от своего имени." />
      ) : (
        <Card className="max-w-2xl">
          <Table>
            <THead>
              <TR>
                <TH>Название</TH>
                <TH>Префикс</TH>
                <TH>Scopes</TH>
                <TH>Истекает</TH>
                <TH>Последнее использование</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {keys.map((k) => (
                <TR key={k.id}>
                  <TD>{k.name || <span className="text-muted">—</span>}</TD>
                  <TD className="font-mono text-xs">oa_live_{k.prefix}_…</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {k.scopes.map((s) => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                    </div>
                  </TD>
                  <TD className="text-muted">{k.expiresAt ? formatDate(k.expiresAt) : "никогда"}</TD>
                  <TD className="text-muted">{k.lastUsedAt ? formatDateTime(k.lastUsedAt) : "ещё не использовался"}</TD>
                  <TD className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => revoke(k.id)}>
                      Отозвать
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </PageContainer>
  );
}
