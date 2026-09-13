import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError, type ArtifactSummary, type OrgDetail, type ShareMode } from "../lib/api";
import { formatDateTime, formatBytes, formatQuota, formatExpiry, formatLifetime, label, SHARE_MODE_LABELS } from "../lib/labels";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Textarea, Select } from "../components/ui/Input";
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
  url: string;
  mode: ShareMode;
  label: string | null;
  expiresAt: string | null;
  viewCount: number;
  managerViewCount: number;
  revokedAt: string | null;
  createdAt: string;
}

interface ArtifactFile {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

interface QuotaBucket {
  limitBytes: number | null;
  usedBytes: number;
}

interface QuotaSnapshot {
  storageEnabled: boolean;
  artifact?: QuotaBucket;
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
  const [files, setFiles] = useState<ArtifactFile[]>([]);
  const [quota, setQuota] = useState<QuotaSnapshot | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareMode, setShareMode] = useState<ShareMode>("team");
  const [shareLabel, setShareLabel] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [creatingShare, setCreatingShare] = useState(false);
  const [revokingShareId, setRevokingShareId] = useState<string | null>(null);
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
    const f = await api.get<{ files: ArtifactFile[] }>(`/artifacts/${id}/files`);
    setFiles(f.files);
    setQuota(await api.get<QuotaSnapshot>(`/quota?artifactId=${id}`));
    if (orgId) setOrgDetail(await api.get<OrgDetail>(`/orgs/${orgId}`));
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api.postForm(`/artifacts/${id}/files`, form);
      await load();
      toast.show("Файл загружен", "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось загрузить файл", "error");
    } finally {
      setUploading(false);
    }
  }

  async function deleteFile(fileId: string) {
    try {
      await api.delete(`/artifacts/${id}/files/${fileId}`);
      await load();
      toast.show("Файл удалён", "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось удалить файл", "error");
    }
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

  function openShareDialog() {
    setShareMode(orgDetail?.effectiveDefaultShareMode ?? "team");
    setShareLabel("");
    setSharePassword("");
    setShareDialogOpen(true);
  }

  async function createShare(e: React.FormEvent) {
    e.preventDefault();
    setCreatingShare(true);
    try {
      const res = await api.post<{ url: string }>(`/artifacts/${id}/shares`, {
        mode: shareMode,
        label: shareLabel || undefined,
        password: shareMode === "password" ? sharePassword : undefined,
      });
      await load();
      setLastShareUrl(res.url);
      setShareDialogOpen(false);
      setSharePassword("");
      setShareLabel("");
      toast.show("Ссылка создана", "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось создать ссылку", "error");
    } finally {
      setCreatingShare(false);
    }
  }

  async function revokeShare(shareId: string) {
    setRevokingShareId(shareId);
    try {
      await api.delete(`/shares/${shareId}`);
      await load();
      toast.show("Ссылка отозвана", "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось отозвать ссылку", "error");
    } finally {
      setRevokingShareId(null);
    }
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
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
            className="h-full w-full border-0"
          />
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader title="Шаринг" action={<Button onClick={openShareDialog}>Создать ссылку</Button>} />
        {lastShareUrl && (
          <div className="mb-3 flex items-center gap-2 rounded-control border border-border bg-panel-muted px-3 py-2 text-sm">
            <span className="flex-1 truncate">{lastShareUrl}</span>
            <CopyButton value={lastShareUrl} />
          </div>
        )}
        <Table>
          <THead>
            <TR>
              <TH>Название</TH>
              <TH>Режим</TH>
              <TH title="Просмотры без учёта участников с правами управления артефактом">Просмотры</TH>
              <TH title="Все просмотры, включая владельца и администраторов команды">Всего</TH>
              <TH>Истекает</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {shares.filter((s) => !s.revokedAt).length === 0 && <TableEmptyRow colSpan={6}>Нет активных ссылок</TableEmptyRow>}
            {shares
              .filter((s) => !s.revokedAt)
              .map((s) => (
                <TR key={s.id}>
                  <TD className={s.label ? undefined : "text-muted"}>{s.label || "—"}</TD>
                  <TD>{label(SHARE_MODE_LABELS, s.mode)}</TD>
                  <TD>{s.viewCount}</TD>
                  <TD className="text-muted">{s.viewCount + s.managerViewCount}</TD>
                  <TD className="text-muted">{s.expiresAt ? formatDateTime(s.expiresAt) : "никогда"}</TD>
                  <TD className="flex justify-end gap-2">
                    <CopyButton value={s.url} label="Ссылка" />
                    <Button variant="ghost" size="sm" loading={revokingShareId === s.id} onClick={() => revokeShare(s.id)}>
                      Отозвать
                    </Button>
                  </TD>
                </TR>
              ))}
          </TBody>
        </Table>
      </Card>

      <Card className="mb-4">
        <CardHeader
          title="Файлы"
          description={
            quota && !quota.storageEnabled
              ? "Объектное хранилище не настроено на этом инстансе — загрузка файлов недоступна."
              : quota?.artifact
                ? `Использовано: ${formatQuota(quota.artifact.usedBytes)} из ${formatQuota(quota.artifact.limitBytes)}`
                : undefined
          }
        />
        {quota?.storageEnabled && (
          <>
            <label className="mb-3 inline-block">
              <span className="sr-only">Загрузить файл</span>
              <input
                type="file"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                  e.target.value = "";
                }}
                className="block w-full max-w-sm cursor-pointer text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-control file:border file:border-border file:bg-panel file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-fg hover:file:bg-panel-muted"
              />
            </label>
            <Table>
              <THead>
                <TR>
                  <TH>Имя</TH>
                  <TH>Тип</TH>
                  <TH>Размер</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {files.length === 0 && <TableEmptyRow colSpan={4}>Нет загруженных файлов</TableEmptyRow>}
                {files.map((f) => (
                  <TR key={f.id}>
                    <TD>{f.name}</TD>
                    <TD className="text-muted">{f.contentType}</TD>
                    <TD className="text-muted">{formatBytes(f.sizeBytes)}</TD>
                    <TD className="flex justify-end gap-2">
                      <CopyButton value={`${window.location.origin}${f.url}`} label="Ссылка" />
                      <Button variant="ghost" size="sm" onClick={() => deleteFile(f.id)}>
                        Удалить
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </>
        )}
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

      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} title="Создать ссылку">
        <form onSubmit={createShare} className="flex flex-col gap-3">
          <Field label="Режим доступа" required>
            <Select value={shareMode} onChange={(e) => setShareMode(e.target.value as ShareMode)} autoFocus>
              <option value="team">{label(SHARE_MODE_LABELS, "team")}</option>
              <option value="password">{label(SHARE_MODE_LABELS, "password")}</option>
              <option value="public" disabled={orgDetail?.effectiveAllowPublicShares === false}>
                {label(SHARE_MODE_LABELS, "public")}
                {orgDetail?.effectiveAllowPublicShares === false ? " (запрещены настройками команды)" : ""}
              </option>
            </Select>
          </Field>
          <Field label="Название" hint="Необязательно. Видно только вам, в таблице «Шаринг».">
            <Input type="text" value={shareLabel} onChange={(e) => setShareLabel(e.target.value)} maxLength={100} />
          </Field>
          {shareMode === "password" && (
            <Field label="Пароль" required>
              <Input type="text" value={sharePassword} onChange={(e) => setSharePassword(e.target.value)} required minLength={4} />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShareDialogOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" loading={creatingShare}>
              Создать
            </Button>
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
