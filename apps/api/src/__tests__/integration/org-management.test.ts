import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

async function makeSuperadmin(userId: string) {
  await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, userId));
}

describe("PATCH /orgs/:id", () => {
  it("lets an owner rename their org", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);

    const res = await app.request(`/api/v1/orgs/${owner.orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ name: "Renamed Team" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe("Renamed Team");
  });

  it("rejects a non-superadmin changing the storage quota", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);

    const res = await app.request(`/api/v1/orgs/${owner.orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ storageQuotaBytes: 999 }),
    });
    expect(res.status).toBe(403);
  });

  it("lets a superadmin change the storage quota", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const superadmin = await registerAndLogin(app);
    await makeSuperadmin(superadmin.userId);

    const res = await app.request(`/api/v1/orgs/${owner.orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${superadmin.sessionCookie}` },
      body: JSON.stringify({ storageQuotaBytes: 12345 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { storageQuotaBytes: number };
    expect(body.storageQuotaBytes).toBe(12345);
  });

  it("rejects a plain member from renaming the org", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const memberInviteRes = await app.request(`/api/v1/orgs/${owner.orgId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ email: "renamer@example.com", role: "member" }),
    });
    const invite = (await memberInviteRes.json()) as { token: string };
    const regRes = await app.request(`/api/v1/auth/register?invite=${invite.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "renamer@example.com", password: "correct horse battery staple", name: "Renamer" }),
    });
    const sessionCookie = /oa_session=([^;]+)/.exec(regRes.headers.get("set-cookie")!)![1];

    const res = await app.request(`/api/v1/orgs/${owner.orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
      body: JSON.stringify({ name: "Should not work" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /orgs/:id/members", () => {
  it("adds an existing user directly to an org, bypassing the invite flow", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const target = await registerAndLogin(app, { email: "direct-add@example.com" });

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ userId: target.userId, role: "admin" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { alreadyMember: boolean };
    expect(body.alreadyMember).toBe(false);

    const membersRes = await app.request(`/api/v1/orgs/${owner.orgId}/members`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    const membersBody = (await membersRes.json()) as { members: { userId: string; role: string }[] };
    expect(membersBody.members.find((m) => m.userId === target.userId)?.role).toBe("admin");
  });

  it("is idempotent when the user is already a member", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const target = await registerAndLogin(app, { email: "already-added@example.com" });

    await app.request(`/api/v1/orgs/${owner.orgId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ userId: target.userId }),
    });
    const second = await app.request(`/api/v1/orgs/${owner.orgId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ userId: target.userId }),
    });
    expect(second.status).toBe(200);
    const body = (await second.json()) as { alreadyMember: boolean };
    expect(body.alreadyMember).toBe(true);
  });

  it("404s for a non-existent userId", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ userId: "00000000-0000-0000-0000-000000000000" }),
    });
    expect(res.status).toBe(404);
  });

  it("a superadmin can add a member to any org", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const superadmin = await registerAndLogin(app);
    await makeSuperadmin(superadmin.userId);
    const target = await registerAndLogin(app, { email: "superadmin-added@example.com" });

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${superadmin.sessionCookie}` },
      body: JSON.stringify({ userId: target.userId }),
    });
    expect(res.status).toBe(201);
  });
});

describe("cannot leave or be removed from your own main workspace", () => {
  it("refuses to remove the creator from their own main workspace even via superadmin", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);
    const superadmin = await registerAndLogin(app);
    await makeSuperadmin(superadmin.userId);

    const res = await app.request(`/api/v1/orgs/${user.mainOrgId}/members/${user.userId}`, {
      method: "DELETE",
      headers: { Cookie: `oa_session=${superadmin.sessionCookie}` },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("cannot_leave_main_org");
  });

  it("still allows leaving a 'main' workspace someone else created, if you were invited into it", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const inviteRes = await app.request(`/api/v1/orgs/${owner.mainOrgId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ email: "guest-in-main@example.com", role: "member" }),
    });
    const invite = (await inviteRes.json()) as { token: string };
    const regRes = await app.request(`/api/v1/auth/register?invite=${invite.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "guest-in-main@example.com", password: "correct horse battery staple", name: "Guest" }),
    });
    const guestBody = (await regRes.json()) as { userId: string };
    const guestCookie = /oa_session=([^;]+)/.exec(regRes.headers.get("set-cookie")!)![1];

    const res = await app.request(`/api/v1/orgs/${owner.mainOrgId}/members/${guestBody.userId}`, {
      method: "DELETE",
      headers: { Cookie: `oa_session=${guestCookie}` },
    });
    expect(res.status).toBe(200);
  });
});

describe("GET /orgs with ?kind and owner-email search", () => {
  it("filters by kind=main / kind=team", async () => {
    const app = buildTestApp();
    const superadmin = await registerAndLogin(app);
    await makeSuperadmin(superadmin.userId);
    await registerAndLogin(app);

    const mainRes = await app.request("/api/v1/orgs?kind=main&pageSize=100", { headers: { Cookie: `oa_session=${superadmin.sessionCookie}` } });
    const mainBody = (await mainRes.json()) as { orgs: { kind: string }[] };
    expect(mainBody.orgs.length).toBeGreaterThan(0);
    expect(mainBody.orgs.every((o) => o.kind === "main")).toBe(true);

    const teamRes = await app.request("/api/v1/orgs?kind=team&pageSize=100", { headers: { Cookie: `oa_session=${superadmin.sessionCookie}` } });
    const teamBody = (await teamRes.json()) as { orgs: { kind: string }[] };
    expect(teamBody.orgs.every((o) => o.kind === "team")).toBe(true);
  });

  it("matches orgs by their owner's email", async () => {
    const app = buildTestApp();
    const superadmin = await registerAndLogin(app);
    await makeSuperadmin(superadmin.userId);
    const owner = await registerAndLogin(app, { email: "findme-by-email@example.com" });

    const res = await app.request(`/api/v1/orgs?search=findme-by-email&pageSize=100`, { headers: { Cookie: `oa_session=${superadmin.sessionCookie}` } });
    const body = (await res.json()) as { orgs: { id: string; owner: { email: string } | null }[] };
    expect(body.orgs.some((o) => o.id === owner.mainOrgId)).toBe(true);
    expect(body.orgs.find((o) => o.id === owner.mainOrgId)?.owner?.email).toBe(owner.email);
  });

  it("reports member and artifact counts", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);

    const res = await app.request(`/api/v1/orgs/${owner.mainOrgId}`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    const body = (await res.json()) as { memberCount: number; artifactCount: number; owner: { email: string } | null };
    expect(body.memberCount).toBe(1);
    expect(body.artifactCount).toBe(0);
    expect(body.owner?.email).toBe(owner.email);
  });
});
