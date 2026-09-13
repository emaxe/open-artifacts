import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { artifactFiles, storageGcQueue } from "../../db/schema.js";
import { drainStorageGcQueue } from "../../services/storage-gc.js";
import { buildTestApp, getTestDb, getTestStorage, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

function authedHeaders(sessionCookie: string) {
  return { Cookie: `oa_session=${sessionCookie}` };
}

async function createArtifact(app: ReturnType<typeof buildTestApp>, sessionCookie: string, orgId: string) {
  const res = await app.request(`/api/v1/artifacts?orgId=${orgId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
    body: JSON.stringify({ title: "Report", kind: "html", content: "<h1>hi</h1>", visibility: "private" }),
  });
  const body = (await res.json()) as { artifact: { id: string; orgId: string } };
  return body.artifact;
}

function uploadForm(name: string, contentType: string, bytes: string) {
  const form = new FormData();
  form.append("file", new File([bytes], name, { type: contentType }));
  return form;
}

async function uploadFile(app: ReturnType<typeof buildTestApp>, sessionCookie: string, artifactId: string, name: string, contentType: string, bytes: string) {
  return app.request(`/api/v1/artifacts/${artifactId}/files`, {
    method: "POST",
    headers: authedHeaders(sessionCookie),
    body: uploadForm(name, contentType, bytes),
  });
}

describe("artifact files", () => {
  it("uploads a file, serves it, lists it, and deletes it — the delete queues the object for GC and drops it from storage", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const artifact = await createArtifact(app, sessionCookie, orgId);

    const uploadRes = await uploadFile(app, sessionCookie, artifact.id, "logo.png", "image/png", "not-really-a-png-but-bytes-are-bytes");
    expect(uploadRes.status).toBe(201);
    const uploaded = (await uploadRes.json()) as { file: { id: string; url: string; name: string; contentType: string; sizeBytes: number } };
    expect(uploaded.file.name).toBe("logo.png");
    expect(uploaded.file.url).toMatch(/^\/af\/[A-Za-z0-9_-]{32}$/);

    const listRes = await app.request(`/api/v1/artifacts/${artifact.id}/files`, { headers: authedHeaders(sessionCookie) });
    const { files } = (await listRes.json()) as { files: { id: string }[] };
    expect(files.map((f) => f.id)).toEqual([uploaded.file.id]);

    // Public, unauthenticated GET — no cookie sent.
    const serveRes = await app.request(uploaded.file.url);
    expect(serveRes.status).toBe(200);
    expect(await serveRes.text()).toBe("not-really-a-png-but-bytes-are-bytes");
    expect(serveRes.headers.get("content-type")).toBe("image/png");
    expect(serveRes.headers.get("content-disposition")).toMatch(/^inline;/);

    const delRes = await app.request(`/api/v1/artifacts/${artifact.id}/files/${uploaded.file.id}`, { method: "DELETE", headers: authedHeaders(sessionCookie) });
    expect(delRes.status).toBe(200);

    // Gone immediately, before GC even runs — the file row is what /af/:token resolves through.
    expect((await app.request(uploaded.file.url)).status).toBe(404);

    const db = getTestDb();
    const row = await db.query.artifactFiles.findFirst({ where: eq(artifactFiles.id, uploaded.file.id) });
    expect(row).toBeUndefined();
    const queued = await db.query.storageGcQueue.findMany();
    expect(queued.length).toBe(1);

    const drainResult = await drainStorageGcQueue(db, getTestStorage());
    expect(drainResult.deleted).toBe(1);
    expect(await db.query.storageGcQueue.findMany()).toEqual([]);
  });

  it("forces text/html and image/svg+xml to download as attachment/octet-stream, never inline", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const artifact = await createArtifact(app, sessionCookie, orgId);

    const htmlRes = await uploadFile(app, sessionCookie, artifact.id, "evil.html", "text/html", "<script>alert(1)</script>");
    const html = (await htmlRes.json()) as { file: { url: string } };
    const served = await app.request(html.file.url);
    expect(served.headers.get("content-type")).toBe("application/octet-stream");
    expect(served.headers.get("content-disposition")).toMatch(/^attachment;/);

    const svgRes = await uploadFile(app, sessionCookie, artifact.id, "evil.svg", "image/svg+xml", "<svg onload='alert(1)'></svg>");
    const svg = (await svgRes.json()) as { file: { url: string } };
    const servedSvg = await app.request(svg.file.url);
    expect(servedSvg.headers.get("content-type")).toBe("application/octet-stream");
    expect(servedSvg.headers.get("content-disposition")).toMatch(/^attachment;/);
  });

  it("deletes every file when its artifact is soft-deleted, and 404s the file URL immediately", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const artifact = await createArtifact(app, sessionCookie, orgId);
    const uploadRes = await uploadFile(app, sessionCookie, artifact.id, "logo.png", "image/png", "bytes");
    const uploaded = (await uploadRes.json()) as { file: { url: string } };

    const delRes = await app.request(`/api/v1/artifacts/${artifact.id}`, { method: "DELETE", headers: authedHeaders(sessionCookie) });
    expect(delRes.status).toBe(200);

    expect((await app.request(uploaded.file.url)).status).toBe(404);
    const db = getTestDb();
    expect(await db.query.artifactFiles.findMany({ where: eq(artifactFiles.artifactId, artifact.id) })).toEqual([]);
    expect((await db.query.storageGcQueue.findMany()).length).toBe(1);
  });

  it("rejects a file that would exceed the team's storage quota with a structured 413", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const artifact = await createArtifact(app, sessionCookie, orgId);

    const quotaRes = await app.request(`/api/v1/orgs/${orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
      body: JSON.stringify({ artifactQuotaBytes: 10 }),
    });
    expect(quotaRes.status).toBe(200);

    const res = await uploadFile(app, sessionCookie, artifact.id, "logo.png", "image/png", "this string is definitely more than ten bytes long");
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: { code: string; scope: string; limitBytes: number } };
    expect(body.error.code).toBe("quota_exceeded");
    expect(body.error.scope).toBe("artifact");
    expect(body.error.limitBytes).toBe(10);
  });

  it("GET /api/v1/quota defaults to unlimited and reflects usage and a lowered team quota", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);

    const before = await app.request(`/api/v1/quota?orgId=${orgId}`, { headers: authedHeaders(sessionCookie) });
    expect(before.status).toBe(200);
    const beforeBody = (await before.json()) as { org: { limitBytes: number | null; usedBytes: number } };
    expect(beforeBody.org.limitBytes).toBeNull();
    expect(beforeBody.org.usedBytes).toBe(0);

    const artifact = await createArtifact(app, sessionCookie, orgId);
    const afterCreate = await app.request(`/api/v1/quota?artifactId=${artifact.id}`, { headers: authedHeaders(sessionCookie) });
    const afterCreateBody = (await afterCreate.json()) as { org: { usedBytes: number }; artifact: { usedBytes: number; limitBytes: number | null } };
    expect(afterCreateBody.org.usedBytes).toBeGreaterThan(0);
    expect(afterCreateBody.artifact.limitBytes).toBeNull();
  });

  it("answers 501 storage_disabled when object storage isn't configured", async () => {
    const app = buildTestApp({ storageDisabled: true });
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const artifact = await createArtifact(app, sessionCookie, orgId);

    const res = await uploadFile(app, sessionCookie, artifact.id, "logo.png", "image/png", "bytes");
    expect(res.status).toBe(501);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("storage_disabled");
  });

  it("denies uploading to an artifact the caller can't write to", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const outsider = await registerAndLogin(app);
    const artifact = await createArtifact(app, owner.sessionCookie, owner.orgId);

    const res = await uploadFile(app, outsider.sessionCookie, artifact.id, "logo.png", "image/png", "bytes");
    expect(res.status).toBe(403);
  });
});
