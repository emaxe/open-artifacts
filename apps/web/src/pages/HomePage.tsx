import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type OrgDetail } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ORG_ROLE_LABELS, label, pluralRu } from "../lib/labels";
import { PageContainer } from "../components/PageContainer";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { CodeBlock } from "../components/ui/CodeBlock";
import { Spinner } from "../components/ui/Spinner";
import { OrgIdentity } from "../components/OrgIdentity";
import { MailIcon, PlugIcon, SettingsIcon, ShieldIcon, UsersIcon } from "../components/ui/icons";

/** One row per team the user belongs to, with the member/artifact counts `Me.orgs` doesn't carry
 * — fetched from GET /orgs/:id (the same call TeamLayout makes), which stays scoped to the
 * user's own memberships even for a superadmin, unlike GET /orgs without a search term. */
interface TeamRow {
  orgId: string;
  name: string;
  slug: string;
  kind: "main" | "team";
  role: string | null;
  memberCount: number;
  artifactCount: number;
}

export function HomePage() {
  const { me } = useAuth();
  const [teams, setTeams] = useState<TeamRow[] | null>(null);

  useEffect(() => {
    if (!me) return;
    Promise.all(
      me.orgs.map((org) =>
        api
          .get<OrgDetail>(`/orgs/${org.orgId}`)
          .then((detail): TeamRow => ({ orgId: org.orgId, name: org.name, slug: org.slug, kind: org.kind, role: org.role, memberCount: detail.memberCount, artifactCount: detail.artifactCount }))
          .catch((): TeamRow => ({ orgId: org.orgId, name: org.name, slug: org.slug, kind: org.kind, role: org.role, memberCount: 0, artifactCount: 0 })),
      ),
    ).then(setTeams);
  }, [me]);

  if (!me) return null;

  const origin = window.location.origin;
  const totalArtifacts = teams?.reduce((sum, t) => sum + t.artifactCount, 0) ?? null;

  return (
    <PageContainer>
      <PageHeader title={`Здравствуйте, ${me.name}!`} description="Обзор ваших команд и быстрый старт для подключения ИИ-агентов." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Команд" value={me.orgs.length} />
        <StatCard label="Артефактов всего" value={totalArtifacts ?? "…"} />
        <StatCard label="Ожидающих приглашений" value={me.pendingInviteCount} />
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Ваши команды" />
          {!teams ? (
            <Spinner />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {teams.map((team) => (
                <Link
                  key={team.orgId}
                  to={`/t/${team.orgId}`}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:bg-panel-muted"
                >
                  <OrgIdentity org={{ id: team.orgId, name: team.name, slug: team.slug, kind: team.kind }} secondary="slug" />
                  <div className="flex items-center gap-4 text-xs text-muted">
                    <span>{label(ORG_ROLE_LABELS, team.role ?? "")}</span>
                    <span>
                      {team.artifactCount} {pluralRu(team.artifactCount, ["артефакт", "артефакта", "артефактов"])}
                    </span>
                    <span>
                      {team.memberCount} {pluralRu(team.memberCount, ["участник", "участника", "участников"])}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Быстрый старт: подключение агента" description="Полная инструкция со всеми способами авторизации и MCP — на отдельной странице." />
          <div className="mb-3">
            <strong className="text-sm text-fg">1. Установите скилл в проект агента:</strong>
            <CodeBlock text="npx skills add emaxe/open-artifacts" />
          </div>
          <div>
            <strong className="text-sm text-fg">2. Авторизуйте агента:</strong>
            <CodeBlock text={`oa login --server ${origin}`} />
          </div>
          <Link to="/help/agents" className="mt-3 inline-block text-sm font-medium text-fg underline">
            Подробная инструкция →
          </Link>
        </Card>

        <Card>
          <CardHeader title="Быстрые ссылки" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <QuickLink to="/teams" icon={<UsersIcon size={16} />} label="Команды" />
            <QuickLink to="/invites" icon={<MailIcon size={16} />} label="Приглашения" />
            <QuickLink to="/settings" icon={<SettingsIcon size={16} />} label="Настройки" />
            <QuickLink to="/help/agents" icon={<PlugIcon size={16} />} label="Подключение агентов" />
            {me.isSuperadmin && <QuickLink to="/admin" icon={<ShieldIcon size={16} />} label="Админка" />}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-semibold text-fg">{value}</div>
    </Card>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-control border border-border px-3 py-2 text-sm font-medium text-fg hover:bg-panel-muted">
      {icon} {label}
    </Link>
  );
}
