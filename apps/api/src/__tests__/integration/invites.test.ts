import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { invites } from "../../db/schema.js";
import { buildTestApp, extractCookie, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

async function invite(
  app: ReturnType<typeof buildTestApp>,
  owner: { orgId: string; sessionCookie: string },
  email: string,
  role = "member",
) {
  const res = await app.request(`/api/v1/orgs/${owner.orgId}/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
    body: JSON.stringify({ email, role }),
  });
  const body = (await res.json()) as {
    id: string;
    token: string;
    acceptUrl: string;
    email: string;
    role: string;
    status: string;
    accountExists: boolean;
    reissued: boolean;
  };
  return { res, body };
}

describe("POST /orgs/:id/invites", () => {
  it("creates a pending invite and reports accountExists=false for a brand-new email", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);

    const { res, body } = await invite(app, owner, "new@example.com");
    expect(res.status).toBe(201);
    expect(body.accountExists).toBe(false);
    expect(body.reissued).toBe(false);
    expect(body.status).toBe("pending");
    expect(body.acceptUrl).toContain(body.token);
  });

  it("reports accountExists=true when the invited email already has an account", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const existing = await registerAndLogin(app, { email: "existing@example.com" });

    const { body } = await invite(app, owner, existing.email);
    expect(body.accountExists).toBe(true);
  });

  it("reissues (rather than duplicates) a still-pending invite to the same email", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);

    const first = await invite(app, owner, "dup@example.com", "viewer");
    const second = await invite(app, owner, "dup@example.com", "admin");

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.token).not.toBe(first.body.token);
    expect(second.body.role).toBe("admin");
    expect(second.body.reissued).toBe(true);

    // The old token is dead — reissuing invalidated it.
    const oldPreview = await app.request(`/api/v1/invites/${first.body.token}`);
    expect(oldPreview.status).toBe(404);
  });

  it("409s when the invitee is already a member", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app, { email: "member@example.com" });

    const first = await invite(app, owner, member.email);
    const acceptRes = await app.request(`/api/v1/invites/${first.body.token}/accept`, {
      method: "POST",
      headers: { Cookie: `oa_session=${member.sessionCookie}` },
    });
    expect(acceptRes.status).toBe(200);

    const { res } = await invite(app, owner, member.email);
    expect(res.status).toBe(409);
  });

  it("409s when inviting a blocked account", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const target = await registerAndLogin(app, { email: "blocked@example.com" });
    const db = getTestDb();
    const { users } = await import("../../db/schema.js");
    await db.update(users).set({ status: "blocked" }).where(eq(users.id, target.userId));

    const { res } = await invite(app, owner, target.email);
    expect(res.status).toBe(409);
  });

  it("rejects a plain member from creating invites", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app, { email: "member2@example.com" });
    const memberInvite = await invite(app, owner, member.email);
    await app.request(`/api/v1/invites/${memberInvite.body.token}/accept`, {
      method: "POST",
      headers: { Cookie: `oa_session=${member.sessionCookie}` },
    });

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${member.sessionCookie}` },
      body: JSON.stringify({ email: "someone@example.com" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /invites/:token (public preview)", () => {
  it("returns a masked-email preview without accountExists", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const { body } = await invite(app, owner, "preview@example.com");

    const res = await app.request(`/api/v1/invites/${body.token}`);
    expect(res.status).toBe(200);
    const preview = (await res.json()) as Record<string, unknown>;
    expect(preview.emailMasked).not.toBe("preview@example.com");
    expect(preview.emailMasked).toContain("@example.com");
    expect(preview.accountExists).toBeUndefined();
    expect(preview.email).toBeUndefined();
    expect(preview.status).toBe("pending");
    expect(preview.expired).toBe(false);
  });

  it("404s for an unknown token", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/v1/invites/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("returns 200 with status=revoked for a revoked invite instead of 404", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const { body } = await invite(app, owner, "revoke-preview@example.com");

    await app.request(`/api/v1/orgs/${owner.orgId}/invites/${body.id}`, {
      method: "DELETE",
      headers: { Cookie: `oa_session=${owner.sessionCookie}` },
    });

    const res = await app.request(`/api/v1/invites/${body.token}`);
    expect(res.status).toBe(200);
    const preview = (await res.json()) as { status: string };
    expect(preview.status).toBe("revoked");
  });
});

describe("POST /invites/:token/accept and /decline", () => {
  it("lets an already-registered user with a matching email accept", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app, { email: "invitee@example.com" });
    const { body } = await invite(app, owner, invitee.email, "admin");

    const res = await app.request(`/api/v1/invites/${body.token}/accept`, {
      method: "POST",
      headers: { Cookie: `oa_session=${invitee.sessionCookie}` },
    });
    expect(res.status).toBe(200);
    const result = (await res.json()) as { orgId: string; role: string; alreadyMember: boolean };
    expect(result.orgId).toBe(owner.orgId);
    expect(result.role).toBe("admin");
    expect(result.alreadyMember).toBe(false);

    const membersRes = await app.request(`/api/v1/orgs/${owner.orgId}/members`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    const membersBody = (await membersRes.json()) as { members: { userId: string; role: string }[] };
    expect(membersBody.members.find((m) => m.userId === invitee.userId)?.role).toBe("admin");
  });

  it("is idempotent when accepted twice (e.g. two racing tabs)", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app, { email: "double@example.com" });
    const { body } = await invite(app, owner, invitee.email);

    const first = await app.request(`/api/v1/invites/${body.token}/accept`, {
      method: "POST",
      headers: { Cookie: `oa_session=${invitee.sessionCookie}` },
    });
    expect(first.status).toBe(200);

    const second = await app.request(`/api/v1/invites/${body.token}/accept`, {
      method: "POST",
      headers: { Cookie: `oa_session=${invitee.sessionCookie}` },
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { alreadyMember: boolean };
    expect(secondBody.alreadyMember).toBe(true);
  });

  it("403s when a logged-in user tries to accept an invite addressed to someone else", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const outsider = await registerAndLogin(app, { email: "outsider@example.com" });
    const { body } = await invite(app, owner, "addressed-to@example.com");

    const res = await app.request(`/api/v1/invites/${body.token}/accept`, {
      method: "POST",
      headers: { Cookie: `oa_session=${outsider.sessionCookie}` },
    });
    expect(res.status).toBe(403);
  });

  it("lets the invitee decline, after which the invite is no longer pending", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app, { email: "declining@example.com" });
    const { body } = await invite(app, owner, invitee.email);

    const res = await app.request(`/api/v1/invites/${body.token}/decline`, {
      method: "POST",
      headers: { Cookie: `oa_session=${invitee.sessionCookie}` },
    });
    expect(res.status).toBe(200);

    const preview = await app.request(`/api/v1/invites/${body.token}`);
    const previewBody = (await preview.json()) as { status: string };
    expect(previewBody.status).toBe("declined");

    // Declining doesn't create a membership.
    const membersRes = await app.request(`/api/v1/orgs/${owner.orgId}/members`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    const membersBody = (await membersRes.json()) as { members: { userId: string }[] };
    expect(membersBody.members.find((m) => m.userId === invitee.userId)).toBeUndefined();
  });

  it("410s when accepting an invite past its expiry, and the invite stays pending for reissue", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app, { email: "expired@example.com" });
    const { body } = await invite(app, owner, invitee.email);

    const db = getTestDb();
    await db.update(invites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invites.token, body.token));

    const res = await app.request(`/api/v1/invites/${body.token}/accept`, {
      method: "POST",
      headers: { Cookie: `oa_session=${invitee.sessionCookie}` },
    });
    expect(res.status).toBe(410);

    const row = await db.query.invites.findFirst({ where: eq(invites.token, body.token) });
    expect(row?.status).toBe("pending");

    // The owner can reissue it in place through the same POST call.
    const reissued = await invite(app, owner, invitee.email);
    expect(reissued.body.reissued).toBe(true);
  });
});

