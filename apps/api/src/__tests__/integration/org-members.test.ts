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

describe("DELETE /orgs/:id/members/:userId", () => {
  it("refuses to remove the last remaining owner", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/members/${owner.userId}`, {
      method: "DELETE",
      headers: { Cookie: `oa_session=${owner.sessionCookie}` },
    });
    expect(res.status).toBe(409);

    const membersRes = await app.request(`/api/v1/orgs/${owner.orgId}/members`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    const membersBody = (await membersRes.json()) as { members: unknown[] };
    expect(membersBody.members).toHaveLength(1);
  });

  it("lets an owner remove another member", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const member = await inviteAndRegister(app, owner, "member@example.com");

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/members/${member.userId}`, {
      method: "DELETE",
      headers: { Cookie: `oa_session=${owner.sessionCookie}` },
    });
    expect(res.status).toBe(200);

    const membersRes = await app.request(`/api/v1/orgs/${owner.orgId}/members`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    const membersBody = (await membersRes.json()) as { members: { userId: string }[] };
    expect(membersBody.members.find((m) => m.userId === member.userId)).toBeUndefined();
  });

  it("rejects a plain member trying to remove someone else", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const other = await inviteAndRegister(app, owner, "other@example.com");
    const acting = await inviteAndRegister(app, owner, "acting@example.com");

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/members/${other.userId}`, {
      method: "DELETE",
      headers: { Cookie: `oa_session=${acting.sessionCookie}` },
    });
    expect(res.status).toBe(403);
  });

  it("lets a member leave the org on their own, regardless of role", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const member = await inviteAndRegister(app, owner, "member@example.com");

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/members/${member.userId}`, {
      method: "DELETE",
      headers: { Cookie: `oa_session=${member.sessionCookie}` },
    });
    expect(res.status).toBe(200);

    const membersRes = await app.request(`/api/v1/orgs/${owner.orgId}/members`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    const membersBody = (await membersRes.json()) as { members: { userId: string }[] };
    expect(membersBody.members.find((m) => m.userId === member.userId)).toBeUndefined();
  });

  it("refuses to let the last owner leave", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/members/${owner.userId}`, {
      method: "DELETE",
      headers: { Cookie: `oa_session=${owner.sessionCookie}` },
    });
    expect(res.status).toBe(409);
  });

  it("404s when removing someone who isn't a member", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const stranger = await registerAndLogin(app);

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/members/${stranger.userId}`, {
      method: "DELETE",
      headers: { Cookie: `oa_session=${owner.sessionCookie}` },
    });
    expect(res.status).toBe(404);
  });
});
