import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError, type ArtifactSummary, type OrgDetail, type ShareMode } from "../lib/api";
import { formatDateTime, formatBytes, formatExpiry, formatLifetime, label, SHARE_MODE_LABELS } from "../lib/labels";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Textarea } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { LifetimeSelect } from "../components/ui/LifetimeSelect";
import { Table, THead, TBody, TR, TH, TD, TableEmptyRow } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { Dialog } from "../components/ui/Dialog";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { CopyButton } from "../components/ui/CopyButton";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";

interface Version {
  versionNo: number;
  contentHash: string;
  sizeBytes: number;
  message: string | null;
  createdAt: string;
}

interface Share {
  id: string;
  token: string;
  mode: ShareMode;
  expiresAt: string | null;
  viewCount: number;
  revokedAt: string | null;
  createdAt: string;
}

export function ArtifactDetailPage() {
  const { orgId, id } = useParams<{ orgId: string; id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [artifact, setArtifact] = useState<ArtifactSummary | null>(null);
  const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
  const [content, setContent] = useState("");
  const [contentHash, setContentHash] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [sharePassword, setSharePassword] = useState("");
  const [lastShareUrl, setLastShareUrl] = useState<string | null>(null);
  const [lifetimeDialogOpen, setLifetimeDialogOpen] = useState(false);
  const [lifetimeDraft, setLifetimeDraft] = useState<number | null>(null);

  async function load() {
    if (!id) return;
    const data = await api.get<{ artifact: ArtifactSummary; content: string; contentHash: string }>(`/artifacts/${id}`);
    setArtifact(data.artifact);
    setContent(data.content);
    setContentHash(data.contentHash);
    const v = await api.get<{ versions: Version[] }>(`/artifacts/${id}/versions`);
    setVersions(v.versions);
    const s = await api.get<{ shares: Share[] }>(`/artifacts/${id}/shares`);
    setShares(s.shares);
    if (orgId) setOrgDetail(await api.get<OrgDetail>(`/orgs/${orgId}`));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveEdit() {
    setError(null);
    try {
      await api.patch(`/artifacts/${id}`, { content: draft }, { "If-Match": contentHash });
      setEditing(false);
      setPreviewKey((k) => k + 1);
      await load();
      toast.show("Новая версия сохранена", "success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка сохранения");
    }
  }

  async function restore(versionNo: number) {
    await api.post(`/artifacts/${id}/versions/${versionNo}/restore`);
    setPreviewKey((k) => k + 1);
    await load();
    toast.show(`Версия ${versionNo} восстановлена`, "success");
  }

  async function createShare(mode?: ShareMode, password?: string) {
    try {
      const res = await api.post<{ url: string }>(`/artifacts/${id}/shares`, { mode, password });
      await load();
      setLastShareUrl(res.url);
      setPasswordDialogOpen(false);
      setSharePassword("");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось создать ссылку", "error");
    }
  }

  async function revokeShare(shareId: string) {
    await api.delete(`/shares/${shareId}`);
    await load();
  }

  async function remove() {
    await api.delete(`/artifacts/${id}`);
    navigate(`/t/${orgId}/artifacts`);
  }

  async function saveLifetime() {
    try {
      await api.patch(`/artifacts/${id}`, { lifetime: lifetimeDraft });
      setLifetimeDialogOpen(false);
      await load();
      toast.show("Срок жизни обновлён", "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось изменить срок жизни", "error");
    }
  }

  const expiresSoon = artifact?.expiresAt ? new Date(artifact.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000 : false;

  if (!artifact) return <Spinner />;

  return (
    <>
      <PageHeader
        title={artifact.title}
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(content);
                setEditing((v) => !v);
              }}
            >
              {editing ? "Отмена" : "Редактировать"}
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Удалить
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>Истекает:</span>
        <Badge variant={expiresSoon ? "warning" : "neutral"}>{formatExpiry(artifact.expiresAt)}</Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setLifetimeDraft(artifact.expiresAt ? Math.round((new Date(artifact.expiresAt).getTime() - Date.now()) / 60_000) : null);
            setLifetimeDialogOpen(true);
          }}
        >
          Изменить срок
        </Button>
      </div>

      {editing ? (
        <Card className="mb-4">
          <Textarea rows={14} value={draft} onChange={(e) => setDraft(e.target.value)} />
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <Button className="mt-3" onClick={saveEdit}>
            Сохранить новую версию
          </Button>
        </Card>
      ) : (
        <Card className="mb-4 h-[420px] overflow-hidden p-0">
          <iframe
            key={previewKey}
            title="preview"
            src={`/api/v1/artifacts/${id}/preview`}
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            className="h-full w-full border-0"
          />
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader title="Шаринг" />
        <div className="mb-3 flex flex-wrap gap-2">
          <Button
            variant={orgDetail?.effectiveDefaultShareMode === "team" ? "primary" : "secondary"}
            onClick={() => createShare("team")}
          >
            Ссылка для команды
          </Button>
          <Button variant="secondary" onClick={() => setPasswordDialogOpen(true)}>
            Ссылка с паролем
          </Button>
          <Button
            variant={orgDetail?.effectiveDefaultShareMode === "public" ? "primary" : "secondary"}
            onClick={() => createShare("public")}
            disabled={orgDetail?.effectiveAllowPublicShares === false}
            title={orgDetail?.effectiveAllowPublicShares === false ? "Публичные ссылки запрещены настройками команды" : undefined}
          >
            Публичная ссылка
          </Button>
        </div>
        {lastShareUrl && (
          <div className="mb-3 flex items-center gap-2 rounded-control border border-border bg-panel-muted px-3 py-2 text-sm">
            <span className="flex-1 truncate">{lastShareUrl}</span>
            <CopyButton value={lastShareUrl} />
          </div>
        )}
        <Table>
          <THead>
            <TR>
              <TH>Режим</TH>
              <TH>Просмотры</TH>
              <TH>Истекает</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {shares.filter((s) => !s.revokedAt).length === 0 && <TableEmptyRow colSpan={4}>Нет активных ссылок</TableEmptyRow>}
            {shares
              .filter((s) => !s.revokedAt)
              .map((s) => (
                <TR key={s.id}>
                  <TD>{label(SHARE_MODE_LABELS, s.mode)}</TD>
                  <TD>{s.viewCount}</TD>
                  <TD className="text-muted">{s.expiresAt ? formatDateTime(s.expiresAt) : "никогда"}</TD>
                  <TD className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => revokeShare(s.id)}>
                      Отозвать
                    </Button>
                  </TD>
                </TR>
              ))}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardHeader title="История версий" />
        <Table>
          <THead>
            <TR>
              <TH>#</TH>
              <TH>Сообщение</TH>
              <TH>Размер</TH>
              <TH>Создана</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {versions.map((v) => (
              <TR key={v.versionNo}>
                <TD>{v.versionNo}</TD>
                <TD className="text-muted">{v.message ?? "—"}</TD>
                <TD className="text-muted">{formatBytes(v.sizeBytes)}</TD>
                <TD className="text-muted">{formatDateTime(v.createdAt)}</TD>
                <TD className="text-right">
                  {v.versionNo !== versions[0]?.versionNo && (
                    <Button variant="ghost" size="sm" onClick={() => restore(v.versionNo)}>
                      Откатить
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} title="Ссылка с паролем">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (sharePassword) createShare("password", sharePassword);
          }}
          className="flex flex-col gap-3"
        >
          <Field label="Пароль" required>
            <Input type="text" value={sharePassword} onChange={(e) => setSharePassword(e.target.value)} required minLength={4} autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPasswordDialogOpen(false)}>
              Отмена
            </Button>
            <Button type="submit">Создать</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Удалить артефакт"
        description={`«${artifact.title}» будет удалён без возможности восстановления.`}
        confirmLabel="Удалить"
      />

      <Dialog open={lifetimeDialogOpen} onClose={() => setLifetimeDialogOpen(false)} title="Срок жизни артефакта">
        <div className="flex flex-col gap-3">
          <Field
            label="Удалить через"
            hint={`Не больше ${formatLifetime(orgDetail?.effectiveMaxArtifactLifetimeMinutes ?? null)} — лимит команды. После истечения срока содержимое удаляется безвозвратно.`}
          >
            <LifetimeSelect
              value={lifetimeDraft}
              maxMinutes={orgDetail?.effectiveMaxArtifactLifetimeMinutes ?? null}
              onChange={setLifetimeDraft}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLifetimeDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveLifetime}>Сохранить</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
