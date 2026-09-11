import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type OrgListItem } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ORG_ROLE_LABELS, label } from "../lib/labels";
import { PageContainer } from "../components/PageContainer";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { Dialog } from "../components/ui/Dialog";
import { SearchInput } from "../components/ui/SearchInput";
import { Table, THead, TBody, TR, TH, TD, TableEmptyRow } from "../components/ui/Table";
import { Pagination } from "../components/ui/Pagination";
import { TableSkeleton } from "../components/ui/Skeleton";
import { OrgIdentity } from "../components/OrgIdentity";
import { useToast } from "../components/ui/Toast";

const PAGE_SIZE = 20;

export function TeamsPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ orgs: OrgListItem[]; total: number }>(
        `/orgs?page=${page}&pageSize=${PAGE_SIZE}&search=${encodeURIComponent(search)}`,
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
  }, [page, search]);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const org = await api.post<{ id: string }>("/orgs", { name: newOrgName });
      setNewOrgName("");
      setCreateOpen(false);
      await refresh();
      toast.show("Команда создана", "success");
      navigate(`/t/${org.id}`);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось создать команду", "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Команды"
        action={<Button onClick={() => setCreateOpen(true)}>Создать команду</Button>}
      />

      <Card>
        <CardHeader title="Все команды" action={<SearchInput value={search} onChange={(v) => { setPage(1); setSearch(v); }} className="w-56" />} />
        {loading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Команда</TH>
                  <TH>Роль</TH>
                  <TH>Участники</TH>
                  <TH>Артефакты</TH>
                </TR>
              </THead>
              <TBody>
                {orgs.length === 0 && <TableEmptyRow colSpan={4}>Ничего не найдено</TableEmptyRow>}
                {orgs.map((o) => (
                  <TR key={o.id}>
                    <TD>
                      <Link to={`/t/${o.id}`} className="hover:underline">
                        <OrgIdentity org={o} secondary={o.owner ? "owner" : "slug"} />
                      </Link>
                    </TD>
                    <TD>{o.role ? label(ORG_ROLE_LABELS, o.role) : "—"}</TD>
                    <TD>{o.memberCount}</TD>
                    <TD>{o.artifactCount}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
          </>
        )}
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Создать команду">
        <form onSubmit={createOrg} className="flex flex-col gap-3">
          <Field label="Название" required>
            <Input value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} required autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" loading={creating}>
              Создать
            </Button>
          </div>
        </form>
      </Dialog>
    </PageContainer>
  );
}
