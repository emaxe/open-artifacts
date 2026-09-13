import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { shares, users } from "../../db/schema.js";
import { buildTestApp, extractCookie, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

function authedHeaders(sessionCookie: string) {
  return { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` };
}

async function createArtifact(app: ReturnType<typeof buildTestApp>, orgId: string, sessionCookie: string, content = "<h1>hi</h1>") {
  const res = await app.request(`/api/v1/artifacts?orgId=${orgId}`, {
    method: "POST",
    headers: authedHeaders(sessionCookie),
    body: JSON.stringify({ title: "Shared doc", kind: "html", content, visibility: "private" }),
  });
  const body = (await res.json()) as { artifact: { id: string } };
  return body.artifact.id;
}

async function createShareViaApi(app: ReturnType<typeof buildTestApp>, artifactId: string, sessionCookie: string, payload: Record<string, unknown> = {}) {
  return app.request(`/api/v1/artifacts/${artifactId}/shares`, {
    method: "POST",
    headers: authedHeaders(sessionCookie),
    body: JSON.stringify(payload),
  });
}

/** Invites `email` into `owner`'s org with the given role and registers/logs them in. */
async function inviteAndRegister(app: ReturnType<typeof buildTestApp>, owner: { orgId: string; sessionCookie: string }, email: string, role: "member" | "viewer" = "member") {
  const inviteRes = await app.request(`/api/v1/orgs/${owner.orgId}/invites`, {
    method: "POST",
    headers: authedHeaders(owner.sessionCookie),
    body: JSON.stringify({ email, role }),
  });
  const invite = (await inviteRes.json()) as { token: string };
  const res = await app.request(`/api/v1/auth/register?invite=${invite.token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery staple", name: "Teammate" }),
  });
  const body = (await res.json()) as { userId: string };
  const sessionCookie = extractCookie(res, "oa_session")!;
  return { userId: body.userId, sessionCookie };
}

async function makeSuperadmin(userId: string) {
  await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, userId));
}

