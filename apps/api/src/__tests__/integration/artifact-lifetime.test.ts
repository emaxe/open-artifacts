import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { artifacts, users } from "../../db/schema.js";
import { buildTestApp, extractCookie, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

async function makeSuperadmin(userId: string) {
  await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, userId));
}

async function setGlobalMaxLifetime(sessionCookie: string, app: ReturnType<typeof buildTestApp>, minutes: number) {
  const res = await app.request("/api/v1/admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
    body: JSON.stringify({ maxArtifactLifetimeMinutes: minutes }),
  });
  return res;
}

async function createArtifact(
  app: ReturnType<typeof buildTestApp>,
  sessionCookie: string,
  orgId: string,
  body: Record<string, unknown> = {},
) {
  return app.request(`/api/v1/artifacts?orgId=${orgId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
    body: JSON.stringify({ title: "t", kind: "html", content: "<h1>hi</h1>", ...body }),
  });
}

async function inviteAndRegister(app: ReturnType<typeof buildTestApp>, owner: { orgId: string; sessionCookie: string }, email: string, role = "member") {
  const inviteRes = await app.request(`/api/v1/orgs/${owner.orgId}/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
    body: JSON.stringify({ email, role }),
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

describe("artifact lifetime — no policy set (default, backward compatible)", () => {
  it("creates an unlimited artifact when no lifetime is requested and no max is configured", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const res = await createArtifact(app, owner.sessionCookie, owner.orgId);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { artifact: { expiresAt: string | null } };
    expect(body.artifact.expiresAt).toBeNull();
  });
});

describe("artifact lifetime — global instance maximum", () => {
  it("defaults new artifacts to the global maximum when no lifetime is requested", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    await makeSuperadmin(owner.userId);
    await setGlobalMaxLifetime(owner.sessionCookie, app, 60);

    const before = Date.now();
    const res = await createArtifact(app, owner.sessionCookie, owner.orgId);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { artifact: { expiresAt: string } };
    const deltaMs = new Date(body.artifact.expiresAt).getTime() - before;
    expect(deltaMs).toBeGreaterThan(59 * 60_000);
    expect(deltaMs).toBeLessThan(61 * 60_000);
  });

  it("accepts a lifetime shorter than the maximum", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    await makeSuperadmin(owner.userId);
    await setGlobalMaxLifetime(owner.sessionCookie, app, 60);

    const res = await createArtifact(app, owner.sessionCookie, owner.orgId, { lifetime: 30 });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { artifact: { expiresAt: string; createdAt: string } };
    const deltaMs = new Date(body.artifact.expiresAt).getTime() - new Date(body.artifact.createdAt).getTime();
    expect(deltaMs).toBe(30 * 60_000);
  });

  it("rejects a lifetime longer than the maximum with 400 lifetime_exceeds_max", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    await makeSuperadmin(owner.userId);
    await setGlobalMaxLifetime(owner.sessionCookie, app, 60);

    const res = await createArtifact(app, owner.sessionCookie, owner.orgId, { lifetime: 120 });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; maxLifetimeMinutes: number } };
    expect(body.error.code).toBe("lifetime_exceeds_max");
    expect(body.error.maxLifetimeMinutes).toBe(60);
  });

  it("rejects an explicit 'never expires' request when a finite maximum applies", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    await makeSuperadmin(owner.userId);
    await setGlobalMaxLifetime(owner.sessionCookie, app, 60);

    const res = await createArtifact(app, owner.sessionCookie, owner.orgId, { lifetime: 0 });
    expect(res.status).toBe(400);
  });
});

