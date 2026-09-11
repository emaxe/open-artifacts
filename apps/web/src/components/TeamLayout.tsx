import { createContext, useContext, useEffect, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api, type OrgDetail } from "../lib/api";
import { Tabs } from "./ui/Tabs";
import { Spinner } from "./ui/Spinner";
import { OrgIdentity } from "./OrgIdentity";
import { PageContainer } from "./PageContainer";

const TeamContext = createContext<OrgDetail | null>(null);

/** The current team's detail, as resolved by TeamLayout — lets pages show the org's name/kind without re-deriving it from `me.orgs` (which, for a superadmin, no longer includes orgs they don't belong to). */
export function useTeam(): OrgDetail | null {
  return useContext(TeamContext);
}

export function TeamLayout() {
  const { orgId } = useParams();
  const { me } = useAuth();
  const [team, setTeam] = useState<OrgDetail | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    setTeam(null);
    setForbidden(false);
    // GET /orgs/:id itself permits superadmins regardless of membership (routes/orgs.ts) — this
    // is what lets a superadmin open a team they don't belong to now that /auth/me only lists
    // their own memberships.
    api
      .get<OrgDetail>(`/orgs/${orgId}`)
      .then(setTeam)
      .catch(() => setForbidden(true));
  }, [orgId]);

  if (!me || !orgId) return null;
  if (forbidden) return <div className="p-6 text-sm text-muted">У вас нет доступа к этой команде</div>;
  if (!team) return <Spinner />;

  return (
    <TeamContext.Provider value={team}>
      <PageContainer>
        <div className="mb-4 flex items-center gap-3">
          <OrgIdentity org={team} secondary="slug" />
        </div>
        <Tabs
          className="mb-6"
          items={[
            { to: `/t/${orgId}/artifacts`, label: "Артефакты" },
            { to: `/t/${orgId}/agents`, label: "Агенты" },
            { to: `/t/${orgId}/settings`, label: "Настройки команды" },
          ]}
        />
        <Outlet />
      </PageContainer>
    </TeamContext.Provider>
  );
}