describe("GET/DELETE /orgs/:id/invites", () => {
  it("lists pending invites with inviter info, and superadmin can revoke in any org", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const superadmin = await registerAndLogin(app);
    const db = getTestDb();
    const { users } = await import("../../db/schema.js");
    await db.update(users).set({ isSuperadmin: true }).where(eq(users.id, superadmin.userId));

    const { body } = await invite(app, owner, "listed@example.com");

    const listRes = await app.request(`/api/v1/orgs/${owner.orgId}/invites`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { invites: { id: string; inviterEmail: string | null }[] };
    expect(listBody.invites.some((i) => i.id === body.id)).toBe(true);
    expect(listBody.invites.find((i) => i.id === body.id)?.inviterEmail).toBe(owner.email);

    const revokeRes = await app.request(`/api/v1/orgs/${owner.orgId}/invites/${body.id}`, {
      method: "DELETE",
      headers: { Cookie: `oa_session=${superadmin.sessionCookie}` },
    });
    expect(revokeRes.status).toBe(200);

    // Revoking twice is idempotent.
    const revokeAgain = await app.request(`/api/v1/orgs/${owner.orgId}/invites/${body.id}`, {
      method: "DELETE",
      headers: { Cookie: `oa_session=${owner.sessionCookie}` },
    });
    expect(revokeAgain.status).toBe(200);
  });

  it("409s revoking an already-accepted invite", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app, { email: "accepted-then-revoke@example.com" });
    const { body } = await invite(app, owner, invitee.email);
    await app.request(`/api/v1/invites/${body.token}/accept`, {
      method: "POST",
      headers: { Cookie: `oa_session=${invitee.sessionCookie}` },
    });

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/invites/${body.id}`, {
      method: "DELETE",
      headers: { Cookie: `oa_session=${owner.sessionCookie}` },
    });
    expect(res.status).toBe(409);
  });
});

describe("GET /invites/me", () => {
  it("lists an authenticated user's own pending invites across orgs", async () => {
    const app = buildTestApp();
    const ownerA = await registerAndLogin(app);
    const ownerB = await registerAndLogin(app);
    const invitee = await registerAndLogin(app, { email: "multi-invited@example.com" });

    await invite(app, ownerA, invitee.email);
    await invite(app, ownerB, invitee.email);

    const res = await app.request("/api/v1/invites/me", { headers: { Cookie: `oa_session=${invitee.sessionCookie}` } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { invites: { orgId: string }[] };
    expect(body.invites.map((i) => i.orgId).sort()).toEqual([ownerA.orgId, ownerB.orgId].sort());
  });

  it("does not surface another user's invites", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const stranger = await registerAndLogin(app);
    await invite(app, owner, "not-for-stranger@example.com");

    const res = await app.request("/api/v1/invites/me", { headers: { Cookie: `oa_session=${stranger.sessionCookie}` } });
    const body = (await res.json()) as { invites: unknown[] };
    expect(body.invites).toHaveLength(0);
  });
});
