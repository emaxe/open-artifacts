import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("GET /agents without orgId", () => {
  it("combines agents across all of a regular user's orgs", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);
    const secondOrgRes = await app.request("/api/v1/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${user.sessionCookie}` },
      body: JSON.stringify({ name: "Second Team" }),
    });
    const secondOrg = (await secondOrgRes.json()) as { id: string };

    for (const orgId of [user.orgId, secondOrg.id]) {
      await app.request(`/api/v1/agents?orgId=${orgId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `oa_session=${user.sessionCookie}` },
        body: JSON.stringify({ name: `agent-${orgId.slice(0, 4)}` }),
      });
    }

    const res = await app.request("/api/v1/agents", { headers: { Cookie: `oa_session=${user.sessionCookie}` } });
    const body = (await res.json()) as { agents: { orgId: string }[] };
    expect(body.agents).toHaveLength(2);
  });

  it("returns agents from every org in the system for a superadmin", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    await app.request(`/api/v1/agents?orgId=${owner.orgId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ name: "owner-agent" }),
    });

    const admin = await registerAndLogin(app);
    await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, admin.userId));

    const res = await app.request("/api/v1/agents", { headers: { Cookie: `oa_session=${admin.sessionCookie}` } });
    const body = (await res.json()) as { agents: { orgId: string }[] };
    expect(body.agents.some((a) => a.orgId === owner.orgId)).toBe(true);
  });
});
