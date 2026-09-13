import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError, type DefaultShareMode, type OrgDetail, type OrgInvite, type OrgMember } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { ORG_ROLE_LABELS, INVITE_STATUS_LABELS, DEFAULT_SHARE_MODE_LABELS, formatDateTime, formatLifetime, formatQuota, label } from "../../lib/labels";
import { Card, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Field } from "../../components/ui/Field";
import { Badge } from "../../components/ui/Badge";
import { LifetimeSelect } from "../../components/ui/LifetimeSelect";
import { Table, THead, TBody, TR, TH, TD, TableEmptyRow } from "../../components/ui/Table";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Dialog } from "../../components/ui/Dialog";
import { CopyButton } from "../../components/ui/CopyButton";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";

const ROLE_OPTIONS = ["owner", "admin", "member", "viewer"];
const canManage = (role: string | null) => role === "owner" || role === "admin";

export function TeamSettingsPage() {
  const { orgId } = useParams();
  const { me, refresh } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  const [confirmRemove, setConfirmRemove] = useState<OrgMember | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [activePublicShares, setActivePublicShares] = useState(0);

  async function load() {
    if (!orgId) return;
    const [detailRes, membersRes, invitesRes] = await Promise.all([
      api.get<OrgDetail>(`/orgs/${orgId}`),
      api.get<{ members: OrgMember[] }>(`/orgs/${orgId}/members`),
      api.get<{ invites: OrgInvite[] }>(`/orgs/${orgId}/invites?status=pending`),
    ]);
    setDetail(detailRes);
    setNameDraft(detailRes.name);
    setMembers(membersRes.members);
    setInvites(invitesRes.invites);
  }

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => toast.show("Не удалось загрузить настройки команды", "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  if (!orgId) return null;
  if (loading || !detail) return <Spinner />;

  const canManageTeam = canManage(detail.myRole);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || nameDraft.trim() === detail!.name) return;
    setSavingName(true);
    try {
      await api.patch(`/orgs/${orgId}`, { name: nameDraft.trim() });
      toast.show("Название сохранено", "success");
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось сохранить название", "error");
    } finally {
      setSavingName(false);
    }
  }

  async function handleSaveLifetime(minutes: number | null) {
    if (!orgId) return;
    try {
      await api.patch(`/orgs/${orgId}`, { maxArtifactLifetimeMinutes: minutes });
      toast.show("Срок жизни артефактов сохранён", "success");
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось изменить срок жизни артефактов", "error");
    }
  }

  async function handleSaveQuota(field: "storageQuotaBytes" | "artifactQuotaBytes", bytes: number | null) {
    if (!orgId) return;
    try {
      await api.patch(`/orgs/${orgId}`, { [field]: bytes });
      toast.show("Квота сохранена", "success");
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось изменить квоту", "error");
    }
  }

  async function handleSaveSharePolicy(patch: { defaultShareMode?: DefaultShareMode | null; allowPublicShares?: boolean }) {
    if (!orgId) return;
    try {
      await api.patch(`/orgs/${orgId}`, patch);
      toast.show("Настройки ссылок сохранены", "success");
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось изменить настройки ссылок", "error");
    }
  }

  /** Turning public links off is only a real privacy decision when links already exist — otherwise just save. */
  async function handleTogglePublicShares(allow: boolean) {
    if (!orgId) return;
    if (allow) return handleSaveSharePolicy({ allowPublicShares: true });
    try {
      const policy = await api.get<{ activePublicShares: number }>(`/orgs/${orgId}/share-policy`);
      if (policy.activePublicShares === 0) return handleSaveSharePolicy({ allowPublicShares: false });
      setActivePublicShares(policy.activePublicShares);
      setRevokeDialogOpen(true);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось проверить активные ссылки", "error");
    }
  }

  /** Saves the prohibition first so a failed revoke still leaves it in effect (fail-safe, not fail-open). */
  async function handleForbidAndRevoke(revoke: boolean) {
    if (!orgId) return;
    try {
      await api.patch(`/orgs/${orgId}`, { allowPublicShares: false });
      if (revoke) {
        const res = await api.post<{ revoked: number }>(`/orgs/${orgId}/shares/revoke-public`);
        toast.show(`Отозвано ссылок: ${res.revoked}`, "success");
      } else {
        toast.show("Публичные ссылки запрещены для новых", "success");
      }
      setRevokeDialogOpen(false);
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось изменить настройки ссылок", "error");
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setInviting(true);
    try {
      const res = await api.post<{ acceptUrl: string; accountExists: boolean; reissued: boolean }>(`/orgs/${orgId}/invites`, {
        email: inviteEmail,
        role: inviteRole,
      });
      toast.show(
        res.accountExists
          ? "Приглашение отправлено — он увидит его в разделе «Приглашения»"
          : `Приглашение создано. Отправьте ссылку: ${res.acceptUrl}`,
        "success",
      );
      setInviteEmail("");
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось создать приглашение", "error");
    } finally {
      setInviting(false);
    }
  }

  async function handleChangeRole(userId: string, role: string) {
    if (!orgId) return;
    try {
      await api.patch(`/orgs/${orgId}/members/${userId}`, { role });
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось изменить роль", "error");
    }
  }

  async function handleRemoveMember() {
    if (!orgId || !confirmRemove) return;
    await api.delete(`/orgs/${orgId}/members/${confirmRemove.userId}`);
    toast.show("Участник удалён", "success");
    await load();
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!orgId) return;
    try {
      await api.delete(`/orgs/${orgId}/invites/${inviteId}`);
      toast.show("Приглашение отозвано", "info");
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось отозвать приглашение", "error");
    }
  }

  async function handleReissue(invite: OrgInvite) {
    try {
      const res = await api.post<{ acceptUrl: string }>(`/orgs/${orgId}/invites`, { email: invite.email, role: invite.role });
      toast.show(`Новая ссылка: ${res.acceptUrl}`, "success");
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось перевыпустить приглашение", "error");
    }
  }

  async function handleLeave() {
    if (!orgId) return;
    try {
      await api.delete(`/orgs/${orgId}/members/${me!.id}`);
      toast.show("Вы покинули команду", "info");
      await refresh();
      navigate("/teams");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось покинуть команду", "error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Общее" description={`Создана ${formatDateTime(detail.createdAt)}`} />
        <form onSubmit={handleSaveName} className="flex flex-wrap items-end gap-3">
          <Field label="Название" className="min-w-52 flex-1">
            <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} disabled={!canManageTeam} required />
          </Field>
          {canManageTeam && (
            <Button type="submit" loading={savingName} disabled={nameDraft.trim() === detail.name}>
              Сохранить
            </Button>
          )}
        </form>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
          <Badge>slug: {detail.slug}</Badge>
          {detail.kind === "main" && <Badge variant="accent">Основное пространство</Badge>}
          <Badge>{detail.memberCount} участников</Badge>
          <Badge>{detail.artifactCount} артефактов</Badge>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Время жизни артефактов"
          description={`Инстанс допускает не больше ${formatLifetime(detail.globalMaxArtifactLifetimeMinutes)}. Уменьшение необратимо укорачивает срок уже созданных артефактов.`}
        />
        {detail.maxArtifactLifetimeMinutes === null ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted">
              Наследуется лимит инстанса: <strong className="text-fg">{formatLifetime(detail.effectiveMaxArtifactLifetimeMinutes)}</strong>
            </p>
            {canManageTeam && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleSaveLifetime(detail.globalMaxArtifactLifetimeMinutes ?? 1440)}
              >
                Задать своё значение
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <LifetimeSelect
              value={detail.maxArtifactLifetimeMinutes}
              maxMinutes={detail.globalMaxArtifactLifetimeMinutes}
              disabled={!canManageTeam}
              onChange={(minutes) => handleSaveLifetime(minutes ?? detail.globalMaxArtifactLifetimeMinutes)}
            />
            {canManageTeam && (
              <Button variant="ghost" size="sm" onClick={() => handleSaveLifetime(null)}>
                Наследовать лимит инстанса
              </Button>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Хранилище" description={`Используется: ${formatQuota(detail.usedBytes)}. Считаются исходники артефактов и загруженные файлы вместе.`} />
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
          <QuotaField
            label="Квота команды"
            value={detail.storageQuotaBytes}
            globalValue={detail.globalOrgQuotaBytes}
            effectiveValue={detail.effectiveOrgQuotaBytes}
            canManage={false}
            onSave={(bytes) => handleSaveQuota("storageQuotaBytes", bytes)}
          />
          <QuotaField
            label="Квота на артефакт"
            value={detail.artifactQuotaBytes}
            globalValue={detail.globalArtifactQuotaBytes}
            effectiveValue={detail.effectiveArtifactQuotaBytes}
            canManage={canManageTeam}
            onSave={(bytes) => handleSaveQuota("artifactQuotaBytes", bytes)}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Ссылки на артефакты"
          description={`Инстанс ${detail.globalAllowPublicShares ? "разрешает" : "запрещает"} публичные ссылки; настройка по умолчанию на инстансе — «${label(DEFAULT_SHARE_MODE_LABELS, detail.globalDefaultShareMode)}».`}
        />
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-fg">Ссылка по умолчанию</p>
            {detail.defaultShareMode === null ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted">
                  Наследуется настройка инстанса: <strong className="text-fg">{label(DEFAULT_SHARE_MODE_LABELS, detail.effectiveDefaultShareMode)}</strong>
                </p>
                {canManageTeam && (
                  <Button variant="secondary" size="sm" onClick={() => handleSaveSharePolicy({ defaultShareMode: detail.globalDefaultShareMode })}>
                    Задать своё значение
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={detail.defaultShareMode}
                  disabled={!canManageTeam}
                  onChange={(e) => handleSaveSharePolicy({ defaultShareMode: e.target.value as DefaultShareMode })}
                  className="h-8 w-64"
                >
                  <option value="team">{DEFAULT_SHARE_MODE_LABELS.team}</option>
                  <option value="public" disabled={!detail.effectiveAllowPublicShares}>
                    {DEFAULT_SHARE_MODE_LABELS.public}
                  </option>
                </Select>
                {canManageTeam && (
                  <Button variant="ghost" size="sm" onClick={() => handleSaveSharePolicy({ defaultShareMode: null })}>
                    Наследовать настройку инстанса
                  </Button>
                )}
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-fg">Публичные ссылки</p>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={detail.allowPublicShares ? "allow" : "forbid"}
                disabled={!canManageTeam || !detail.globalAllowPublicShares}
                onChange={(e) => handleTogglePublicShares(e.target.value === "allow")}
                className="h-8 w-64"
              >
                <option value="allow">Разрешены</option>
                <option value="forbid">Запрещены</option>
              </Select>
              {!detail.globalAllowPublicShares && <span className="text-xs text-muted">Запрещено на уровне инстанса</span>}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Участники" />
        <Table>
          <THead>
            <TR>
              <TH>Имя</TH>
              <TH>Email</TH>
              <TH>Роль</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {members.length === 0 && <TableEmptyRow colSpan={4}>Нет участников</TableEmptyRow>}
            {members.map((m) => (
              <TR key={m.userId}>
                <TD>{m.name}</TD>
                <TD className="text-muted">{m.email}</TD>
                <TD>
                  {canManageTeam ? (
                    <Select value={m.role} onChange={(e) => handleChangeRole(m.userId, e.target.value)} className="h-8 w-36">
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {ORG_ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    label(ORG_ROLE_LABELS, m.role)
                  )}
                </TD>
                <TD className="text-right">
                  {canManageTeam && m.userId !== me?.id && (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(m)}>
                      Удалить
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      {canManageTeam && (
        <Card>
          <CardHeader title="Приглашения" description="Ссылка одноразовая: повторное приглашение того же email перевыпускает её." />
          <form onSubmit={handleInvite} className="mb-4 flex flex-wrap items-end gap-3">
            <Field label="Email" className="min-w-52 flex-1">
              <Input type="email" placeholder="email@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
            </Field>
            <Field label="Роль">
              <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="w-36">
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {ORG_ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" loading={inviting}>
              Пригласить
            </Button>
          </form>
          <Table>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH>Роль</TH>
                <TH>Статус</TH>
                <TH>Истекает</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {invites.length === 0 && <TableEmptyRow colSpan={5}>Нет активных приглашений</TableEmptyRow>}
              {invites.map((inv) => (
                <TR key={inv.id}>
                  <TD>{inv.email}</TD>
                  <TD>{label(ORG_ROLE_LABELS, inv.role)}</TD>
                  <TD>
                    <Badge variant={inv.expired ? "warning" : "neutral"}>{inv.expired ? "Истекло" : label(INVITE_STATUS_LABELS, inv.status)}</Badge>
                  </TD>
                  <TD className="text-muted">{formatDateTime(inv.expiresAt)}</TD>
                  <TD className="flex justify-end gap-2">
                    <CopyButton value={`${window.location.origin}/invite/${inv.token}`} label="Ссылка" />
                    <Button variant="ghost" size="sm" onClick={() => handleReissue(inv)}>
                      Заново
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleRevokeInvite(inv.id)}>
                      Отозвать
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {detail.kind !== "main" && (
        <Card>
          <CardHeader title="Опасная зона" />
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">Вы больше не будете видеть артефакты и участников этой команды.</p>
            <Button variant="danger" onClick={() => setConfirmLeave(true)}>
              Покинуть команду
            </Button>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={handleRemoveMember}
        title="Удалить участника"
        description={confirmRemove ? `${confirmRemove.name ?? confirmRemove.email} потеряет доступ к этой команде.` : undefined}
        confirmLabel="Удалить"
      />
      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={handleLeave}
        title="Покинуть команду"
        description="Вы потеряете доступ к артефактам и участникам этой команды."
        confirmLabel="Покинуть"
      />

      <Dialog open={revokeDialogOpen} onClose={() => setRevokeDialogOpen(false)} title={`Найдено ${activePublicShares} активных публичных ссылок`}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Запрет действует только на новые ссылки. Уже созданные публичные ссылки продолжат работать, пока их не отозвать.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => handleForbidAndRevoke(false)}>
              Только запретить новые
            </Button>
            <Button variant="danger" onClick={() => handleForbidAndRevoke(true)}>
              Запретить и отозвать все
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/**
 * Same "inherit / set your own" pattern as the lifetime card above, in bytes (shown/edited as MB).
 * `canManage` is passed separately from the surrounding page's `canManageTeam` because the two
 * quota fields have different edit permissions: the team-wide quota is superadmin-only (matches
 * `storageQuotaBytes`'s existing permission in routes/orgs.ts), the per-artifact one is owner/admin.
 */
function QuotaField({
  label,
  value,
  globalValue,
  effectiveValue,
  canManage,
  onSave,
}: {
  label: string;
  value: number | null;
  globalValue: number | null;
  effectiveValue: number | null;
  canManage: boolean;
  onSave: (bytes: number | null) => void;
}) {
  const [draftMb, setDraftMb] = useState(() => (value !== null ? String(Math.round(value / 1024 / 1024)) : ""));
  useEffect(() => setDraftMb(value !== null ? String(Math.round(value / 1024 / 1024)) : ""), [value]);

  return (
    <div className="flex-1">
      <p className="mb-2 text-sm font-medium text-fg">{label}</p>
      {value === null ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">
            Наследуется: <strong className="text-fg">{formatQuota(effectiveValue)}</strong>
          </p>
          {canManage && (
            <Button variant="secondary" size="sm" onClick={() => onSave(globalValue ?? 1024 * 1024 * 1024)}>
              Задать своё значение
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input type="number" min={1} className="w-28" value={draftMb} onChange={(e) => setDraftMb(e.target.value)} disabled={!canManage} />
          <span className="text-sm text-muted">МБ</span>
          {canManage && (
            <>
              <Button variant="secondary" size="sm" disabled={!draftMb || Number(draftMb) * 1024 * 1024 === value} onClick={() => onSave(Math.round(Number(draftMb) * 1024 * 1024))}>
                Сохранить
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onSave(null)}>
                Наследовать
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
