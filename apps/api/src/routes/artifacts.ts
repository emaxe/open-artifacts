import { Hono } from "hono";
import { buildEmbedCsp, createArtifactSchema, updateArtifactSchema } from "@open-artifacts/shared";
import type { AppBindings } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import {
  ArtifactTooLargeError,
  QuotaExceededError,
  VersionConflictError,
  createArtifact,
  getArtifact,
  getCurrentVersion,
  getVersionByNumber,
  listArtifactsForOrg,
  listVersions,
  resolveAccessForIdentity,
  restoreVersion,
  softDeleteArtifact,
  updateArtifact,
} from "../services/artifacts.js";
import { renderArtifactHtml } from "../services/render.js";
import { recordAudit } from "../services/audit.js";
import { getOrgRole } from "../services/users.js";
import { requiresScope } from "../services/scopes.js";
import { defaultInstanceSettings, getInstanceSettings } from "../services/settings.js";

export const artifactRoutes = new Hono<AppBindings>();

artifactRoutes.get("/artifacts", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!requiresScope(identity, "artifacts:read")) return c.json({ error: { code: "forbidden", message: "Missing scope artifacts:read" } }, 403);

  const orgId = identity.kind === "agent" ? identity.orgId : c.req.query("orgId");
  if (!orgId) return c.json({ error: { code: "invalid_input", message: "orgId query param is required" } }, 400);

  const db = c.get("db");
  const all = await listArtifactsForOrg(db, orgId);
  const visible = [];
  for (const artifact of all) {
    const access = await resolveAccessForIdentity(db, identity, artifact);
    if (access.read) visible.push(artifact);
  }
  return c.json({ artifacts: visible });
});

artifactRoutes.post("/artifacts", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!requiresScope(identity, "artifacts:write")) return c.json({ error: { code: "forbidden", message: "Missing scope artifacts:write" } }, 403);

  const orgId = identity.kind === "agent" ? identity.orgId : c.req.query("orgId");
  if (!orgId) return c.json({ error: { code: "invalid_input", message: "orgId query param is required" } }, 400);
  if (identity.kind === "user") {
    const role = identity.isSuperadmin ? "owner" : await getOrgRole(c.get("db"), orgId, identity.userId);
    if (!role) return c.json({ error: { code: "forbidden" } }, 403);
  }

  const body = createArtifactSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const db = c.get("db");
  try {
    const { artifact, version } = await createArtifact(db, { orgId, identity, ...body.data });
    await recordAudit(db, { orgId, identity, action: "artifact.create", targetType: "artifact", targetId: artifact.id });
    return c.json({ artifact, currentVersion: version.versionNo }, 201);
  } catch (err) {
    if (err instanceof ArtifactTooLargeError) return c.json({ error: { code: "artifact_too_large", message: err.message } }, 413);
    if (err instanceof QuotaExceededError) return c.json({ error: { code: "quota_exceeded", message: err.message } }, 413);
    throw err;
  }
});

artifactRoutes.get("/artifacts/:id", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!requiresScope(identity, "artifacts:read")) return c.json({ error: { code: "forbidden", message: "Missing scope artifacts:read" } }, 403);

  const db = c.get("db");
  const artifact = await getArtifact(db, c.req.param("id"));
  if (!artifact) return c.json({ error: { code: "not_found" } }, 404);

  const access = await resolveAccessForIdentity(db, identity, artifact);
  if (!access.read) return c.json({ error: { code: "forbidden" } }, 403);

  const version = await getCurrentVersion(db, artifact);
  return c.json({ artifact, content: version?.content, contentHash: version?.contentHash, versionNo: version?.versionNo });
});

/**
 * Authenticated, sandboxed rendering of an artifact's current (or a specific) version — used by
 * the owner's own preview iframe in the web UI, without requiring a public share link first.
 * Carries the exact same CSP + sandbox-origin protections as the public `/embed/:token` route.
 */
artifactRoutes.get("/artifacts/:id/preview", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!requiresScope(identity, "artifacts:read")) return c.json({ error: { code: "forbidden" } }, 403);

  const db = c.get("db");
  const env = c.get("env");
  const artifact = await getArtifact(db, c.req.param("id"));
  if (!artifact) return c.html("Not found.", 404);

  const access = await resolveAccessForIdentity(db, identity, artifact);
  if (!access.read) return c.html("Forbidden.", 403);

  const versionParam = c.req.query("version");
  const version = versionParam
    ? await getVersionByNumber(db, artifact.id, Number(versionParam))
    : await getCurrentVersion(db, artifact);
  if (!version) return c.html("No content available.", 404);

  const settings = await getInstanceSettings(db, defaultInstanceSettings(env));
  c.header("Content-Security-Policy", buildEmbedCsp({ scriptAllowlist: settings.cdnAllowlist, frameAncestor: env.APP_ORIGIN }));
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  return c.html(renderArtifactHtml(artifact.kind, version.content));
});

