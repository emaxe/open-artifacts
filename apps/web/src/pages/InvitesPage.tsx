import { useEffect, useState } from "react";
import { api, ApiError, type PendingInviteForUser } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ORG_ROLE_LABELS } from "../lib/labels";
import { PageContainer } from "../components/PageContainer";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";
import { OrgIdentity } from "../components/OrgIdentity";
import { MailIcon } from "../components/ui/icons";

/**
 * /invites — the only discovery channel for an already-registered user's pending invites, since
 * this project has no email delivery. Linked from the sidebar badge (GlobalSidebar.tsx).
 */
export function InvitesPage() {
  const { refresh } = useAuth();
  const toast = useToast();
  const [invites, setInvites] = useState<PendingInviteForUser[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const data = await api.get<{ invites: PendingInviteForUser[] }>("/invites/me");
    setInvites(data.invites);
  }

  useEffect(() => {
    load().catch(() => setInvites([]));
  }, []);

  async function handleAccept(invite: PendingInviteForUser) {
    setBusyId(invite.id);
    try {
      await api.post(`/invites/${invite.token}/accept`);
      await refresh();
      toast.show(`Вы присоединились к команде «${invite.orgName}»`, "success");
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось принять приглашение", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecline(invite: PendingInviteForUser) {
    setBusyId(invite.id);
    try {
      await api.post(`/invites/${invite.token}/decline`);
      toast.show("Приглашение отклонено", "info");
      await load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Не удалось отклонить приглашение", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Приглашения" description="Команды, которые пригласили вас присоединиться." />
      {invites === null ? (
        <Spinner />
      ) : invites.length === 0 ? (
        <EmptyState
          icon={<MailIcon size={28} />}
          title="Пока нет приглашений"
          description="Когда кто-то пригласит вас в команду, приглашение появится здесь."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {invites.map((invite) => (
            <Card key={invite.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <OrgIdentity org={{ id: invite.orgId, name: invite.orgName, slug: "", kind: invite.orgKind }} secondary="none" />
                <Badge variant="accent">{ORG_ROLE_LABELS[invite.role] ?? invite.role}</Badge>
                {invite.inviterName && <span className="text-xs text-muted">от {invite.inviterName}</span>}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={busyId === invite.id} onClick={() => handleDecline(invite)}>
                  Отклонить
                </Button>
                <Button size="sm" loading={busyId === invite.id} onClick={() => handleAccept(invite)}>
                  Принять
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
