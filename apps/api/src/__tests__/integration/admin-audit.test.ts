import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

async function makeSuperadmin(userId: string) {
  await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, userId));
}

describe("GET /admin/audit", () => {
  it("resolves the actor's name/email instead of a raw user id", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const superadmin = await registerAndLogin(app);
    await makeSuperadmin(superadmin.userId);

    const res = await app.request(`/api/v1/admin/audit?limit=50`, { headers: { Cookie: `oa_session=${superadmin.sessionCookie}` } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: { actorId: string | null; actor: { email: string } | null; action: string }[]; nextCursor: string | null };
    const registerEntry = body.entries.find((e) => e.action === "user.register" && e.actorId === owner.userId);
    expect(registerEntry?.actor?.email).toBe(owner.email);
  });

  it("filters by orgId and action", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const superadmin = await registerAndLogin(app);
    await makeSuperadmin(superadmin.userId);

    const res = await app.request(
      `/api/v1/admin/audit?orgId=${owner.orgId}&action=org.create`,
      { headers: { Cookie: `oa_session=${superadmin.sessionCookie}` } },
    );
    const body = (await res.json()) as { entries: { orgId: string | null; action: string }[] };
    expect(body.entries.length).toBeGreaterThan(0);
    expect(body.entries.every((e) => e.orgId === owner.orgId && e.action === "org.create")).toBe(true);
  });

  it("paginates with a keyset cursor, never repeating or skipping a row", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const superadmin = await registerAndLogin(app);
    await makeSuperadmin(superadmin.userId);

    // Generate a handful of audit rows beyond registration itself.
    for (let i = 0; i < 5; i++) {
      await app.request(`/api/v1/orgs/${owner.orgId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
        body: JSON.stringify({ email: `page-${i}@example.com`, role: "member" }),
      });
    }

    const firstPage = await app.request(`/api/v1/admin/audit?limit=3`, { headers: { Cookie: `oa_session=${superadmin.sessionCookie}` } });
    const firstBody = (await firstPage.json()) as { entries: { id: string }[]; nextCursor: string | null };
    expect(firstBody.entries).toHaveLength(3);
    expect(firstBody.nextCursor).toBeTruthy();

    const secondPage = await app.request(`/api/v1/admin/audit?limit=3&cursor=${encodeURIComponent(firstBody.nextCursor!)}`, {
      headers: { Cookie: `oa_session=${superadmin.sessionCookie}` },
    });
    const secondBody = (await secondPage.json()) as { entries: { id: string }[] };
    const firstIds = new Set(firstBody.entries.map((e) => e.id));
    expect(secondBody.entries.every((e) => !firstIds.has(e.id))).toBe(true);
  });
});

describe("GET /admin/stats", () => {
  it("splits orgs into team and main counts", async () => {
    const app = buildTestApp();
    const superadmin = await registerAndLogin(app);
    await makeSuperadmin(superadmin.userId);
    await registerAndLogin(app); // one more main workspace

    const res = await app.request("/api/v1/admin/stats", { headers: { Cookie: `oa_session=${superadmin.sessionCookie}` } });
    const body = (await res.json()) as { teamOrgs: number; mainOrgs: number; orgs: number };
    expect(body.mainOrgs).toBeGreaterThanOrEqual(2);
    expect(body.teamOrgs).toBeGreaterThanOrEqual(1);
    expect(body.orgs).toBe(body.teamOrgs + body.mainOrgs);
  });
});
