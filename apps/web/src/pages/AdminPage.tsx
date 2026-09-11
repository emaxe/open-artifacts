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

      <AdminUsersSection />

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

interface User {
  id: string;
  email: string;
  name: string;
  isSuperadmin: boolean;
  status: "active" | "blocked" | "deleted";
  createdAt: string;
}

function AdminUsersSection() {
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  async function load() {
    const data = await api.get<{ users: User[]; total: number }>(`/users?page=${page}&pageSize=20`);
    setUsers(data.users);
    setTotal(data.total);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function setStatus(userId: string, status: string) {
    if (!confirm(`Изменить статус на ${status}?`)) return;
    await api.patch(`/admin/users/${userId}/status`, { status });
    load();
  }

  return (
    <div className="card">
      <h3>Пользователи ({total})</h3>
      <table>
        <thead>
          <tr><th>Email</th><th>Имя</th><th>Роль</th><th>Статус</th><th>Действия</th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.name}</td>
              <td>{u.isSuperadmin ? "Superadmin" : "User"}</td>
              <td>{u.status}</td>
              <td>
                {!u.isSuperadmin && u.status === "active" && <button className="btn secondary" onClick={() => setStatus(u.id, "blocked")}>Block</button>}
                {!u.isSuperadmin && u.status === "blocked" && <button className="btn secondary" onClick={() => setStatus(u.id, "active")}>Unblock</button>}
                {!u.isSuperadmin && u.status !== "deleted" && <button className="btn danger" style={{ marginLeft: 8 }} onClick={() => setStatus(u.id, "deleted")}>Delete</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Назад</button>
        <span>Страница {page}</span>
        <button className="btn secondary" disabled={users.length < 20} onClick={() => setPage(p => p + 1)}>Вперёд</button>
      </div>
    </div>
  );
}
