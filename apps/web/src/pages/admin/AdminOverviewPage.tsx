import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AuditEntryView } from "../../lib/api";
import { formatBytes, formatDateTime, label, AUDIT_ACTION_LABELS } from "../../lib/labels";
import { Card } from "../../components/ui/Card";
import { Table, THead, TBody, TR, TH, TD, TableEmptyRow } from "../../components/ui/Table";
import { Spinner } from "../../components/ui/Spinner";

interface Stats {
  artifacts: number;
  teamOrgs: number;
  mainOrgs: number;
  agents: number;
  users: number;
  // Includes uploaded file bytes alongside artifact source text — see routes/admin.ts.
  storageBytes: number;
  files: number;
  storageEnabled: boolean;
}

export function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [audit, setAudit] = useState<AuditEntryView[]>([]);

  useEffect(() => {
    api.get<Stats>("/admin/stats").then(setStats);
    api.get<{ entries: AuditEntryView[] }>("/admin/audit?limit=10").then((r) => setAudit(r.entries));
  }, []);

  if (!stats) return <Spinner />;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Артефакты" value={stats.artifacts} />
        <StatCard label="Команды" value={stats.teamOrgs} />
        <StatCard label="Основные пространства" value={stats.mainOrgs} />
        <StatCard label="Агенты" value={stats.agents} />
        <StatCard label="Пользователи" value={stats.users} />
        <StatCard label="Хранилище" value={formatBytes(stats.storageBytes)} />
        {stats.storageEnabled && <StatCard label="Файлы" value={stats.files} />}
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fg">Последние события</h3>
          <Link to="/admin/audit" className="text-xs font-medium text-muted hover:text-fg hover:underline">
            Весь аудит →
          </Link>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Когда</TH>
              <TH>Кто</TH>
              <TH>Действие</TH>
            </TR>
          </THead>
          <TBody>
            {audit.length === 0 && <TableEmptyRow colSpan={3}>Пока нет событий</TableEmptyRow>}
            {audit.map((entry) => (
              <TR key={entry.id}>
                <TD className="text-muted">{formatDateTime(entry.at)}</TD>
                <TD className="text-muted">{entry.actor?.email ?? `${entry.actorType}${entry.actorId ? `:${entry.actorId.slice(0, 8)}` : ""}`}</TD>
                <TD>{label(AUDIT_ACTION_LABELS, entry.action)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-semibold text-fg">{value}</div>
    </Card>
  );
}
