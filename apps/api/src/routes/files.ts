import { Hono, type Context } from "hono";
import type { AppBindings } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { requiresScope } from "../services/scopes.js";
import { getArtifact, getArtifactWithLiveness, resolveAccessForIdentity } from "../services/artifacts.js";
import { attachFile, listFilesForArtifact, deleteFile, getFileByToken, StorageDisabledError } from "../services/artifact-files.js";
import { QuotaExceededError, resolveQuotaForRequest, buildQuotaSnapshot } from "../services/quota.js";
import { resolveOrgScope, orgScopeErrorResponse } from "../services/org-scope.js";
import { recordAudit } from "../services/audit.js";
import { isInlineContentType } from "../services/file-types.js";
import { fileContentDisposition } from "../services/download-name.js";

export const fileRoutes = new Hono<AppBindings>();
export const publicFileRoutes = new Hono<AppBindings>();

function fileUrl(token: string): string {
  return `/af/${token}`;
}

function serializeFile(f: { id: string; token: string; name: string; contentType: string; sizeBytes: number; createdAt: Date }) {
  return { id: f.id, name: f.name, contentType: f.contentType, sizeBytes: f.sizeBytes, createdAt: f.createdAt, url: fileUrl(f.token) };
}

function quotaExceededResponse(c: Context<AppBindings>, err: QuotaExceededError) {
  return c.json(
    { error: { code: "quota_exceeded", message: err.message, scope: err.scope, limitBytes: err.limitBytes, usedBytes: err.usedBytes } },
    413,
  );
}

function storageDisabledResponse(c: Context<AppBindings>) {
  return c.json({ error: { code: "storage_disabled", message: "Object storage is not configured for this instance" } }, 501);
}

/**
 * Uploads a file and attaches it to an artifact. `multipart/form-data` with a single `file` field
 * (and an optional `name` field overriding the uploaded filename) — this is a new surface
 * deliberately outside the JSON-only body every other artifact-writing route uses.
 */
fileRoutes.post("/artifacts/:id/files", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!requiresScope(identity, "artifacts:write")) return c.json({ error: { code: "forbidden", message: "Missing scope artifacts:write" } }, 403);

  const storage = c.get("storage");
  if (!storage.enabled) return storageDisabledResponse(c);

  const db = c.get("db");
  const env = c.get("env");
  const artifact = await getArtifact(db, c.req.param("id"));
  if (!artifact) return c.json({ error: { code: "not_found" } }, 404);

  const access = await resolveAccessForIdentity(db, identity, artifact);
  if (!access.write) return c.json({ error: { code: "forbidden" } }, 403);

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: { code: "invalid_input", message: "Expected multipart/form-data with a 'file' field" } }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: { code: "invalid_input", message: "Missing 'file' field" } }, 400);
  if (file.size > env.STORAGE_MAX_FILE_BYTES) {
    return c.json({ error: { code: "file_too_large", message: `File exceeds the maximum allowed size (${env.STORAGE_MAX_FILE_BYTES} bytes)`, maxFileBytes: env.STORAGE_MAX_FILE_BYTES } }, 413);
  }
  const nameField = form.get("name");
  const name = (typeof nameField === "string" && nameField.trim()) || file.name || "file";
  const contentType = file.type || "application/octet-stream";
  const body = Buffer.from(await file.arrayBuffer());

  try {
    const quota = await resolveQuotaForRequest(db, env, artifact.orgId);
    const row = await attachFile(db, storage, { artifactId: artifact.id, orgId: artifact.orgId, name, contentType, body, identity, quota });
    await recordAudit(db, { orgId: artifact.orgId, identity, action: "artifact.file_attach", targetType: "artifact", targetId: artifact.id, meta: { fileId: row.id, name, sizeBytes: row.sizeBytes } });
    return c.json({ file: serializeFile(row) }, 201);
  } catch (err) {
    if (err instanceof QuotaExceededError) return quotaExceededResponse(c, err);
    if (err instanceof StorageDisabledError) return storageDisabledResponse(c);
    throw err;
  }
});

fileRoutes.get("/artifacts/:id/files", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!requiresScope(identity, "artifacts:read")) return c.json({ error: { code: "forbidden", message: "Missing scope artifacts:read" } }, 403);

  const db = c.get("db");
  const artifact = await getArtifact(db, c.req.param("id"));
  if (!artifact) return c.json({ error: { code: "not_found" } }, 404);
  const access = await resolveAccessForIdentity(db, identity, artifact);
  if (!access.read) return c.json({ error: { code: "forbidden" } }, 403);

  const files = await listFilesForArtifact(db, artifact.id);
  return c.json({ files: files.map(serializeFile) });
});

