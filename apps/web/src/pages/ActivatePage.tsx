import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

interface PendingRequest {
  agentName: string;
  scopes: string[];
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
    await api.post("/oauth/device/approve", { userCode: code, orgId });
    setStatus("done");
  }

  async function deny() {
    await api.post("/oauth/device/deny", { userCode: code });
    setStatus("denied");
  }

  if (loading) return <p className="muted">Загрузка…</p>;
  if (!me) return <p>Сначала <a href="/login">войдите</a>, чтобы подтвердить агента.</p>;

  if (status === "done") return <div className="card">Готово! Агент авторизован, вернитесь в CLI/агента.</div>;
  if (status === "denied") return <div className="card">Запрос отклонён.</div>;

  return (
    <div style={{ maxWidth: 420, margin: "10vh auto" }}>
      <h2>Подтверждение агента</h2>
      <div className="card stack">
        <input placeholder="Код из терминала, напр. WXYZ-1234" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <button className="btn secondary" onClick={lookup}>Найти запрос</button>
        {error && <div className="error">{error}</div>}

        {pending && (
          <>
            <p><strong>{pending.agentName}</strong> запрашивает доступ:</p>
            <ul>{pending.scopes.map((s) => <li key={s} className="muted">{s}</li>)}</ul>
            <label className="muted">Организация</label>
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {me.orgs.map((o) => <option key={o.orgId} value={o.orgId}>{o.orgId.slice(0, 8)} ({o.role})</option>)}
            </select>
            <div className="row">
              <button className="btn" onClick={approve}>Разрешить</button>
              <button className="btn danger" onClick={deny}>Отклонить</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
