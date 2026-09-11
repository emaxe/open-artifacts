import { beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, extractCookie, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

async function createInvite(app: ReturnType<typeof buildTestApp>, owner: { orgId: string; sessionCookie: string }, email: string) {
  const res = await app.request(`/api/v1/orgs/${owner.orgId}/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
    body: JSON.stringify({ email, role: "member" }),
  });
  return (await res.json()) as { token: string };
}

describe("registering with an invite token enforces the invited email", () => {
  it("rejects registering with a different email than the one invited (closes the impersonation hole)", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const invite = await createInvite(app, owner, "invited@example.com");

    const res = await app.request(`/api/v1/auth/register?invite=${invite.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "attacker@example.com", password: "correct horse battery staple", name: "Attacker" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invite_email_mismatch");
  });

  it("accepts registering without an email field at all, using the invite's address (the web UI never sends one — see InvitePage.tsx)", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const invite = await createInvite(app, owner, "no-email-field@example.com");

    const res = await app.request(`/api/v1/auth/register?invite=${invite.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "correct horse battery staple", name: "No Email Field" }),
    });
    expect(res.status).toBe(201);

    const sessionCookie = extractCookie(res, "oa_session")!;
    const meRes = await app.request("/api/v1/auth/me", { headers: { Cookie: `oa_session=${sessionCookie}` } });
    const me = (await meRes.json()) as { email: string };
    expect(me.email).toBe("no-email-field@example.com");
  });

  it("accepts a case-different but matching email", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const invite = await createInvite(app, owner, "matches@example.com");

    const res = await app.request(`/api/v1/auth/register?invite=${invite.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "Matches@Example.com", password: "correct horse battery staple", name: "Matches" }),
    });
    expect(res.status).toBe(201);
  });

  it("409s with the invite token attached when the invited email is already registered", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const existing = await registerAndLogin(app, { email: "already-here@example.com" });
    const invite = await createInvite(app, owner, existing.email);

    const res = await app.request(`/api/v1/auth/register?invite=${invite.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: existing.email, password: "correct horse battery staple", name: "Whoever" }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string }; inviteToken: string | null };
    expect(body.error.code).toBe("email_taken");
    expect(body.inviteToken).toBe(invite.token);
  });

  it("400s for an invalid or expired invite token before even checking the email", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/v1/auth/register?invite=not-a-real-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "whoever@example.com", password: "correct horse battery staple", name: "Whoever" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_invite");
  });

  it("registering by invite makes the user a member of both the invited org and their own main workspace", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const invite = await createInvite(app, owner, "fresh@example.com");

    const res = await app.request(`/api/v1/auth/register?invite=${invite.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "fresh@example.com", password: "correct horse battery staple", name: "Fresh" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { mainOrgId: string; orgId: string };

    const sessionCookie = extractCookie(res, "oa_session")!;
    const meRes = await app.request("/api/v1/auth/me", { headers: { Cookie: `oa_session=${sessionCookie}` } });
    const me = (await meRes.json()) as { orgs: { orgId: string; role: string }[] };
    expect(me.orgs.map((o) => o.orgId).sort()).toEqual([body.mainOrgId, owner.orgId].sort());
    expect(me.orgs.find((o) => o.orgId === body.mainOrgId)?.role).toBe("owner");
    expect(me.orgs.find((o) => o.orgId === owner.orgId)?.role).toBe("member");
  });
});
