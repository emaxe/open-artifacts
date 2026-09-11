import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema.js";
import { clearApiKeyVerifyCacheForTests } from "../../services/agents.js";
import { buildTestApp, extractCookie, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

const ALL_SCOPES = ["artifacts:read", "artifacts:write", "artifacts:delete", "shares:write"];

async function issueUserKey(app: ReturnType<typeof buildTestApp>, sessionCookie: string, scopes: string[] = ALL_SCOPES) {
  const res = await app.request("/api/v1/me/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
    body: JSON.stringify({ name: "test key", scopes }),
  });
  if (res.status !== 201) throw new Error(`issue key failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { id: string; token: string; scopes: string[] };
}

/** Registers a user without the extra team org registerAndLogin normally adds — leaves them a
 *  member of exactly one org (their auto-provisioned "main" workspace), for the auto-select case. */
async function registerOnly(app: ReturnType<typeof buildTestApp>) {
  const email = `solo-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await app.request("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery staple", name: "Solo User" }),
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { userId: string; mainOrgId: string };
  return { userId: body.userId, mainOrgId: body.mainOrgId, sessionCookie: extractCookie(res, "oa_session")! };
}

function postArtifact(app: ReturnType<typeof buildTestApp>, token: string, orgId?: string) {
  const qs = orgId ? `?orgId=${orgId}` : "";
  return app.request(`/api/v1/artifacts${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: "t", kind: "html", content: "<p>hi</p>", visibility: "private" }),
  });
}

describe("personal (user-scoped) API keys", () => {
  it("authenticates as user_key and reports every org the holder belongs to", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app); // main org + one team org, owner in both

    const key = await issueUserKey(app, user.sessionCookie);
    const res = await app.request("/api/v1/me/orgs", { headers: { Authorization: `Bearer ${key.token}` } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { authKind: string; userId: string; orgs: { orgId: string; role: string }[] };
    expect(body.authKind).toBe("user_key");
    expect(body.userId).toBe(user.userId);
    expect(body.orgs.map((o) => o.orgId).sort()).toEqual([user.mainOrgId, user.orgId].sort());
    expect(body.orgs.every((o) => o.role === "owner")).toBe(true);
  });

  it("publishes into whichever of the holder's orgs is specified", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);
    const key = await issueUserKey(app, user.sessionCookie);

    const resMain = await postArtifact(app, key.token, user.mainOrgId);
    expect(resMain.status).toBe(201);
    expect(((await resMain.json()) as { artifact: { orgId: string } }).artifact.orgId).toBe(user.mainOrgId);

    const resTeam = await postArtifact(app, key.token, user.orgId);
    expect(resTeam.status).toBe(201);
    expect(((await resTeam.json()) as { artifact: { orgId: string } }).artifact.orgId).toBe(user.orgId);
  });

  it("auto-selects the org when the holder belongs to exactly one", async () => {
    const app = buildTestApp();
    const solo = await registerOnly(app);
    const key = await issueUserKey(app, solo.sessionCookie);

    const res = await postArtifact(app, key.token); // no orgId
    expect(res.status).toBe(201);
    expect(((await res.json()) as { artifact: { orgId: string } }).artifact.orgId).toBe(solo.mainOrgId);
  });

  it("returns org_required with the candidate list when the holder belongs to several orgs and none is specified", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);
    const key = await issueUserKey(app, user.sessionCookie);

    const res = await postArtifact(app, key.token); // no orgId
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; orgs: { orgId: string }[] } };
    expect(body.error.code).toBe("org_required");
    expect(body.error.orgs.map((o) => o.orgId).sort()).toEqual([user.mainOrgId, user.orgId].sort());
  });

  it("denies access to an artifact in an org the holder is not a member of", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const createRes = await postArtifact(app, (await issueUserKey(app, owner.sessionCookie)).token, owner.orgId);
    const artifactId = ((await createRes.json()) as { artifact: { id: string } }).artifact.id;

    const outsider = await registerAndLogin(app);
    const outsiderKey = await issueUserKey(app, outsider.sessionCookie);

    const res = await app.request(`/api/v1/artifacts/${artifactId}`, { headers: { Authorization: `Bearer ${outsiderKey.token}` } });
    expect(res.status).toBe(403);
  });

  it("enforces the key's own scopes, unlike a cookie session", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);
    const readOnlyKey = await issueUserKey(app, user.sessionCookie, ["artifacts:read"]);

    const res = await postArtifact(app, readOnlyKey.token, user.orgId);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("forbidden");
  });

  it("stops authenticating once revoked", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);
    const key = await issueUserKey(app, user.sessionCookie);

    const revokeRes = await app.request(`/api/v1/me/keys/${key.id}`, {
      method: "DELETE",
      headers: { Cookie: `oa_session=${user.sessionCookie}` },
    });
    expect(revokeRes.status).toBe(200);
    clearApiKeyVerifyCacheForTests(); // production keys stay valid for up to the 60s positive cache

    const res = await app.request("/api/v1/me/orgs", { headers: { Authorization: `Bearer ${key.token}` } });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("key_revoked");
  });

  it("cannot mint another key — /me/keys is session-only", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);
    const key = await issueUserKey(app, user.sessionCookie);

    const res = await app.request("/api/v1/me/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key.token}` },
      body: JSON.stringify({ scopes: ALL_SCOPES }),
    });
    expect(res.status).toBe(403);
  });

  describe("a personal key issued by a superadmin never gets admin/management access", () => {
    it("is refused on admin, org-management, and account routes that a cookie session would pass", async () => {
      const app = buildTestApp();
      const admin = await registerAndLogin(app);
      await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, admin.userId));
      const key = await issueUserKey(app, admin.sessionCookie);
      const headers = { Authorization: `Bearer ${key.token}` };

      // Sanity check: the underlying cookie session really is a superadmin.
      const meRes = await app.request("/api/v1/auth/me", { headers: { Cookie: `oa_session=${admin.sessionCookie}` } });
      expect(((await meRes.json()) as { isSuperadmin: boolean }).isSuperadmin).toBe(true);

      const adminStats = await app.request("/api/v1/admin/stats", { headers });
      expect(adminStats.status).toBe(403);

      const listOrgs = await app.request("/api/v1/orgs", { headers });
      expect(listOrgs.status).toBe(403);

      const authMe = await app.request("/api/v1/auth/me", { headers });
      expect(authMe.status).toBe(401);

      const createAgent = await app.request(`/api/v1/agents?orgId=${admin.orgId}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "should-not-be-created" }),
      });
      expect(createAgent.status).toBe(403);

      // And GET /me/orgs — the one endpoint open to a personal key — never leaks isSuperadmin.
      const meOrgs = await app.request("/api/v1/me/orgs", { headers });
      const meOrgsBody = (await meOrgs.json()) as Record<string, unknown>;
      expect(meOrgsBody.isSuperadmin).toBeUndefined();
    });
  });
});
