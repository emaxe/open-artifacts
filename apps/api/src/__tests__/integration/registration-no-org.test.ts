import { beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, extractCookie, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("registration without an invite", () => {
  it("does not create a personal org for the new user", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "solo@example.com", password: "correct horse battery staple", name: "Solo" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { userId: string; orgId: string | null };
    expect(body.orgId).toBeNull();

    const sessionCookie = extractCookie(res, "oa_session")!;
    const meRes = await app.request("/api/v1/auth/me", { headers: { Cookie: `oa_session=${sessionCookie}` } });
    const me = (await meRes.json()) as { orgs: unknown[] };
    expect(me.orgs).toHaveLength(0);
  });

  it("still joins the invited org when registering via an invite link", async () => {
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
    const body = (await res.json()) as { orgId: string };
    expect(body.orgId).toBe(owner.orgId);
  });
});
