import { useEffect, useState } from "react";
import { api, ApiError, type AdminUserListItem, type OrgListItem } from "../../lib/api";
import { USER_STATUS_LABELS, ORG_ROLE_LABELS, label, formatDateTime } from "../../lib/labels";
import { Card, CardHeader } from "../../components/ui/Card";
import { Table, THead, TBody, TR, TH, TD, TableEmptyRow } from "../../components/ui/Table";
import { Badge, type BadgeVariant } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { SearchInput } from "../../components/ui/SearchInput";
import { Pagination } from "../../components/ui/Pagination";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { DropdownMenu } from "../../components/ui/DropdownMenu";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Dialog } from "../../components/ui/Dialog";
import { Select } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { useToast } from "../../components/ui/Toast";

const PAGE_SIZE = 20;
const STATUS_BADGE: Record<string, BadgeVariant> = { active: "success", blocked: "warning", deleted: "danger" };

export function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [confirmStatus, setConfirmStatus] = useState<{ user: AdminUserListItem; status: "active" | "blocked" | "deleted" } | null>(null);
  const [addToTeamUser, setAddToTeamUser] = useState<AdminUserListItem | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ users: AdminUserListItem[]; total: number }>(
        `/users?page=${page}&pageSize=${PAGE_SIZE}&search=${encodeURIComponent(search)}`,
      );
      setUsers(data.users);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  async function applyStatus() {
    if (!confirmStatus) return;
    try {
      await api.patch(`/admin/users/${confirmStatus.user.id}/status`, { status: confirmStatus.status });
      toast.show("Статус обновлён", "success");
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось изменить статус", "error");
    }
  }

  const statusLabel = confirmStatus
    ? confirmStatus.status === "blocked"
      ? "заблокировать"
      : confirmStatus.status === "deleted"
        ? "удалить"
        : "разблокировать"
    : "";

  return (
    <Card>
      <CardHeader
        title={`Пользователи (${total})`}
        action={<SearchInput value={search} onChange={(v) => { setPage(1); setSearch(v); }} placeholder="Email или имя…" className="w-64" />}
      />
      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Пользователь</TH>
                <TH>Команды</TH>
                <TH>Статус</TH>
                <TH>Создан</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {users.length === 0 && <TableEmptyRow colSpan={5}>Ничего не найдено</TableEmptyRow>}
              {users.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <Avatar id={u.id} name={u.name} size="sm" />
                      <div>
                        <div className="flex items-center gap-1.5 font-medium text-fg">
                          {u.name}
                          {u.isSuperadmin && <Badge variant="accent">Суперадмин</Badge>}
                        </div>
                        <div className="text-xs text-muted">{u.email}</div>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {u.orgs.map((o) => (
                        <Badge key={o.orgId} variant={o.kind === "main" ? "accent" : "neutral"}>
                          {o.name}
                        </Badge>
                      ))}
                      {u.orgCount > u.orgs.length && <Badge>+{u.orgCount - u.orgs.length}</Badge>}
                    </div>
                  </TD>
                  <TD>
                    <Badge variant={STATUS_BADGE[u.status]}>{label(USER_STATUS_LABELS, u.status)}</Badge>
                  </TD>
                  <TD className="text-muted">{formatDateTime(u.createdAt)}</TD>
                  <TD className="text-right">
                    {!u.isSuperadmin && (
                      <DropdownMenu
                        items={[
                          { label: "Добавить в команду", onSelect: () => setAddToTeamUser(u) },
                          u.status === "active"
                            ? { label: "Заблокировать", onSelect: () => setConfirmStatus({ user: u, status: "blocked" }) }
                            : { label: "Разблокировать", onSelect: () => setConfirmStatus({ user: u, status: "active" }) },
                          { label: "Удалить", danger: true, disabled: u.status === "deleted", onSelect: () => setConfirmStatus({ user: u, status: "deleted" }) },
                        ]}
                      />
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        onConfirm={applyStatus}
        title={`Действительно ${statusLabel}?`}
        description={confirmStatus ? `${confirmStatus.user.name} (${confirmStatus.user.email})` : undefined}
        confirmLabel="Подтвердить"
      />

      {addToTeamUser && (
        <AddToTeamDialog
          user={addToTeamUser}
          onClose={() => setAddToTeamUser(null)}
          onDone={() => {
            setAddToTeamUser(null);
            load();
          }}
        />
      )}
    </Card>
  );
}

const ROLE_OPTIONS = ["owner", "admin", "member", "viewer"];

function AddToTeamDialog({ user, onClose, onDone }: { user: AdminUserListItem; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<OrgListItem[]>([]);
  const [orgId, setOrgId] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ orgs: OrgListItem[] }>(`/orgs?search=${encodeURIComponent(search)}&pageSize=10`).then((r) => setResults(r.orgs));
  }, [search]);

  async function handleAdd() {
    if (!orgId) return;
    setBusy(true);
    try {
      await api.post(`/orgs/${orgId}/members`, { userId: user.id, role });
      toast.show("Пользователь добавлен в команду", "success");
      onDone();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось добавить пользователя", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Добавить ${user.name} в команду`}>
      <div className="flex flex-col gap-3">
        <Field label="Команда">
          <SearchInput value={search} onChange={setSearch} placeholder="Поиск команды…" debounceMs={200} />
        </Field>
        <div className="max-h-48 overflow-y-auto rounded-control border border-border">
          {results.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOrgId(o.id)}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-panel-muted ${orgId === o.id ? "bg-panel-muted font-medium" : ""}`}
            >
              {o.name} <span className="text-xs text-muted">· {o.slug}</span>
            </button>
          ))}
          {results.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted">Ничего не найдено</p>}
        </div>
        <Field label="Роль">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ORG_ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleAdd} loading={busy} disabled={!orgId}>
            Добавить
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
