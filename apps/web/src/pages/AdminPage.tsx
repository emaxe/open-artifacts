import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Stats {
  artifacts: number;
  orgs: number;
  agents: number;
  users: number;
  storageBytes: number;
}

interface AuditEntry {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  at: string;
}

interface Settings {
  registrationMode: "open" | "invite_only" | "closed";
  defaultKeyTtlDays: number;
  cdnAllowlist: string[];
  viewRetentionDays: number;
  maxArtifactSizeBytes: number;
}

export function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  async function load() {
    setStats(await api.get<Stats>("/admin/stats"));
    const a = await api.get<{ auditLog: AuditEntry[] }>("/admin/audit?limit=50");
    setAudit(a.auditLog);
    const s = await api.get<{ settings: Settings }>("/admin/settings");
    setSettings(s.settings);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateRegistrationMode(mode: Settings["registrationMode"]) {
    const res = await api.patch<{ settings: Settings }>("/admin/settings", { registrationMode: mode });
    setSettings(res.settings);
  }

  if (!stats) return <p className="muted">Загрузка…</p>;

  return (
    <div>
      <h2>Админка</h2>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <StatCard label="Артефакты" value={stats.artifacts} />
        <StatCard label="Организации" value={stats.orgs} />
        <StatCard label="Агенты" value={stats.agents} />
        <StatCard label="Пользователи" value={stats.users} />
        <StatCard label="Хранилище" value={`${(stats.storageBytes / 1024 / 1024).toFixed(1)} MB`} />
      </div>

      {settings && (
        <div className="card">
          <h3>Настройки инстанса</h3>
          <label className="muted">Режим регистрации</label>
          <select value={settings.registrationMode} onChange={(e) => updateRegistrationMode(e.target.value as Settings["registrationMode"])}>
            <option value="open">Открыта</option>
            <option value="invite_only">Только по инвайту</option>
            <option value="closed">Закрыта</option>
          </select>
        </div>
      )}

      <div className="card">
        <h3>Audit log</h3>
        <table>
          <thead><tr><th>Когда</th><th>Кто</th><th>Действие</th><th>Цель</th></tr></thead>
          <tbody>
            {audit.map((entry) => (
              <tr key={entry.id}>
                <td className="muted">{new Date(entry.at).toLocaleString()}</td>
                <td className="muted">{entry.actorType}:{entry.actorId?.slice(0, 8)}</td>
                <td>{entry.action}</td>
                <td className="muted">{entry.targetType}:{entry.targetId?.slice(0, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card" style={{ minWidth: 140 }}>
      <div className="muted">{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
