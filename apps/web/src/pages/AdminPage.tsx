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

import { useLocation, useSearchParams, Link } from "react-router-dom";

export function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const isInstructionsPath = location.pathname.endsWith("/instructions");
  const tab = isInstructionsPath || searchParams.get("tab") === "instructions" ? "instructions" : "overview";

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

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>Админка</h2>
      </div>

      <div style={{ display: "flex", gap: 12, borderBottom: "1px solid var(--border)", marginBottom: 24, paddingBottom: 12 }}>
        <button
          className={`btn ${tab === "overview" ? "" : "secondary"}`}
          onClick={() => setSearchParams({})}
        >
          Панель управления
        </button>
        <button
          className={`btn ${tab === "instructions" ? "" : "secondary"}`}
          onClick={() => setSearchParams({ tab: "instructions" })}
        >
          Инструкции: подключение агентов и скилл
        </button>
      </div>

      {tab === "instructions" ? (
        <AdminInstructionsSection />
      ) : (
        <>
          {!stats ? (
            <p className="muted">Загрузка…</p>
          ) : (
            <>
              <div className="row" style={{ flexWrap: "wrap", marginBottom: 20 }}>
                <StatCard label="Артефакты" value={stats.artifacts} />
                <StatCard label="Организации" value={stats.orgs} />
                <StatCard label="Агенты" value={stats.agents} />
                <StatCard label="Пользователи" value={stats.users} />
                <StatCard label="Хранилище" value={`${(stats.storageBytes / 1024 / 1024).toFixed(1)} MB`} />
              </div>

              {settings && (
                <div className="card" style={{ marginBottom: 20 }}>
                  <h3>Настройки инстанса</h3>
                  <label className="muted">Режим регистрации</label>
                  <select
                    value={settings.registrationMode}
                    onChange={(e) => updateRegistrationMode(e.target.value as Settings["registrationMode"])}
                    style={{ maxWidth: 300, marginTop: 6 }}
                  >
                    <option value="open">Открыта</option>
                    <option value="invite_only">Только по инвайту</option>
                    <option value="closed">Закрыта</option>
                  </select>
                </div>
              )}

              <AdminUsersSection />

              <div className="card" style={{ marginTop: 20 }}>
                <h3>Audit log</h3>
                <table>
                  <thead>
                    <tr><th>Когда</th><th>Кто</th><th>Действие</th><th>Цель</th></tr>
                  </thead>
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
            </>
          )}
        </>
      )}
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

