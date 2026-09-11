import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/labels";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { Table, THead, TBody, TR, TH, TD, TableEmptyRow } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { CopyButton } from "../components/ui/CopyButton";
import { EmptyState } from "../components/ui/EmptyState";
import { UsersIcon } from "../components/ui/icons";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

interface ApiKeySummary {
  id: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

const ALL_SCOPES = ["artifacts:read", "artifacts:write", "artifacts:delete", "shares:write"];

export function AgentsPage() {
  const { orgId } = useParams();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  async function load() {
    if (!orgId) return;
    const data = await api.get<{ agents: Agent[] }>(`/agents?orgId=${orgId}`);
    setAgents(data.agents);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function createAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    await api.post(`/agents?orgId=${orgId}`, { name });
    setName("");
    await load();
  }

  if (!orgId) return null;

  return (
    <>
      <PageHeader title="Агенты и ключи" />

      <Card className="mb-4">
        <form onSubmit={createAgent} className="flex flex-wrap items-end gap-3">
          <Field label="Имя агента" className="min-w-64 flex-1">
            <Input placeholder="например, my-langchain-bot" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Button type="submit">Создать агента</Button>
        </form>
      </Card>

      {issuedToken && (
        <Card className="mb-4 border-accent">
          <p className="mb-2 text-sm font-medium text-fg">Новый API-ключ (показывается один раз):</p>
          <div className="mb-2 flex items-start gap-2">
            <pre className="flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-control bg-panel-muted p-2.5 text-xs">{issuedToken}</pre>
            <CopyButton value={issuedToken} />
          </div>
          <Button variant="secondary" size="sm" onClick={() => setIssuedToken(null)}>
            Скрыть
          </Button>
        </Card>
      )}

      {agents.length === 0 ? (
        <EmptyState icon={<UsersIcon size={28} />} title="Агентов пока нет" description="Создайте агента выше, чтобы выпустить для него API-ключ." />
      ) : (
        <div className="flex flex-col gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onIssued={setIssuedToken} />
          ))}
        </div>
      )}
    </>
  );
}

function AgentCard({ agent, onIssued }: { agent: Agent; onIssued: (token: string) => void }) {
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [scopes, setScopes] = useState<string[]>(["artifacts:read", "artifacts:write"]);
  const [ttl, setTtl] = useState("90d");

  async function loadKeys() {
    const data = await api.get<{ keys: ApiKeySummary[] }>(`/agents/${agent.id}/keys`);
    setKeys(data.keys);
  }

  useEffect(() => {
    loadKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  async function issueKey() {
    const res = await api.post<{ token: string }>(`/agents/${agent.id}/keys`, { scopes, expires: ttl || "0" });
    onIssued(res.token);
    await loadKeys();
  }

  async function revoke(keyId: string) {
    await api.delete(`/keys/${keyId}`);
    await loadKeys();
  }

  function toggleScope(scope: string) {
    setScopes((s) => (s.includes(scope) ? s.filter((x) => x !== scope) : [...s, scope]));
  }

  return (
    <Card>
      <CardHeader title={agent.name} description={`Создан ${formatDate(agent.createdAt)}`} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {ALL_SCOPES.map((scope) => (
          <label key={scope} className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} className="size-3.5" />
            <span className="text-muted">{scope}</span>
          </label>
        ))}
        <Input className="w-28" value={ttl} onChange={(e) => setTtl(e.target.value)} placeholder="TTL, напр. 90d" />
        <Button variant="secondary" size="sm" onClick={issueKey}>
          Выпустить ключ
        </Button>
      </div>
      <Table>
        <THead>
          <TR>
            <TH>Префикс</TH>
            <TH>Scopes</TH>
            <TH>Истекает</TH>
            <TH>Последнее использование</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {keys.length === 0 && <TableEmptyRow colSpan={5}>Ключей ещё нет</TableEmptyRow>}
          {keys.map((k) => (
            <TR key={k.id}>
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
  );
}
