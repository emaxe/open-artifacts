import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

async function makeSuperadmin(userId: string) {
  await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, userId));
}

describe("account status", () => {
  it("blocks login for a blocked account and reports account_blocked", async () => {
    const app = buildTestApp();
    const target = await registerAndLogin(app);
    const admin = await registerAndLogin(app);
    await makeSuperadmin(admin.userId);

    const blockRes = await app.request(`/api/v1/admin/users/${target.userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${admin.sessionCookie}` },
      body: JSON.stringify({ status: "blocked" }),
    });
    expect(blockRes.status).toBe(200);

    const loginRes = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: target.email, password: target.password }),
    });
    expect(loginRes.status).toBe(403);
    const body = (await loginRes.json()) as { error: { code: string } };
    expect(body.error.code).toBe("account_blocked");
  });

  it("invalidates the existing session immediately when a user is blocked", async () => {
    const app = buildTestApp();
    const target = await registerAndLogin(app);
    const admin = await registerAndLogin(app);
    await makeSuperadmin(admin.userId);

    const meBefore = await app.request("/api/v1/auth/me", { headers: { Cookie: `oa_session=${target.sessionCookie}` } });
    expect(meBefore.status).toBe(200);

    await app.request(`/api/v1/admin/users/${target.userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${admin.sessionCookie}` },
      body: JSON.stringify({ status: "blocked" }),
    });

    const meAfter = await app.request("/api/v1/auth/me", { headers: { Cookie: `oa_session=${target.sessionCookie}` } });
    expect(meAfter.status).toBe(401);
  });

  it("refuses to change the superadmin's own status", async () => {
    const app = buildTestApp();
    const admin = await registerAndLogin(app);
    await makeSuperadmin(admin.userId);

    const res = await app.request(`/api/v1/admin/users/${admin.userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${admin.sessionCookie}` },
      body: JSON.stringify({ status: "blocked" }),
    });
    expect(res.status).toBe(403);
  });

  it("deleting a user removes their org memberships", async () => {
    const app = buildTestApp();
    const target = await registerAndLogin(app);
    const admin = await registerAndLogin(app);
    await makeSuperadmin(admin.userId);

    await app.request(`/api/v1/admin/users/${target.userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${admin.sessionCookie}` },
      body: JSON.stringify({ status: "deleted" }),
    });

    const membersRes = await app.request(`/api/v1/orgs/${target.orgId}/members`, { headers: { Cookie: `oa_session=${admin.sessionCookie}` } });
    const membersBody = (await membersRes.json()) as { members: { userId: string }[] };
    expect(membersBody.members.find((m) => m.userId === target.userId)).toBeUndefined();
  });
});