describe("artifact lifetime — per-team maximum", () => {
  it("lets an owner set a team maximum stricter than the global one, which becomes the team default", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    await makeSuperadmin(owner.userId);
    await setGlobalMaxLifetime(owner.sessionCookie, app, 60);

    const patchRes = await app.request(`/api/v1/orgs/${owner.orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ maxArtifactLifetimeMinutes: 30 }),
    });
    expect(patchRes.status).toBe(200);

    const res = await createArtifact(app, owner.sessionCookie, owner.orgId);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { artifact: { expiresAt: string; createdAt: string } };
    const deltaMs = new Date(body.artifact.expiresAt).getTime() - new Date(body.artifact.createdAt).getTime();
    expect(deltaMs).toBe(30 * 60_000);
  });

  it("refuses a team maximum looser than the global one with 400 lifetime_exceeds_max", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    await makeSuperadmin(owner.userId);
    await setGlobalMaxLifetime(owner.sessionCookie, app, 60);

    const res = await app.request(`/api/v1/orgs/${owner.orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ maxArtifactLifetimeMinutes: 120 }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; maxLifetimeMinutes: number } };
    expect(body.error.code).toBe("lifetime_exceeds_max");
    expect(body.error.maxLifetimeMinutes).toBe(60);
  });

  it("rejects a plain member trying to set the team maximum (403), leaving storageQuotaBytes superadmin-only unchanged", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const member = await inviteAndRegister(app, owner, "member@example.com");

    const res = await app.request(`/api/v1/orgs/${owner.orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${member.sessionCookie}` },
      body: JSON.stringify({ maxArtifactLifetimeMinutes: 30 }),
    });
    expect(res.status).toBe(403);

    const quotaRes = await app.request(`/api/v1/orgs/${owner.orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ storageQuotaBytes: 123456 }),
    });
    expect(quotaRes.status).toBe(403);
  });

  it("reverts to inheriting the global maximum when set back to null", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    await makeSuperadmin(owner.userId);
    await setGlobalMaxLifetime(owner.sessionCookie, app, 60);

    await app.request(`/api/v1/orgs/${owner.orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ maxArtifactLifetimeMinutes: 30 }),
    });
    const res = await app.request(`/api/v1/orgs/${owner.orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ maxArtifactLifetimeMinutes: null }),
    });
    expect(res.status).toBe(200);

    const detailRes = await app.request(`/api/v1/orgs/${owner.orgId}`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    const detail = (await detailRes.json()) as { maxArtifactLifetimeMinutes: number | null; effectiveMaxArtifactLifetimeMinutes: number | null };
    expect(detail.maxArtifactLifetimeMinutes).toBeNull();
    expect(detail.effectiveMaxArtifactLifetimeMinutes).toBe(60);
  });
});

describe("artifact lifetime — changing an existing artifact's lifetime", () => {
  it("extends and shortens within the effective limit, and rejects exceeding it", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    await makeSuperadmin(owner.userId);
    await setGlobalMaxLifetime(owner.sessionCookie, app, 1440);

    const createRes = await createArtifact(app, owner.sessionCookie, owner.orgId, { lifetime: 30 });
    const created = (await createRes.json()) as { artifact: { id: string; createdAt: string } };

    const extendRes = await app.request(`/api/v1/artifacts/${created.artifact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ lifetime: 720 }),
    });
    expect(extendRes.status).toBe(200);
    const extended = (await extendRes.json()) as { artifact: { expiresAt: string } };
    expect(new Date(extended.artifact.expiresAt).getTime() - new Date(created.artifact.createdAt).getTime()).toBe(720 * 60_000);

    const tooLongRes = await app.request(`/api/v1/artifacts/${created.artifact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ lifetime: 5000 }),
    });
    expect(tooLongRes.status).toBe(400);
    const tooLongBody = (await tooLongRes.json()) as { error: { code: string } };
    expect(tooLongBody.error.code).toBe("lifetime_exceeds_max");

    const shortenRes = await app.request(`/api/v1/artifacts/${created.artifact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ lifetime: 5 }),
    });
    expect(shortenRes.status).toBe(200);
    const shortened = (await shortenRes.json()) as { artifact: { expiresAt: string } };
    expect(new Date(shortened.artifact.expiresAt).getTime() - new Date(created.artifact.createdAt).getTime()).toBe(5 * 60_000);
  });

  it("leaves the lifetime untouched when a content-only update is made", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    await makeSuperadmin(owner.userId);
    await setGlobalMaxLifetime(owner.sessionCookie, app, 1440);

    const createRes = await createArtifact(app, owner.sessionCookie, owner.orgId, { lifetime: 30 });
    const created = (await createRes.json()) as { artifact: { id: string; expiresAt: string } };

    const patchRes = await app.request(`/api/v1/artifacts/${created.artifact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ content: "<h1>updated</h1>" }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { artifact: { expiresAt: string } };
    expect(patched.artifact.expiresAt).toBe(created.artifact.expiresAt);
  });
});

describe("artifact lifetime — recompute when the policy is lowered", () => {
  it("shortens an existing artifact from its creation date, without touching org overrides for other teams", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    await makeSuperadmin(owner.userId);
    await setGlobalMaxLifetime(owner.sessionCookie, app, 43200); // 30 days

    const createRes = await createArtifact(app, owner.sessionCookie, owner.orgId);
    const created = (await createRes.json()) as { artifact: { id: string } };

    // Backdate creation to 10 days ago, as if it had been sitting there under the old policy.
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await getTestDb().update(artifacts).set({ createdAt: tenDaysAgo }).where(eq(artifacts.id, created.artifact.id));

    // Lower the global max to 1 day — this artifact is already 10 days old, so it must expire immediately.
    const lowerRes = await setGlobalMaxLifetime(owner.sessionCookie, app, 1440);
    expect(lowerRes.status).toBe(200);
    const lowerBody = (await lowerRes.json()) as { shortenedArtifacts: number };
    expect(lowerBody.shortenedArtifacts).toBeGreaterThanOrEqual(1);

    const getRes = await app.request(`/api/v1/artifacts/${created.artifact.id}`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    expect(getRes.status).toBe(404);

    const listRes = await app.request(`/api/v1/artifacts?orgId=${owner.orgId}`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    const listBody = (await listRes.json()) as { artifacts: { id: string }[] };
    expect(listBody.artifacts.find((a) => a.id === created.artifact.id)).toBeUndefined();
  });

  it("never extends an artifact's lifetime when the maximum is raised", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    await makeSuperadmin(owner.userId);
    await setGlobalMaxLifetime(owner.sessionCookie, app, 60);

    const createRes = await createArtifact(app, owner.sessionCookie, owner.orgId);
    const created = (await createRes.json()) as { artifact: { id: string; expiresAt: string } };

    await setGlobalMaxLifetime(owner.sessionCookie, app, 43200);

    const getRes = await app.request(`/api/v1/artifacts/${created.artifact.id}`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { artifact: { expiresAt: string } };
    expect(getBody.artifact.expiresAt).toBe(created.artifact.expiresAt);
  });
});

describe("artifact lifetime — lazy expiry across read surfaces", () => {
  async function createAndExpire(app: ReturnType<typeof buildTestApp>, owner: { sessionCookie: string; orgId: string }) {
    const createRes = await createArtifact(app, owner.sessionCookie, owner.orgId);
    const created = (await createRes.json()) as { artifact: { id: string } };
    await getTestDb()
      .update(artifacts)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(artifacts.id, created.artifact.id));
    return created.artifact.id;
  }

  it("hides an expired artifact from GET, list, preview, PATCH and DELETE (404, same as soft-delete)", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const id = await createAndExpire(app, owner);
    const headers = { Cookie: `oa_session=${owner.sessionCookie}` };

    expect((await app.request(`/api/v1/artifacts/${id}`, { headers })).status).toBe(404);
    expect((await app.request(`/api/v1/artifacts/${id}/preview`, { headers })).status).toBe(404);
    expect(
      (
        await app.request(`/api/v1/artifacts/${id}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ title: "renamed" }),
        })
      ).status,
    ).toBe(404);
    expect((await app.request(`/api/v1/artifacts/${id}`, { method: "DELETE", headers })).status).toBe(404);

    const listRes = await app.request(`/api/v1/artifacts?orgId=${owner.orgId}`, { headers });
    const listBody = (await listRes.json()) as { artifacts: { id: string }[] };
    expect(listBody.artifacts.find((a) => a.id === id)).toBeUndefined();
  });

  it("returns 410 for a public share and the embed of an expired-but-unswept artifact", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const headers = { Cookie: `oa_session=${owner.sessionCookie}` };

    const createRes = await createArtifact(app, owner.sessionCookie, owner.orgId);
    const created = (await createRes.json()) as { artifact: { id: string } };
    const shareRes = await app.request(`/api/v1/artifacts/${created.artifact.id}/shares`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "public" }),
    });
    const share = (await shareRes.json()) as { token: string };

    await getTestDb()
      .update(artifacts)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(artifacts.id, created.artifact.id));

    expect((await app.request(`/s/${share.token}`)).status).toBe(410);
    expect((await app.request(`/embed/${share.token}`)).status).toBe(410);
    expect((await app.request(`/s/${"bogus-token"}`)).status).toBe(404);
  });

  it("no longer counts an expired-but-unswept artifact toward the org's storage quota", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const headers = { Cookie: `oa_session=${owner.sessionCookie}` };

    await app.request(`/api/v1/orgs/${owner.orgId}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ storageQuotaBytes: 20 }),
    });
    await makeSuperadmin(owner.userId);

    const first = await createArtifact(app, owner.sessionCookie, owner.orgId, { content: "0123456789" });
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as { artifact: { id: string } };

    // Without expiring it, quota would now be exhausted (10 of 20 bytes used, another 10-byte
    // artifact still fits, but a second one that size would not leave room for a third).
    await getTestDb()
      .update(artifacts)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(artifacts.id, firstBody.artifact.id));

    const second = await createArtifact(app, owner.sessionCookie, owner.orgId, { content: "01234567890123456789" });
    expect(second.status).toBe(201);
  });
});
