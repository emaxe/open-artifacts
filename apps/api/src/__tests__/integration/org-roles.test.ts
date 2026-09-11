import { beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, extractCookie, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

async function inviteAndRegister(app: ReturnType<typeof buildTestApp>, owner: { orgId: string; sessionCookie: string }, email: string) {
  const inviteRes = await app.request(`/api/v1/orgs/${owner.orgId}/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
    body: JSON.stringify({ email, role: "member" }),
  });
  const invite = (await inviteRes.json()) as { token: string };
  const res = await app.request(`/api/v1/auth/register?invite=${invite.token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery staple", name: "Member" }),
  });
  const body = (await res.json()) as { userId: string };
  const sessionCookie = extractCookie(res, "oa_session")!;
  return { userId: body.userId, sessionCookie };
}

describe("PATCH /orgs/:id/members/:userId", () => {
  it("lets an owner promote a member to admin", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const member = await inviteAndRegister(app, owner, "member@example.com");

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/members/${member.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ role: "admin" }),
    });
    expect(res.status).toBe(200);

    const membersRes = await app.request(`/api/v1/orgs/${owner.orgId}/members`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    const membersBody = (await membersRes.json()) as { members: { userId: string; role: string }[] };
    expect(membersBody.members.find((m) => m.userId === member.userId)?.role).toBe("admin");
  });

  it("refuses to demote the last remaining owner", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/members/${owner.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ role: "member" }),
    });
    expect(res.status).toBe(409);
  });

  it("rejects a plain member trying to change roles", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const other = await inviteAndRegister(app, owner, "other@example.com");
    const acting = await inviteAndRegister(app, owner, "acting@example.com");

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/members/${other.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${acting.sessionCookie}` },
      body: JSON.stringify({ role: "admin" }),
    });
    expect(res.status).toBe(403);
  });
});