describe("sharing", () => {
  it("serves a public share's content unauthenticated and counts a view", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const artifactId = await createArtifact(app, orgId, sessionCookie, "<h1>public content</h1>");

    const shareRes = await createShareViaApi(app, artifactId, sessionCookie, { mode: "public" });
    expect(shareRes.status).toBe(201);
    const share = (await shareRes.json()) as { token: string };

    // No auth header at all — this is the public route.
    const embedRes = await app.request(`/embed/${share.token}`);
    expect(embedRes.status).toBe(200);
    const html = await embedRes.text();
    expect(html).toContain("public content");
    expect(embedRes.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(embedRes.headers.get("content-security-policy")).toContain("connect-src 'none'");

    const sharesListRes = await app.request(`/api/v1/artifacts/${artifactId}/shares`, { headers: authedHeaders(sessionCookie) });
    const { shares } = (await sharesListRes.json()) as { shares: { viewCount: number }[] };
    expect(shares[0]!.viewCount).toBe(1);
  });

  it("blocks a password-protected share until the correct password is submitted", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const artifactId = await createArtifact(app, orgId, sessionCookie, "<h1>secret content</h1>");

    const shareRes = await createShareViaApi(app, artifactId, sessionCookie, { mode: "password", password: "hunter2" });
    const share = (await shareRes.json()) as { token: string };

    const blockedRes = await app.request(`/embed/${share.token}`);
    expect(blockedRes.status).toBe(403);

    const wrongUnlock = await app.request(`/s/${share.token}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    expect(wrongUnlock.status).toBe(401);

    const rightUnlock = await app.request(`/s/${share.token}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "hunter2" }),
    });
    expect(rightUnlock.status).toBe(200);
    const unlockCookie = rightUnlock.headers.get("set-cookie")!.split(";")[0]!;

    const unlockedRes = await app.request(`/embed/${share.token}`, { headers: { Cookie: unlockCookie } });
    expect(unlockedRes.status).toBe(200);
    expect(await unlockedRes.text()).toContain("secret content");
  });

  it("denies access after a share is revoked", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const artifactId = await createArtifact(app, orgId, sessionCookie);

    const shareRes = await createShareViaApi(app, artifactId, sessionCookie, { mode: "public" });
    const share = (await shareRes.json()) as { id: string; token: string };

    const revokeRes = await app.request(`/api/v1/shares/${share.id}`, { method: "DELETE", headers: authedHeaders(sessionCookie) });
    expect(revokeRes.status).toBe(200);

    const embedRes = await app.request(`/embed/${share.token}`);
    expect(embedRes.status).toBe(410);
  });

  describe("mode 'team'", () => {
    it("is the default when mode is omitted", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie);

      const shareRes = await createShareViaApi(app, artifactId, sessionCookie, {});
      expect(shareRes.status).toBe(201);
      const share = (await shareRes.json()) as { mode: string };
      expect(share.mode).toBe("team");
    });

    it("redirects an anonymous viewer to login", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie);
      const share = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "team" })).json()) as { token: string };

      const htmlRes = await app.request(`/s/${share.token}`, { headers: { Accept: "text/html" } });
      expect(htmlRes.status).toBe(302);
      expect(htmlRes.headers.get("location")).toBe(`/login?next=${encodeURIComponent(`/s/${share.token}`)}`);

      const jsonRes = await app.request(`/s/${share.token}`);
      expect(jsonRes.status).toBe(401);
      const body = (await jsonRes.json()) as { error: { code: string } };
      expect(body.error.code).toBe("login_required");

      const embedRes = await app.request(`/embed/${share.token}`);
      expect(embedRes.status).toBe(403);
    });

    it("denies a logged-in user who is not a member of the artifact's team", async () => {
      const app = buildTestApp();
      const owner = await registerAndLogin(app);
      const outsider = await registerAndLogin(app);
      const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie);
      const share = (await (await createShareViaApi(app, artifactId, owner.sessionCookie, { mode: "team" })).json()) as { token: string };

      const res = await app.request(`/s/${share.token}`, { headers: authedHeaders(outsider.sessionCookie) });
      expect(res.status).toBe(403);

      const embedRes = await app.request(`/embed/${share.token}`, { headers: authedHeaders(outsider.sessionCookie) });
      expect(embedRes.status).toBe(403);
    });

    it("allows a member or viewer teammate to open a team link to another member's private artifact", async () => {
      const app = buildTestApp();
      const owner = await registerAndLogin(app);
      const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, "<h1>team content</h1>");
      const share = (await (await createShareViaApi(app, artifactId, owner.sessionCookie, { mode: "team" })).json()) as { token: string };

      for (const role of ["member", "viewer"] as const) {
        const teammate = await inviteAndRegister(app, owner, `${role}-${Math.random().toString(36).slice(2)}@example.com`, role);

        const shellRes = await app.request(`/s/${share.token}`, { headers: authedHeaders(teammate.sessionCookie) });
        expect(shellRes.status).toBe(200);

        const embedRes = await app.request(`/embed/${share.token}`, { headers: authedHeaders(teammate.sessionCookie) });
        expect(embedRes.status).toBe(200);
        expect(await embedRes.text()).toContain("team content");
      }

      const sharesListRes = await app.request(`/api/v1/artifacts/${artifactId}/shares`, { headers: authedHeaders(owner.sessionCookie) });
      const { shares } = (await sharesListRes.json()) as { shares: { viewCount: number }[] };
      expect(shares[0]!.viewCount).toBe(2);
    });

    it("400s an unlock attempt on a non-password share", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie);
      const share = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "team" })).json()) as { token: string };

      const res = await app.request(`/s/${share.token}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "whatever" }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("not_password_mode");
    });
  });

  describe("team share policy", () => {
    it("forbids a new public share once the team disables them, while team/default modes still work", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie);

      const patchRes = await app.request(`/api/v1/orgs/${orgId}`, {
        method: "PATCH",
        headers: authedHeaders(sessionCookie),
        body: JSON.stringify({ allowPublicShares: false }),
      });
      expect(patchRes.status).toBe(200);

      const publicRes = await createShareViaApi(app, artifactId, sessionCookie, { mode: "public" });
      expect(publicRes.status).toBe(403);
      const publicBody = (await publicRes.json()) as { error: { code: string; allowedModes: string[] } };
      expect(publicBody.error.code).toBe("public_shares_forbidden");
      expect(publicBody.error.allowedModes).toEqual(["team", "password"]);

      expect((await createShareViaApi(app, artifactId, sessionCookie, { mode: "team" })).status).toBe(201);
      expect((await createShareViaApi(app, artifactId, sessionCookie, {})).status).toBe(201);
    });

    it("an instance-wide prohibition wins even if the team itself still allows public shares", async () => {
      const app = buildTestApp();
      const owner = await registerAndLogin(app);
      await makeSuperadmin(owner.userId);
      const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie);

      const settingsRes = await app.request("/api/v1/admin/settings", {
        method: "PATCH",
        headers: authedHeaders(owner.sessionCookie),
        body: JSON.stringify({ allowPublicShares: false }),
      });
      expect(settingsRes.status).toBe(200);

      // The team's own flag is still (default) true — the instance flag alone must be enough to refuse.
      const res = await createShareViaApi(app, artifactId, owner.sessionCookie, { mode: "public" });
      expect(res.status).toBe(403);
    });

    it("refuses a team trying to re-enable public shares the instance forbade", async () => {
      const app = buildTestApp();
      const owner = await registerAndLogin(app);
      await makeSuperadmin(owner.userId);
      await app.request("/api/v1/admin/settings", {
        method: "PATCH",
        headers: authedHeaders(owner.sessionCookie),
        body: JSON.stringify({ allowPublicShares: false }),
      });

      const reEnableRes = await app.request(`/api/v1/orgs/${owner.orgId}`, {
        method: "PATCH",
        headers: authedHeaders(owner.sessionCookie),
        body: JSON.stringify({ allowPublicShares: true }),
      });
      expect(reEnableRes.status).toBe(400);
      expect(((await reEnableRes.json()) as { error: { code: string } }).error.code).toBe("public_shares_forbidden_by_instance");

      const defaultPublicRes = await app.request(`/api/v1/orgs/${owner.orgId}`, {
        method: "PATCH",
        headers: authedHeaders(owner.sessionCookie),
        body: JSON.stringify({ defaultShareMode: "public" }),
      });
      expect(defaultPublicRes.status).toBe(400);
      expect(((await defaultPublicRes.json()) as { error: { code: string } }).error.code).toBe("default_share_mode_forbidden");
    });

    it("rejects a plain member from changing the share policy, but allows an owner of their personal workspace", async () => {
      const app = buildTestApp();
      const owner = await registerAndLogin(app);
      const member = await inviteAndRegister(app, owner, `member-${Math.random().toString(36).slice(2)}@example.com`, "member");

      const memberRes = await app.request(`/api/v1/orgs/${owner.orgId}`, {
        method: "PATCH",
        headers: authedHeaders(member.sessionCookie),
        body: JSON.stringify({ allowPublicShares: false }),
      });
      expect(memberRes.status).toBe(403);

      const mainOrgRes = await app.request(`/api/v1/orgs/${owner.mainOrgId}`, {
        method: "PATCH",
        headers: authedHeaders(owner.sessionCookie),
        body: JSON.stringify({ allowPublicShares: false }),
      });
      expect(mainOrgRes.status).toBe(200);
    });

    it("bulk-revokes only active public shares, is idempotent, and ignores revoked/expired/other-mode shares", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie);

      const publicA = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "public" })).json()) as { id: string; token: string };
      const publicB = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "public" })).json()) as { id: string; token: string };
      const teamShare = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "team" })).json()) as { token: string };
      // Already-revoked and already-expired public shares must not be counted or touched again.
      const alreadyRevoked = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "public" })).json()) as { id: string };
      await app.request(`/api/v1/shares/${alreadyRevoked.id}`, { method: "DELETE", headers: authedHeaders(sessionCookie) });
      const alreadyExpired = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "public" })).json()) as { id: string };
      await getTestDb().update(shares).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(shares.id, alreadyExpired.id));

      const policyRes = await app.request(`/api/v1/orgs/${orgId}/share-policy`, { headers: authedHeaders(sessionCookie) });
      expect(policyRes.status).toBe(200);
      expect(((await policyRes.json()) as { activePublicShares: number }).activePublicShares).toBe(2);

      const revokeRes = await app.request(`/api/v1/orgs/${orgId}/shares/revoke-public`, { method: "POST", headers: authedHeaders(sessionCookie) });
      expect(revokeRes.status).toBe(200);
      expect((await revokeRes.json()) as { revoked: number }).toEqual({ revoked: 2 });

      expect((await app.request(`/embed/${publicA.token}`)).status).toBe(410);
      expect((await app.request(`/embed/${publicB.token}`)).status).toBe(410);
      // The team share is untouched by a *public*-only bulk revoke.
      expect((await app.request(`/s/${teamShare.token}`, { headers: authedHeaders(sessionCookie) })).status).toBe(200);

      const secondRevokeRes = await app.request(`/api/v1/orgs/${orgId}/shares/revoke-public`, { method: "POST", headers: authedHeaders(sessionCookie) });
      expect((await secondRevokeRes.json()) as { revoked: number }).toEqual({ revoked: 0 });
    });
  });
});
