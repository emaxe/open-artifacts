import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

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
  const { currentOrgId } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  async function load() {
    if (!currentOrgId) return;
    const data = await api.get<{ agents: Agent[] }>(`/agents?orgId=${currentOrgId}`);
    setAgents(data.agents);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  async function createAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrgId) return;
    await api.post(`/agents?orgId=${currentOrgId}`, { name });
    setName("");
    await load();
  }

  if (!currentOrgId) return <p className="muted">Выберите организацию.</p>;

  return (
    <div>
      <h2>Агенты и ключи</h2>
      <form onSubmit={createAgent} className="card row">
        <input placeholder="Имя агента (например, my-langchain-bot)" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className="btn" type="submit">Создать агента</button>
      </form>

      {issuedToken && (
        <div className="card" style={{ borderColor: "#111" }}>
          <strong>Новый API-ключ (показывается один раз):</strong>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{issuedToken}</pre>
          <button className="btn secondary" onClick={() => setIssuedToken(null)}>Скрыть</button>
        </div>
      )}

      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} onIssued={setIssuedToken} />
      ))}
    </div>
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
    <div className="card">
      <h3>{agent.name}</h3>
      <div className="row" style={{ flexWrap: "wrap", marginBottom: 8 }}>
        {ALL_SCOPES.map((scope) => (
          <label key={scope} className="row" style={{ gap: 4 }}>
            <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />
            <span className="muted">{scope}</span>
          </label>
        ))}
        <input style={{ width: 100 }} value={ttl} onChange={(e) => setTtl(e.target.value)} placeholder="TTL, напр. 90d" />
        <button className="btn secondary" onClick={issueKey}>Выпустить ключ</button>
      </div>
      <table>
        <thead><tr><th>Префикс</th><th>Scopes</th><th>Истекает</th><th>Последнее использование</th><th></th></tr></thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id}>
              <td>oa_live_{k.prefix}_…</td>
              <td className="muted">{k.scopes.join(", ")}</td>
              <td className="muted">{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : "никогда"}</td>
              <td className="muted">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "ещё не использовался"}</td>
              <td><button className="btn secondary" onClick={() => revoke(k.id)}>Отозвать</button></td>
            </tr>
          ))}
          {keys.length === 0 && <tr><td colSpan={5} className="muted">Ключей ещё нет</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
