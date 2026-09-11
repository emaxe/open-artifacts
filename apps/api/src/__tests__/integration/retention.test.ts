import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { artifacts, artifactVersions, auditLog, shares, users } from "../../db/schema.js";
import { purgeExpiredArtifacts } from "../../services/retention.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

async function makeSuperadmin(userId: string) {
  await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, userId));
}

async function createArtifact(app: ReturnType<typeof buildTestApp>, sessionCookie: string, orgId: string) {
  const res = await app.request(`/api/v1/artifacts?orgId=${orgId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
    body: JSON.stringify({ title: "t", kind: "html", content: "<h1>hi</h1>" }),
  });
  const body = (await res.json()) as { artifact: { id: string; orgId: string } };
  return body.artifact.id;
}

async function expire(artifactId: string) {
  await getTestDb()
    .update(artifacts)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(eq(artifacts.id, artifactId));
}

describe("purgeExpiredArtifacts", () => {
  it("hard-deletes version content for expired artifacts, leaves live ones untouched, and is idempotent", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);

    const liveId = await createArtifact(app, owner.sessionCookie, owner.orgId);
    const expiredId1 = await createArtifact(app, owner.sessionCookie, owner.orgId);
    const expiredId2 = await createArtifact(app, owner.sessionCookie, owner.orgId);
    await expire(expiredId1);
    await expire(expiredId2);

    const result = await purgeExpiredArtifacts(getTestDb());
    expect(result.purged).toBe(2);

    const db = getTestDb();
    for (const id of [expiredId1, expiredId2]) {
      const row = (await db.query.artifacts.findFirst({ where: eq(artifacts.id, id) }))!;
      expect(row.purgedAt).not.toBeNull();
      expect(row.deletedAt).not.toBeNull();
      expect(row.currentVersionId).toBeNull();
      expect(row.sizeBytes).toBe(0);

      const versions = await db.query.artifactVersions.findMany({ where: eq(artifactVersions.artifactId, id) });
      expect(versions).toHaveLength(0);
    }

    const liveRow = (await db.query.artifacts.findFirst({ where: eq(artifacts.id, liveId) }))!;
    expect(liveRow.purgedAt).toBeNull();
    const liveVersions = await db.query.artifactVersions.findMany({ where: eq(artifactVersions.artifactId, liveId) });
    expect(liveVersions).toHaveLength(1);

    // Idempotent: a second run finds nothing left to purge.
    const second = await purgeExpiredArtifacts(db);
    expect(second.purged).toBe(0);
  });

  it("writes an audit_log entry per purged artifact, attributed to the system", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const id = await createArtifact(app, owner.sessionCookie, owner.orgId);
    await expire(id);

    await purgeExpiredArtifacts(getTestDb());

    const entries = await getTestDb().query.auditLog.findMany({ where: eq(auditLog.targetId, id) });
    const expireEntry = entries.find((e) => e.action === "artifact.expire");
    expect(expireEntry).toBeDefined();
    expect(expireEntry!.actorType).toBe("system");
  });

  it("unpins and revokes a share before deleting versions, instead of failing on the foreign key", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const id = await createArtifact(app, owner.sessionCookie, owner.orgId);

    const shareRes = await app.request(`/api/v1/artifacts/${id}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ mode: "public", versionNo: 1 }),
    });
    expect(shareRes.status).toBe(201);
    const share = (await shareRes.json()) as { id: string; token: string };

    const beforePurge = await getTestDb().query.shares.findFirst({ where: eq(shares.id, share.id) });
    expect(beforePurge!.pinnedVersionId).not.toBeNull();

    await expire(id);
    const result = await purgeExpiredArtifacts(getTestDb());
    expect(result.purged).toBe(1);

    const afterPurge = await getTestDb().query.shares.findFirst({ where: eq(shares.id, share.id) });
    expect(afterPurge!.pinnedVersionId).toBeNull();
    expect(afterPurge!.revokedAt).not.toBeNull();

    const viewRes = await app.request(`/s/${share.token}`);
    expect(viewRes.status).toBe(410);
  });

  it("respects batchSize, purging in multiple batches", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const id1 = await createArtifact(app, owner.sessionCookie, owner.orgId);
    const id2 = await createArtifact(app, owner.sessionCookie, owner.orgId);
    await expire(id1);
    await expire(id2);

    const result = await purgeExpiredArtifacts(getTestDb(), { batchSize: 1 });
    expect(result.purged).toBe(2);
  });
});

describe("POST /admin/retention/purge", () => {
  it("is superadmin-only and returns the purge count", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const id = await createArtifact(app, owner.sessionCookie, owner.orgId);
    await expire(id);

    const forbidden = await app.request("/api/v1/admin/retention/purge", {
      method: "POST",
      headers: { Cookie: `oa_session=${owner.sessionCookie}` },
    });
    expect(forbidden.status).toBe(403);

    await makeSuperadmin(owner.userId);
    const res = await app.request("/api/v1/admin/retention/purge", {
      method: "POST",
      headers: { Cookie: `oa_session=${owner.sessionCookie}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { purged: number };
    expect(body.purged).toBe(1);
  });
});
