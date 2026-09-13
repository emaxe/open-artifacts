import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type OrgDetail, type OrgListItem } from "../../lib/api";
import { formatDateTime, formatLifetime, formatBytes, formatQuota } from "../../lib/labels";
import { Card, CardHeader } from "../../components/ui/Card";
import { Table, THead, TBody, TR, TH, TD, TableEmptyRow } from "../../components/ui/Table";
import { SearchInput } from "../../components/ui/SearchInput";
import { Pagination } from "../../components/ui/Pagination";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { DropdownMenu } from "../../components/ui/DropdownMenu";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { Field } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { LifetimeSelect } from "../../components/ui/LifetimeSelect";
import { OrgIdentity } from "../../components/OrgIdentity";
import { useToast } from "../../components/ui/Toast";

const PAGE_SIZE = 20;
type KindFilter = "all" | "team" | "main";

export function AdminTeamsPage() {
  const toast = useToast();
  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("team");
  const [loading, setLoading] = useState(true);
  const [quotaOrg, setQuotaOrg] = useState<OrgListItem | null>(null);
  const [lifetimeOrg, setLifetimeOrg] = useState<OrgListItem | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ orgs: OrgListItem[]; total: number }>(
        `/orgs?page=${page}&pageSize=${PAGE_SIZE}&search=${encodeURIComponent(search)}&kind=${kind}`,
      );
      setOrgs(data.orgs);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, kind]);

  return (
    <Card>
      <CardHeader
        title={`Команды (${total})`}
        action={<SearchInput value={search} onChange={(v) => { setPage(1); setSearch(v); }} placeholder="Название, slug или email владельца…" className="w-72" />}
      />
      <div className="mb-3 flex gap-1 rounded-control bg-panel-muted p-1 text-xs w-fit">
        {(["team", "main", "all"] as const).map((k) => (
          <button
            key={k}
            onClick={() => { setPage(1); setKind(k); }}
            className={`rounded-control px-3 py-1 font-medium ${kind === k ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg"}`}
          >
            {k === "team" ? "Команды" : k === "main" ? "Основные" : "Все"}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Команда</TH>
                <TH>Владелец</TH>
                <TH>Участники</TH>
                <TH>Артефакты</TH>
                <TH>Создана</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {orgs.length === 0 && <TableEmptyRow colSpan={6}>Ничего не найдено</TableEmptyRow>}
              {orgs.map((o) => (
                <TR key={o.id}>
                  <TD>
                    <Link to={`/t/${o.id}`} className="hover:underline">
                      <OrgIdentity org={o} secondary="none" />
                    </Link>
                  </TD>
                  <TD className="text-muted">{o.owner?.email ?? "—"}</TD>
                  <TD>{o.memberCount}</TD>
                  <TD>{o.artifactCount}</TD>
                  <TD className="text-muted">{formatDateTime(o.createdAt)}</TD>
                  <TD className="text-right">
                    <DropdownMenu
                      items={[
                        { label: "Открыть", onSelect: () => (window.location.href = `/t/${o.id}`) },
                        { label: "Изменить квоту", onSelect: () => setQuotaOrg(o) },
                        { label: "Срок жизни артефактов", onSelect: () => setLifetimeOrg(o) },
                      ]}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      )}

      {quotaOrg && (
        <QuotaDialog
          org={quotaOrg}
          onClose={() => setQuotaOrg(null)}
          onDone={() => {
            setQuotaOrg(null);
            load();
          }}
        />
      )}

      {lifetimeOrg && (
        <LifetimeDialog
          org={lifetimeOrg}
          onClose={() => setLifetimeOrg(null)}
          onDone={() => {
            setLifetimeOrg(null);
            load();
          }}
        />
      )}
    </Card>
  );
}

function LifetimeDialog({ org, onClose, onDone }: { org: OrgListItem; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<OrgDetail>(`/orgs/${org.id}`).then((d) => {
      setDetail(d);
      setMinutes(d.maxArtifactLifetimeMinutes);
    });
  }, [org.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/orgs/${org.id}`, { maxArtifactLifetimeMinutes: minutes });
      toast.show("Срок жизни артефактов изменён", "success");
      onDone();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось изменить срок жизни", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Срок жизни артефактов: ${org.name}`}>
      {!detail ? (
        <Spinner />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field
            label="Максимум для этой команды"
            hint={`Не больше лимита инстанса (${formatLifetime(detail.globalMaxArtifactLifetimeMinutes)}). «Без ограничений» доступно, только если у инстанса тоже нет лимита.`}
          >
            <LifetimeSelect value={minutes} maxMinutes={detail.globalMaxArtifactLifetimeMinutes} onChange={setMinutes} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" loading={busy}>
              Сохранить
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function QuotaDialog({ org, onClose, onDone }: { org: OrgListItem; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  // "" renders as the inherited/effective value in the field's hint rather than a real number —
  // submitting with it empty means "inherit" (storageQuotaBytes: null), not "0 bytes".
  const [mb, setMb] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<OrgDetail>(`/orgs/${org.id}`).then((d) => {
      setDetail(d);
      setMb(d.storageQuotaBytes !== null ? String(Math.round(d.storageQuotaBytes / 1024 / 1024)) : "");
    });
  }, [org.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/orgs/${org.id}`, { storageQuotaBytes: mb.trim() === "" ? null : Math.round(Number(mb) * 1024 * 1024) });
      toast.show("Квота изменена", "success");
      onDone();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось изменить квоту", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Квота хранилища: ${org.name}`}>
      {!detail ? (
        <Spinner />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Используется: {formatBytes(detail.usedBytes)}. Действующий лимит команды: {formatQuota(detail.effectiveOrgQuotaBytes)}.
          </p>
          <Field label="Мегабайт" hint="Оставьте пустым, чтобы наследовать лимит инстанса (по умолчанию — без ограничений)">
            <Input type="number" min={1} placeholder="без ограничений" value={mb} onChange={(e) => setMb(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" loading={busy}>
              Сохранить
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
