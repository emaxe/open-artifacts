import { useEffect, useState } from "react";
import { api, type AuditEntryView } from "../../lib/api";
import { AUDIT_ACTION_LABELS, formatDateTime, label } from "../../lib/labels";
import { Card, CardHeader } from "../../components/ui/Card";
import { Table, THead, TBody, TR, TH, TD, TableEmptyRow } from "../../components/ui/Table";
import { Select } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { TableSkeleton } from "../../components/ui/Skeleton";

const ACTION_OPTIONS = Object.keys(AUDIT_ACTION_LABELS);

export function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntryView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load(reset: boolean) {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (action) params.set("action", action);
      if (!reset && cursor) params.set("cursor", cursor);
      const data = await api.get<{ entries: AuditEntryView[]; nextCursor: string | null }>(`/admin/audit?${params}`);
      setEntries((prev) => (reset ? data.entries : [...prev, ...data.entries]));
      setCursor(data.nextCursor);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  return (
    <Card>
      <CardHeader
        title="Аудит"
        action={
          <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-56">
            <option value="">Все действия</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {AUDIT_ACTION_LABELS[a]}
              </option>
            ))}
          </Select>
        }
      />
      {loading ? (
        <TableSkeleton rows={10} cols={4} />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Когда</TH>
                <TH>Кто</TH>
                <TH>Действие</TH>
                <TH>Команда</TH>
              </TR>
            </THead>
            <TBody>
              {entries.length === 0 && <TableEmptyRow colSpan={4}>Пока нет событий</TableEmptyRow>}
              {entries.map((entry) => (
                <TR key={entry.id}>
                  <TD className="text-muted whitespace-nowrap">{formatDateTime(entry.at)}</TD>
                  <TD className="text-muted">
                    {entry.actor?.email ?? (entry.actorId ? `${entry.actorType}:${entry.actorId.slice(0, 8)}` : entry.actorType)}
                  </TD>
                  <TD>{label(AUDIT_ACTION_LABELS, entry.action)}</TD>
                  <TD className="text-muted">{entry.orgName ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {cursor && (
            <div className="mt-3 flex justify-center">
              <Button variant="secondary" size="sm" loading={loadingMore} onClick={() => load(false)}>
                Загрузить ещё
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