function AdminInstructionsSection() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const origin = window.location.origin;

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        "open-artifacts": {
          url: `${origin}/mcp`,
          headers: {
            Authorization: "Bearer oa_live_xxxxxxxxxxxxxxxxxxxxxxxx",
          },
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="card">
        <h3>1. Установка скилла через skills.sh</h3>
        <p className="muted" style={{ marginBottom: 12 }}>
          Скилл обучает любого ИИ-агента (Claude Code, Cursor, Codex, Windsurf, Antigravity и др.) работать с вашим
          инстансом Open Artifacts: устанавливать CLI <code>@emaxe/oa</code>, входить, публиковать артефакты и возвращать ссылки в чат.
        </p>

        <div style={{ marginBottom: 14 }}>
          <strong>Установка в текущий проект (рекомендуется):</strong>
          <div className="row" style={{ marginTop: 6 }}>
            <pre style={{ flex: 1, margin: 0, padding: 10, background: "#f4f4f5", borderRadius: 6, overflowX: "auto" }}>
              <code>npx skills add emaxe/open-artifacts</code>
            </pre>
            <button className="btn secondary" onClick={() => copy("npx skills add emaxe/open-artifacts", "add-local")}>
              {copiedId === "add-local" ? "Скопировано!" : "Копировать"}
            </button>
          </div>
        </div>

        <div>
          <strong>Установка глобально (для всех проектов на компьютере):</strong>
          <div className="row" style={{ marginTop: 6 }}>
            <pre style={{ flex: 1, margin: 0, padding: 10, background: "#f4f4f5", borderRadius: 6, overflowX: "auto" }}>
              <code>npx skills add emaxe/open-artifacts -g</code>
            </pre>
            <button className="btn secondary" onClick={() => copy("npx skills add emaxe/open-artifacts -g", "add-global")}>
              {copiedId === "add-global" ? "Скопировано!" : "Копировать"}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>2. Авторизация агента на сервере</h3>
        <p className="muted" style={{ marginBottom: 12 }}>
          Доступно два способа аутентификации агента:
        </p>

        <div style={{ marginBottom: 16 }}>
          <strong>Способ А: OAuth Device Flow (интерактивный вход через браузер)</strong>
          <p className="muted" style={{ margin: "4px 0 8px" }}>
            1. В терминале агент запускает:
          </p>
          <div className="row">
            <pre style={{ flex: 1, margin: 0, padding: 10, background: "#f4f4f5", borderRadius: 6, overflowX: "auto" }}>
              <code>oa login --server {origin}</code>
            </pre>
            <button className="btn secondary" onClick={() => copy(`oa login --server ${origin}`, "login-cmd")}>
              {copiedId === "login-cmd" ? "Скопировано!" : "Копировать"}
            </button>
          </div>
          <p className="muted" style={{ margin: "8px 0 4px" }}>
            2. Агент выведет одноразовый код (например, <code>ABCD-1234</code>) и ссылку на подтверждение.
          </p>
          <p className="muted" style={{ margin: "4px 0" }}>
            3. Откройте <Link to="/activate"><b>страницу подтверждения (/activate)</b></Link>, выберите команду и нажмите <b>«Разрешить»</b>.
            Суперадмин может одобрить доступ к любой команде инстанса.
          </p>
          <p className="muted" style={{ margin: "4px 0" }}>
            4. Токен автоматически сохранится в <code>~/.config/open-artifacts/credentials.json</code>.
          </p>
        </div>

        <div>
          <strong>Способ Б: Переменные окружения (неинтерактивно)</strong>
          <p className="muted" style={{ margin: "4px 0 8px" }}>
            Выпустите API-ключ вручную в веб-интерфейсе: выберите команду в сайдбаре, перейдите на вкладку <b>«Агенты»</b> и нажмите <b>«Выпустить ключ»</b>. Затем передайте агенту переменные:
          </p>
          <div className="row">
            <pre style={{ flex: 1, margin: 0, padding: 10, background: "#f4f4f5", borderRadius: 6, overflowX: "auto" }}>
              <code>{`export OA_SERVER="${origin}"\nexport OA_TOKEN="oa_live_xxxxxxxxxxxxxxxxxxxxxxxx"`}</code>
            </pre>
            <button
              className="btn secondary"
              onClick={() => copy(`export OA_SERVER="${origin}"\nexport OA_TOKEN="oa_live_xxxxxxxxxxxxxxxxxxxxxxxx"`, "env-cmd")}
            >
              {copiedId === "env-cmd" ? "Скопировано!" : "Копировать"}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>3. Шпаргалка команд CLI для агента</h3>
        <p className="muted" style={{ marginBottom: 12 }}>
          Команды, которые агент выполняет через установленный CLI <code>@emaxe/oa</code>:
        </p>

        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ width: "35%" }}>Команда</th>
              <th>Описание</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>oa whoami</code></td>
              <td>Проверить валидность токена, сервер и разрешения (scopes)</td>
            </tr>
            <tr>
              <td><code>oa push report.html --title "Отчёт" --share</code></td>
              <td>Опубликовать HTML/Markdown/SVG/Mermaid и сразу сгенерировать публичную ссылку</td>
            </tr>
            <tr>
              <td><code>oa push report.html --id &lt;id&gt; --message "v2"</code></td>
              <td>Обновить существующий артефакт (сохраняет историю версий)</td>
            </tr>
            <tr>
              <td><code>oa share &lt;id&gt; --password "123" --expires 7d</code></td>
              <td>Поделиться артефактом с защитой паролем или ограничением срока жизни</td>
            </tr>
            <tr>
              <td><code>oa list</code></td>
              <td>Список всех опубликованных артефактов в текущей команде</td>
            </tr>
            <tr>
              <td><code>oa get &lt;id&gt; -o local.html</code></td>
              <td>Скачать текущее содержимое артефакта из инстанса</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>4. Подключение через MCP (Model Context Protocol)</h3>
        <p className="muted" style={{ marginBottom: 12 }}>
          Каждый инстанс Open Artifacts содержит встроенный MCP-сервер по адресу <code>{origin}/mcp</code>.
          Его можно подключить напрямую в Cursor, Claude Desktop, Claude Code без использования CLI:
        </p>

        <div className="row" style={{ alignItems: "flex-start" }}>
          <pre style={{ flex: 1, margin: 0, padding: 12, background: "#f4f4f5", borderRadius: 6, overflowX: "auto" }}>
            <code>{mcpConfig}</code>
          </pre>
          <button className="btn secondary" onClick={() => copy(mcpConfig, "mcp-config")}>
            {copiedId === "mcp-config" ? "Скопировано!" : "Копировать"}
          </button>
        </div>

        <p className="muted" style={{ marginTop: 12 }}>
          <b>Доступные MCP-инструменты:</b> <code>whoami</code>, <code>list_artifacts</code>, <code>get_artifact</code>,{" "}
          <code>create_artifact</code>, <code>update_artifact</code>, <code>delete_artifact</code>, <code>create_share</code>,{" "}
          <code>list_shares</code>, <code>revoke_share</code>.
        </p>
      </div>
    </div>
  );
}
