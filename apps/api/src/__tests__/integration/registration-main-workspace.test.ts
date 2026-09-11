import { beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, extractCookie, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("registration always provisions a main workspace", () => {
  it("creates a 'main' workspace and makes the new user its owner", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "solo@example.com", password: "correct horse battery staple", name: "Solo" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { userId: string; mainOrgId: string; orgId: string | null };
    expect(body.mainOrgId).toBeTruthy();
    expect(body.orgId).toBeNull();

    const sessionCookie = extractCookie(res, "oa_session")!;
    const meRes = await app.request("/api/v1/auth/me", { headers: { Cookie: `oa_session=${sessionCookie}` } });
    const me = (await meRes.json()) as { orgs: { orgId: string; role: string; kind?: string }[] };
    expect(me.orgs).toHaveLength(1);
    expect(me.orgs[0]!.orgId).toBe(body.mainOrgId);
    expect(me.orgs[0]!.role).toBe("owner");

    const orgRes = await app.request(`/api/v1/orgs/${body.mainOrgId}`, { headers: { Cookie: `oa_session=${sessionCookie}` } });
    const org = (await orgRes.json()) as { kind: string; myRole: string };
    expect(org.kind).toBe("main");
    expect(org.myRole).toBe("owner");
  });

  it("also creates a main workspace when registering via an invite link, alongside the invited org", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);

    const inviteRes = await app.request(`/api/v1/orgs/${owner.orgId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ email: "invitee@example.com", role: "member" }),
    });
    const invite = (await inviteRes.json()) as { token: string };

    const res = await app.request(`/api/v1/auth/register?invite=${invite.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invitee@example.com", password: "correct horse battery staple", name: "Invitee" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { mainOrgId: string; orgId: string };
    expect(body.orgId).toBe(owner.orgId);
    expect(body.mainOrgId).not.toBe(owner.orgId);

    const sessionCookie = extractCookie(res, "oa_session")!;
    const meRes = await app.request("/api/v1/auth/me", { headers: { Cookie: `oa_session=${sessionCookie}` } });
    const me = (await meRes.json()) as { orgs: { orgId: string }[] };
    expect(me.orgs.map((o) => o.orgId).sort()).toEqual([body.mainOrgId, owner.orgId].sort());
  });

  it("refuses to remove the last owner from their own main workspace", async () => {
    const app = buildTestApp();
    const solo = await registerAndLogin(app);

    const res = await app.request(`/api/v1/orgs/${solo.mainOrgId}/members/${solo.userId}`, {
      method: "DELETE",
      headers: { Cookie: `oa_session=${solo.sessionCookie}` },
    });
    expect(res.status).toBe(409);
  });
});
