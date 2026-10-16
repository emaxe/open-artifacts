import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type OrgDetail } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ORG_ROLE_LABELS, label, pluralRu } from "../lib/labels";
import { PageContainer } from "../components/PageContainer";
import { PageHeader } from "../components/ui/PageHeader";
import { CodeBlock } from "../components/ui/CodeBlock";
import { Spinner } from "../components/ui/Spinner";
import { OrgIdentity } from "../components/OrgIdentity";

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
      <PageHeader title={`Здравствуйте, ${me.name}`} />

      <p className="-mt-4 mb-10 max-w-2xl text-xl leading-snug text-fg md:text-2xl">
        {me.orgs.length} {pluralRu(me.orgs.length, ["команда", "команды", "команд"])}
        {totalArtifacts !== null && (
          <>
            , {totalArtifacts} {pluralRu(totalArtifacts, ["артефакт", "артефакта", "артефактов"])}
          </>
        )}
        .{" "}
        {me.pendingInviteCount > 0 && (
          <Link to="/invites" className="font-semibold text-accent underline decoration-2 underline-offset-4 hover:no-underline">
            {me.pendingInviteCount} {pluralRu(me.pendingInviteCount, ["приглашение ждёт", "приглашения ждут", "приглашений ждут"])} ответа
          </Link>
        )}
      </p>

      <section className="mb-12">
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-fg">Ваши команды</h2>
        {!teams ? (
          <Spinner />
        ) : (
          <div className="flex flex-col gap-1">
            {teams.map((team) => (
              <Link
                key={team.orgId}
                to={`/t/${team.orgId}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-panel px-5 py-4 transition-colors duration-150 hover:bg-accent-soft"
              >
                <OrgIdentity org={{ id: team.orgId, name: team.name, slug: team.slug, kind: team.kind }} secondary="slug" />
                <div className="flex items-center gap-5 text-[0.9375rem] text-muted">
                  <span>{label(ORG_ROLE_LABELS, team.role ?? "")}</span>
                  <span className="tabular-nums">
                    {team.artifactCount} {pluralRu(team.artifactCount, ["артефакт", "артефакта", "артефактов"])}
                  </span>
                  <span className="tabular-nums">
                    {team.memberCount} {pluralRu(team.memberCount, ["участник", "участника", "участников"])}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-card bg-field p-6 text-field-fg md:p-8">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Подключите агента за две команды</h2>
        <p className="mt-2 max-w-prose text-[0.9375rem] opacity-80">Полная инструкция со всеми способами авторизации и MCP на отдельной странице.</p>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <strong className="text-[0.9375rem]">Установите скилл в проект агента</strong>
            <CodeBlock text="npx skills add emaxe/open-artifacts" />
          </div>
          <div>
            <strong className="text-[0.9375rem]">Авторизуйте агента</strong>
            <CodeBlock text={`oa login --server ${origin}`} />
          </div>
        </div>
        <Link to="/help/agents" className="mt-6 inline-block text-[0.9375rem] font-semibold underline decoration-2 underline-offset-4 hover:no-underline">
          Подробная инструкция →
        </Link>
      </section>
    </PageContainer>
  );
}
