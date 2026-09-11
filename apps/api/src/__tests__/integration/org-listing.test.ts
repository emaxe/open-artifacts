import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("GET /orgs", () => {
  it("returns only the caller's orgs, paginated", async () => {
    const app = buildTestApp();
    // registerAndLogin already leaves the user in two orgs: their auto-provisioned main
    // workspace, plus the explicit team org the helper creates on top.
    const user = await registerAndLogin(app);
    await app.request("/api/v1/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${user.sessionCookie}` },
      body: JSON.stringify({ name: "Second Team" }),
    });

    const res = await app.request("/api/v1/orgs?page=1&pageSize=1", { headers: { Cookie: `oa_session=${user.sessionCookie}` } });
    const body = (await res.json()) as { orgs: unknown[]; total: number; page: number };
    expect(body.total).toBe(3);
    expect(body.orgs).toHaveLength(1);
    expect(body.page).toBe(1);
  });

  it("returns every org in the system for a superadmin, including ones they don't belong to", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const admin = await registerAndLogin(app);
    await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, admin.userId));

    const res = await app.request("/api/v1/orgs?pageSize=100", { headers: { Cookie: `oa_session=${admin.sessionCookie}` } });
    const body = (await res.json()) as { orgs: { id: string; name: string; role: string | null }[] };
    const ownerOrg = body.orgs.find((o) => o.id === owner.orgId);
    expect(ownerOrg).toBeDefined();
    expect(ownerOrg?.role).toBeNull();

    const adminOrg = body.orgs.find((o) => o.id === admin.orgId);
    expect(adminOrg).toBeDefined();
    expect(adminOrg?.role).toBe("owner");
  });

  it("GET /auth/me returns only the superadmin's own memberships, not every org in the instance", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const admin = await registerAndLogin(app);
    await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, admin.userId));

    const meRes = await app.request("/api/v1/auth/me", { headers: { Cookie: `oa_session=${admin.sessionCookie}` } });
    const meBody = (await meRes.json()) as { orgs: { orgId: string }[]; mainOrgId: string };
    expect(meBody.orgs.some((o) => o.orgId === owner.orgId)).toBe(false);
    expect(meBody.orgs.some((o) => o.orgId === admin.orgId)).toBe(true);
    expect(meBody.orgs.some((o) => o.orgId === meBody.mainOrgId)).toBe(true);
  });
});

describe("GET /orgs/:id", () => {
  it("404s for a non-existent org and 403s for a non-member", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const outsider = await registerAndLogin(app);

    const notFound = await app.request(`/api/v1/orgs/00000000-0000-0000-0000-000000000000`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    expect(notFound.status).toBe(404);

    const forbidden = await app.request(`/api/v1/orgs/${owner.orgId}`, { headers: { Cookie: `oa_session=${outsider.sessionCookie}` } });
    expect(forbidden.status).toBe(403);
  });
});
