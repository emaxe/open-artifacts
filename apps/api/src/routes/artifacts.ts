import { Hono, type Context } from "hono";
import { buildEmbedCsp, createArtifactSchema, updateArtifactSchema } from "@open-artifacts/shared";
import type { AppBindings } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import {
  ArtifactTooLargeError,
  QuotaExceededError,
  VersionConflictError,
  LifetimeExceedsMaxError,
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
  listArtifactsForOrgs,
  listAllArtifacts,
} from "../services/artifacts.js";
import { renderArtifactHtml } from "../services/render.js";
import { recordAudit } from "../services/audit.js";
import { requiresScope } from "../services/scopes.js";
import { defaultInstanceSettings, getInstanceSettings } from "../services/settings.js";
import { listMemberOrgIds } from "../services/orgs.js";
import { resolveOrgScope, orgScopeErrorResponse } from "../services/org-scope.js";
import { resolveArtifactCeilings } from "../services/quota.js";

export const artifactRoutes = new Hono<AppBindings>();

/**
 * `quota_exceeded` used to be a flat error string with no way for a caller (agent or CLI) to act
 * on it beyond "tell a human". Structured the same way `lifetime_exceeds_max` already is, so an
 * agent can compare `usedBytes`/`limitBytes` against `GET /api/v1/quota` and decide what to do —
 * e.g. skip uploading a file rather than fail the whole publish.
 */
function quotaExceededResponse(c: Context<AppBindings>, err: QuotaExceededError) {
  return c.json(
    { error: { code: "quota_exceeded", message: err.message, scope: err.scope, limitBytes: err.limitBytes, usedBytes: err.usedBytes } },
    413,
  );
}

artifactRoutes.get("/artifacts", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!requiresScope(identity, "artifacts:read")) return c.json({ error: { code: "forbidden", message: "Missing scope artifacts:read" } }, 403);

  const db = c.get("db");
  const orgIdParam = identity.kind === "agent" ? identity.orgId : c.req.query("orgId");

  let all;
  if (orgIdParam) {
    const scope = await resolveOrgScope(db, identity, orgIdParam);
    if (!scope.ok) return orgScopeErrorResponse(c, scope);
    c.set("resolvedOrgId", scope.orgId);
    all = await listArtifactsForOrg(db, scope.orgId);
  } else if (identity.kind === "user" && identity.isSuperadmin) {
    all = await listAllArtifacts(db);
  } else if (identity.kind === "user" || identity.kind === "user_key") {
    // No single org to attribute usage metering to for this aggregate listing — resolvedOrgId
    // stays unset, and the metering middleware skips the row (see middleware/usage.ts).
    all = await listArtifactsForOrgs(db, await listMemberOrgIds(db, identity.userId));
  } else {
    return c.json({ error: { code: "invalid_input", message: "orgId query param is required" } }, 400);
  }

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

  const db = c.get("db");
  const scope = await resolveOrgScope(db, identity, c.req.query("orgId"));
  if (!scope.ok) return orgScopeErrorResponse(c, scope);
  const orgId = scope.orgId;
  c.set("resolvedOrgId", orgId);

  const body = createArtifactSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  try {
    const ceilings = await resolveArtifactCeilings(db, c.get("env"), orgId);
    const { artifact, version } = await createArtifact(db, { orgId, identity, ...body.data, ...ceilings });
    await recordAudit(db, { orgId, identity, action: "artifact.create", targetType: "artifact", targetId: artifact.id });
    return c.json({ artifact, currentVersion: version.versionNo }, 201);
  } catch (err) {
    if (err instanceof ArtifactTooLargeError) return c.json({ error: { code: "artifact_too_large", message: err.message } }, 413);
    if (err instanceof QuotaExceededError) return quotaExceededResponse(c, err);
    if (err instanceof LifetimeExceedsMaxError) {
      return c.json({ error: { code: "lifetime_exceeds_max", message: err.message, maxLifetimeMinutes: err.maxMinutes } }, 400);
    }
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

  const { lifetime, content, message, ...rest } = body.data;
  const ifMatch = c.req.header("if-match");
  try {
    // Both ceilings come from one settings read regardless of which of lifetime/content changed —
    // resolving only the one that's actually needed would save a query but risks the same "forgot
    // to resolve it" mistake this whole structure exists to prevent.
    const ceilings = await resolveArtifactCeilings(db, c.get("env"), artifact.orgId);
    const lifetimePatch = lifetime !== undefined ? { requested: lifetime, maxMinutes: ceilings.maxLifetimeMinutes } : undefined;
    const contentPatch =
      content !== undefined
        ? { text: content, message, maxArtifactSizeBytes: ceilings.maxArtifactSizeBytes, quota: ceilings.quota }
        : undefined;
    const result = await updateArtifact(db, artifact.id, { ...rest, identity, ifMatchContentHash: ifMatch, lifetime: lifetimePatch, content: contentPatch });
    await recordAudit(db, { orgId: artifact.orgId, identity, action: "artifact.update", targetType: "artifact", targetId: artifact.id });
    return c.json({ artifact: result.artifact, newVersionNo: result.version?.versionNo });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: { code: "version_conflict", message: err.message } }, 409);
    if (err instanceof ArtifactTooLargeError) return c.json({ error: { code: "artifact_too_large", message: err.message } }, 413);
    if (err instanceof QuotaExceededError) return quotaExceededResponse(c, err);
    if (err instanceof LifetimeExceedsMaxError) {
      return c.json({ error: { code: "lifetime_exceeds_max", message: err.message, maxLifetimeMinutes: err.maxMinutes } }, 400);
    }
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
  try {
    const ceilings = await resolveArtifactCeilings(db, c.get("env"), artifact.orgId);
    const result = await restoreVersion(db, artifact.id, versionNo, identity, ceilings);
    await recordAudit(db, { orgId: artifact.orgId, identity, action: "artifact.restore", targetType: "artifact", targetId: artifact.id, meta: { versionNo } });
    return c.json({ artifact: result.artifact, newVersionNo: result.version?.versionNo });
  } catch (err) {
    // A version that was accepted once could now exceed a since-lowered size/quota policy.
    if (err instanceof ArtifactTooLargeError) return c.json({ error: { code: "artifact_too_large", message: err.message } }, 413);
    if (err instanceof QuotaExceededError) return quotaExceededResponse(c, err);
    throw err;
  }
});
