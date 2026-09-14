import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { auditLog, shares, users } from "../../db/schema.js";
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

function patchShareViaApi(app: ReturnType<typeof buildTestApp>, shareId: string, sessionCookie: string, payload: Record<string, unknown>) {
  return app.request(`/api/v1/shares/${shareId}`, {
    method: "PATCH",
    headers: authedHeaders(sessionCookie),
    body: JSON.stringify(payload),
  });
}

async function issueUserKey(app: ReturnType<typeof buildTestApp>, sessionCookie: string, scopes: string[]) {
  const res = await app.request("/api/v1/me/keys", {
    method: "POST",
    headers: authedHeaders(sessionCookie),
    body: JSON.stringify({ name: "test key", scopes }),
  });
  if (res.status !== 201) throw new Error(`issue key failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { id: string; token: string; scopes: string[] };
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

  it("counts a manager's own view separately, without inflating the audience-facing viewCount", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const artifactId = await createArtifact(app, orgId, sessionCookie, "<h1>owner's own link</h1>");

    const shareRes = await createShareViaApi(app, artifactId, sessionCookie, { mode: "public" });
    const share = (await shareRes.json()) as { token: string };

    // The owner opens their own link — this must not count as audience, but must not be dropped either.
    const embedRes = await app.request(`/embed/${share.token}`, { headers: authedHeaders(sessionCookie) });
    expect(embedRes.status).toBe(200);

    const sharesListRes = await app.request(`/api/v1/artifacts/${artifactId}/shares`, { headers: authedHeaders(sessionCookie) });
    const { shares } = (await sharesListRes.json()) as { shares: { viewCount: number; managerViewCount: number }[] };
    expect(shares[0]!.viewCount).toBe(0);
    expect(shares[0]!.managerViewCount).toBe(1);
  });

  it("carries an optional label through create and list, defaulting to null", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const artifactId = await createArtifact(app, orgId, sessionCookie);

    const labeledRes = await createShareViaApi(app, artifactId, sessionCookie, { mode: "public", label: "для инвесторов" });
    expect(labeledRes.status).toBe(201);
    expect(((await labeledRes.json()) as { label: string | null }).label).toBe("для инвесторов");

    const unlabeledRes = await createShareViaApi(app, artifactId, sessionCookie, { mode: "team" });
    expect(((await unlabeledRes.json()) as { label: string | null }).label).toBeNull();

    const sharesListRes = await app.request(`/api/v1/artifacts/${artifactId}/shares`, { headers: authedHeaders(sessionCookie) });
    const { shares } = (await sharesListRes.json()) as { shares: { label: string | null; mode: string }[] };
    expect(shares.find((s) => s.mode === "public")!.label).toBe("для инвесторов");
    expect(shares.find((s) => s.mode === "team")!.label).toBeNull();
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

  describe("PATCH /shares/:id — change link mode in place", () => {
    it("changes team -> public, keeping the same token", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie, "<h1>content</h1>");
      const share = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "team" })).json()) as { id: string; token: string };

      const res = await patchShareViaApi(app, share.id, sessionCookie, { mode: "public" });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { id: string; token: string; mode: string };
      expect(body.token).toBe(share.token);
      expect(body.mode).toBe("public");

      const embedRes = await app.request(`/embed/${share.token}`);
      expect(embedRes.status).toBe(200);
      expect(await embedRes.text()).toContain("content");
    });

    it("changes team -> password (with a password) and blocks anonymous access until unlocked", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie, "<h1>secret</h1>");
      const share = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "team" })).json()) as { id: string; token: string };

      const res = await patchShareViaApi(app, share.id, sessionCookie, { mode: "password", password: "hunter2" });
      expect(res.status).toBe(200);

      // Anonymous — password required.
      expect((await app.request(`/embed/${share.token}`)).status).toBe(403);
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
    });

    it("changes password -> team, clearing the stored password hash so the old password no longer works if switched back", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie);
      const share = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "password", password: "hunter2" })).json()) as {
        id: string;
        token: string;
      };

      const toTeam = await patchShareViaApi(app, share.id, sessionCookie, { mode: "team" });
      expect(toTeam.status).toBe(200);

      const row = await getTestDb().query.shares.findFirst({ where: eq(shares.id, share.id) });
      expect(row!.passwordHash).toBeNull();

      // Switching back to "password" with no new password is refused — there is nothing left to keep.
      const backToPassword = await patchShareViaApi(app, share.id, sessionCookie, { mode: "password" });
      expect(backToPassword.status).toBe(400);
    });

    it("hands the caller a fresh unlock cookie when they set a new password, so they aren't immediately locked out of the link they're looking at", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie, "<h1>owner-visible</h1>");
      const share = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "team" })).json()) as { id: string; token: string };

      const res = await patchShareViaApi(app, share.id, sessionCookie, { mode: "password", password: "hunter2" });
      const unlockCookie = extractCookie(res, `oa_unlock_${share.token}`);
      expect(unlockCookie).toBeTruthy();

      // The owner's own session, carrying only the fresh unlock cookie (not oa_session), can read
      // the shell immediately — no re-entering the password they just set.
      const shellRes = await app.request(`/s/${share.token}`, {
        headers: { Accept: "text/html", Cookie: `oa_unlock_${share.token}=${unlockCookie}` },
      });
      expect(shellRes.status).toBe(200);
      expect(await shellRes.text()).not.toContain("Password required");
    });

    it("invalidates a standing unlock session when the password is rotated, even though the token is unchanged", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie);
      const share = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "password", password: "old-pw-1" })).json()) as {
        id: string;
        token: string;
      };
      const unlockRes = await app.request(`/s/${share.token}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "old-pw-1" }),
      });
      const oldUnlockCookie = extractCookie(unlockRes, `oa_unlock_${share.token}`);

      await patchShareViaApi(app, share.id, sessionCookie, { mode: "password", password: "new-pw-2" });

      const staleRes = await app.request(`/embed/${share.token}`, { headers: { Cookie: `oa_unlock_${share.token}=${oldUnlockCookie}` } });
      expect(staleRes.status).toBe(403);
    });

    it("403s a team member without write access to the artifact", async () => {
      const app = buildTestApp();
      const owner = await registerAndLogin(app);
      const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie);
      const share = (await (await createShareViaApi(app, artifactId, owner.sessionCookie, { mode: "team" })).json()) as { id: string };
      const member = await inviteAndRegister(app, owner, `member-${Math.random().toString(36).slice(2)}@example.com`, "member");

      const res = await patchShareViaApi(app, share.id, member.sessionCookie, { mode: "public" });
      expect(res.status).toBe(403);
    });

    it("200s for a team admin who isn't the artifact's owner, and for a superadmin", async () => {
      const app = buildTestApp();
      const owner = await registerAndLogin(app);
      const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie);
      const share = (await (await createShareViaApi(app, artifactId, owner.sessionCookie, { mode: "team" })).json()) as { id: string };

      const adminEmail = `admin-${Math.random().toString(36).slice(2)}@example.com`;
      const inviteRes = await app.request(`/api/v1/orgs/${owner.orgId}/invites`, {
        method: "POST",
        headers: authedHeaders(owner.sessionCookie),
        body: JSON.stringify({ email: adminEmail, role: "admin" }),
      });
      const invite = (await inviteRes.json()) as { token: string };
      const registerRes = await app.request(`/api/v1/auth/register?invite=${invite.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: "correct horse battery staple", name: "Team Admin" }),
      });
      const adminCookie = extractCookie(registerRes, "oa_session")!;

      expect((await patchShareViaApi(app, share.id, adminCookie, { mode: "public" })).status).toBe(200);

      const superadmin = await registerAndLogin(app);
      await makeSuperadmin(superadmin.userId);
      expect((await patchShareViaApi(app, share.id, superadmin.sessionCookie, { mode: "team" })).status).toBe(200);
    });

    it("403s with public_shares_forbidden and the allowed modes when the team disallows public links", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie);
      const share = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "team" })).json()) as { id: string };
      await app.request(`/api/v1/orgs/${orgId}`, {
        method: "PATCH",
        headers: authedHeaders(sessionCookie),
        body: JSON.stringify({ allowPublicShares: false }),
      });

      const res = await patchShareViaApi(app, share.id, sessionCookie, { mode: "public" });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string; allowedModes: string[] } };
      expect(body.error.code).toBe("public_shares_forbidden");
      expect(body.error.allowedModes).toEqual(["team", "password"]);
    });

    it("400s a switch to password with no password given, on a share that was never password-protected", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie);
      const share = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "team" })).json()) as { id: string };

      const res = await patchShareViaApi(app, share.id, sessionCookie, { mode: "password" });
      expect(res.status).toBe(400);
    });

    it("410s a change attempt on a revoked share", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie);
      const share = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "team" })).json()) as { id: string };
      await app.request(`/api/v1/shares/${share.id}`, { method: "DELETE", headers: authedHeaders(sessionCookie) });

      const res = await patchShareViaApi(app, share.id, sessionCookie, { mode: "public" });
      expect(res.status).toBe(410);
    });

    it("410s a change attempt on an expired share", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie);
      const share = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "team" })).json()) as { id: string };
      await getTestDb().update(shares).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(shares.id, share.id));

      const res = await patchShareViaApi(app, share.id, sessionCookie, { mode: "public" });
      expect(res.status).toBe(410);
    });

    it("records an audit entry with the mode transition, and never with the plaintext password", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie);
      const share = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "team" })).json()) as { id: string };

      await patchShareViaApi(app, share.id, sessionCookie, { mode: "password", password: "hunter2" });

      const entry = await getTestDb().query.auditLog.findFirst({ where: eq(auditLog.action, "share.update_mode") });
      expect(entry).toBeTruthy();
      expect(entry!.targetId).toBe(share.id);
      expect(entry!.meta).toMatchObject({ from: "team", to: "password" });
      expect(JSON.stringify(entry!.meta)).not.toContain("hunter2");
    });

    it("403s a user_key caller missing the shares:write scope, and never sets an unlock cookie for one that has it", async () => {
      const app = buildTestApp();
      const { orgId, sessionCookie } = await registerAndLogin(app);
      const artifactId = await createArtifact(app, orgId, sessionCookie);
      const share = (await (await createShareViaApi(app, artifactId, sessionCookie, { mode: "team" })).json()) as { id: string; token: string };

      const restrictedKey = await issueUserKey(app, sessionCookie, ["artifacts:read", "artifacts:write"]);
      const forbiddenRes = await app.request(`/api/v1/shares/${share.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${restrictedKey.token}` },
        body: JSON.stringify({ mode: "public" }),
      });
      expect(forbiddenRes.status).toBe(403);

      const fullKey = await issueUserKey(app, sessionCookie, ["artifacts:read", "artifacts:write", "shares:write"]);
      const okRes = await app.request(`/api/v1/shares/${share.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${fullKey.token}` },
        body: JSON.stringify({ mode: "password", password: "hunter2" }),
      });
      expect(okRes.status).toBe(200);
      // An API-key caller has no browser session for a cookie to help — none should be set.
      expect(okRes.headers.get("set-cookie")).toBeNull();
    });
  });
});
