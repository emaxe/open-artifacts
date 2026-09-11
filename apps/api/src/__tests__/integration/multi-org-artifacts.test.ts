import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("GET /artifacts without orgId", () => {
  it("combines artifacts across all of a regular user's orgs", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);
    const secondOrgRes = await app.request("/api/v1/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${user.sessionCookie}` },
      body: JSON.stringify({ name: "Second Team" }),
    });
    const secondOrg = (await secondOrgRes.json()) as { id: string };

    for (const orgId of [user.orgId, secondOrg.id]) {
      await app.request(`/api/v1/artifacts?orgId=${orgId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `oa_session=${user.sessionCookie}` },
        body: JSON.stringify({ title: `Art in ${orgId}`, kind: "html", content: "<p>hi</p>", visibility: "private" }),
      });
    }

    const res = await app.request("/api/v1/artifacts", { headers: { Cookie: `oa_session=${user.sessionCookie}` } });
    const body = (await res.json()) as { artifacts: { orgId: string }[] };
    expect(body.artifacts).toHaveLength(2);
    expect(new Set(body.artifacts.map((a) => a.orgId))).toEqual(new Set([user.orgId, secondOrg.id]));
  });

  it("returns artifacts from every org in the system for a superadmin", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    await app.request(`/api/v1/artifacts?orgId=${owner.orgId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ title: "Owner's artifact", kind: "html", content: "<p>hi</p>", visibility: "private" }),
    });

    const admin = await registerAndLogin(app);
    await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, admin.userId));

    const res = await app.request("/api/v1/artifacts", { headers: { Cookie: `oa_session=${admin.sessionCookie}` } });
    const body = (await res.json()) as { artifacts: { orgId: string }[] };
    expect(body.artifacts.some((a) => a.orgId === owner.orgId)).toBe(true);
  });
});