artifactRoutes.patch("/artifacts/:id", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!requiresScope(identity, "artifacts:write")) return c.json({ error: { code: "forbidden", message: "Missing scope artifacts:write" } }, 403);

  const db = c.get("db");
  const artifact = await getArtifact(db, c.req.param("id"));
  if (!artifact) return c.json({ error: { code: "not_found" } }, 404);

  const access = await resolveAccessForIdentity(db, identity, artifact);
  if (!access.write) return c.json({ error: { code: "forbidden" } }, 403);

  const body = updateArtifactSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const ifMatch = c.req.header("if-match");
  try {
    const result = await updateArtifact(db, artifact.id, { ...body.data, identity, ifMatchContentHash: ifMatch });
    await recordAudit(db, { orgId: artifact.orgId, identity, action: "artifact.update", targetType: "artifact", targetId: artifact.id });
    return c.json({ artifact: result.artifact, newVersionNo: result.version?.versionNo });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: { code: "version_conflict", message: err.message } }, 409);
    if (err instanceof ArtifactTooLargeError) return c.json({ error: { code: "artifact_too_large", message: err.message } }, 413);
    if (err instanceof QuotaExceededError) return c.json({ error: { code: "quota_exceeded", message: err.message } }, 413);
    throw err;
  }
});

artifactRoutes.delete("/artifacts/:id", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!requiresScope(identity, "artifacts:delete")) return c.json({ error: { code: "forbidden", message: "Missing scope artifacts:delete" } }, 403);

  const db = c.get("db");
  const artifact = await getArtifact(db, c.req.param("id"));
  if (!artifact) return c.json({ error: { code: "not_found" } }, 404);

  const access = await resolveAccessForIdentity(db, identity, artifact);
  if (!access.delete) return c.json({ error: { code: "forbidden" } }, 403);

  await softDeleteArtifact(db, artifact.id);
  await recordAudit(db, { orgId: artifact.orgId, identity, action: "artifact.delete", targetType: "artifact", targetId: artifact.id });
  return c.json({ ok: true });
});

artifactRoutes.get("/artifacts/:id/versions", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  const db = c.get("db");
  const artifact = await getArtifact(db, c.req.param("id"));
  if (!artifact) return c.json({ error: { code: "not_found" } }, 404);
  const access = await resolveAccessForIdentity(db, identity, artifact);
  if (!access.read) return c.json({ error: { code: "forbidden" } }, 403);

  const versions = await listVersions(db, artifact.id);
  return c.json({ versions: versions.map((v) => ({ versionNo: v.versionNo, contentHash: v.contentHash, sizeBytes: v.sizeBytes, message: v.message, createdAt: v.createdAt })) });
});

artifactRoutes.get("/artifacts/:id/versions/:n", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  const db = c.get("db");
  const artifact = await getArtifact(db, c.req.param("id"));
  if (!artifact) return c.json({ error: { code: "not_found" } }, 404);
  const access = await resolveAccessForIdentity(db, identity, artifact);
  if (!access.read) return c.json({ error: { code: "forbidden" } }, 403);

  const versionNo = Number(c.req.param("n"));
  const version = await getVersionByNumber(db, artifact.id, versionNo);
  if (!version) return c.json({ error: { code: "not_found" } }, 404);
  return c.json({ versionNo: version.versionNo, content: version.content, contentHash: version.contentHash, createdAt: version.createdAt, message: version.message });
});

artifactRoutes.post("/artifacts/:id/versions/:n/restore", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!requiresScope(identity, "artifacts:write")) return c.json({ error: { code: "forbidden", message: "Missing scope artifacts:write" } }, 403);

  const db = c.get("db");
  const artifact = await getArtifact(db, c.req.param("id"));
  if (!artifact) return c.json({ error: { code: "not_found" } }, 404);
  const access = await resolveAccessForIdentity(db, identity, artifact);
  if (!access.write) return c.json({ error: { code: "forbidden" } }, 403);

  const versionNo = Number(c.req.param("n"));
  const result = await restoreVersion(db, artifact.id, versionNo, identity);
  await recordAudit(db, { orgId: artifact.orgId, identity, action: "artifact.restore", targetType: "artifact", targetId: artifact.id, meta: { versionNo } });
  return c.json({ artifact: result.artifact, newVersionNo: result.version?.versionNo });
});