fileRoutes.delete("/artifacts/:id/files/:fileId", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!requiresScope(identity, "artifacts:write")) return c.json({ error: { code: "forbidden", message: "Missing scope artifacts:write" } }, 403);

  const db = c.get("db");
  const artifact = await getArtifact(db, c.req.param("id"));
  if (!artifact) return c.json({ error: { code: "not_found" } }, 404);
  const access = await resolveAccessForIdentity(db, identity, artifact);
  if (!access.write) return c.json({ error: { code: "forbidden" } }, 403);

  const deleted = await deleteFile(db, artifact.id, c.req.param("fileId"));
  if (!deleted) return c.json({ error: { code: "not_found" } }, 404);
  await recordAudit(db, { orgId: artifact.orgId, identity, action: "artifact.file_delete", targetType: "artifact", targetId: artifact.id, meta: { fileId: deleted.id, name: deleted.name } });
  return c.json({ ok: true });
});

/**
 * "How much room do I have?" — the one endpoint every identity kind can call with no scope
 * requirement (same precedent as `GET /me/orgs`), because an agent deciding whether to upload a
 * file needs to ask this BEFORE it has anything to attach, when there's no artifact id yet.
 * `artifactId` narrows the answer to one artifact's own ceiling; omit it for the team-wide number.
 */
fileRoutes.get("/quota", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  const db = c.get("db");
  const env = c.get("env");
  const artifactIdParam = c.req.query("artifactId");

  let orgId: string;
  let artifactId: string | undefined;
  if (artifactIdParam) {
    const artifact = await getArtifact(db, artifactIdParam);
    if (!artifact) return c.json({ error: { code: "not_found" } }, 404);
    const access = await resolveAccessForIdentity(db, identity, artifact);
    if (!access.read) return c.json({ error: { code: "forbidden" } }, 403);
    orgId = artifact.orgId;
    artifactId = artifact.id;
  } else {
    const orgIdParam = identity.kind === "agent" ? identity.orgId : c.req.query("orgId");
    const scope = await resolveOrgScope(db, identity, orgIdParam);
    if (!scope.ok) return orgScopeErrorResponse(c, scope);
    orgId = scope.orgId;
  }
  c.set("resolvedOrgId", orgId);

  const snapshot = await buildQuotaSnapshot(db, env, orgId, c.get("storage").enabled, artifactId);
  return c.json(snapshot);
});

/**
 * Serves an uploaded file's bytes. Public like `/embed/:token`, but gated on the PARENT
 * ARTIFACT's liveness rather than any one share's access matrix: a file's URL is baked into the
 * artifact's own content (an `<img src>` inside published HTML) and is meant to keep working
 * across every share of that artifact, and across `/artifacts/:id/preview` — it isn't scoped to
 * the share that happened to be open when the URL was written. The token itself IS the
 * capability: it's unguessable (nanoid(32)) and only discoverable by reading the artifact's
 * content, which already passed a real access check to be readable at all.
 */
publicFileRoutes.get("/af/:token", async (c) => {
  const db = c.get("db");
  const storage = c.get("storage");
  const token = c.req.param("token");

  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Cache-Control", "private, no-store");

  const file = await getFileByToken(db, token);
  if (!file) return c.text("Not found.", 404);

  const { liveness } = await getArtifactWithLiveness(db, file.artifactId);
  if (liveness === "missing" || liveness === "deleted") return c.text("Not found.", 404);
  if (liveness === "expired") return c.text("This artifact is no longer available.", 410);

  if (!storage.enabled) return c.text("Not found.", 404);
  const body = await storage.getObject(file.storageKey);
  if (!body) return c.text("Not found.", 404);

  // Only a strict allowlist of types (see file-types.ts) is ever rendered in place; anything else
  // — including text/html and image/svg+xml, both of which a browser can execute — downloads
  // instead, served as application/octet-stream regardless of what was uploaded. Same reasoning
  // as /s/:token/download: an executable type served inline from this app's own origin would
  // reach oa_session, which the sandboxed /embed iframe exists to prevent.
  const inline = isInlineContentType(file.contentType);
  return c.body(new Uint8Array(body), 200, {
    "Content-Type": inline ? file.contentType : "application/octet-stream",
    "Content-Disposition": fileContentDisposition(file.name, inline ? "inline" : "attachment"),
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
});
