import { Hono } from "hono";
import { createShareSchema } from "@open-artifacts/shared";
import type { AppBindings } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { getArtifact, getVersionByNumber, resolveAccessForIdentity } from "../services/artifacts.js";
import { createShare, listSharesForArtifact, revokeShare } from "../services/shares.js";
import { recordAudit } from "../services/audit.js";
import { requiresScope } from "../services/scopes.js";
import { actingUserId } from "../services/identity.js";
import { shares } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const shareRoutes = new Hono<AppBindings>();

shareRoutes.get("/artifacts/:id/shares", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  const db = c.get("db");
  const artifact = await getArtifact(db, c.req.param("id"));
  if (!artifact) return c.json({ error: { code: "not_found" } }, 404);
  const access = await resolveAccessForIdentity(db, identity, artifact);
  if (!access.write) return c.json({ error: { code: "forbidden" } }, 403);

  const list = await listSharesForArtifact(db, artifact.id);
  return c.json({
    shares: list.map((s) => ({
      id: s.id,
      token: s.token,
      mode: s.mode,
      expiresAt: s.expiresAt,
      viewCount: s.viewCount,
      revokedAt: s.revokedAt,
      createdAt: s.createdAt,
    })),
  });
});

shareRoutes.post("/artifacts/:id/shares", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!requiresScope(identity, "shares:write")) return c.json({ error: { code: "forbidden", message: "Missing scope shares:write" } }, 403);

  const db = c.get("db");
  const artifact = await getArtifact(db, c.req.param("id"));
  if (!artifact) return c.json({ error: { code: "not_found" } }, 404);
  const access = await resolveAccessForIdentity(db, identity, artifact);
  if (!access.write) return c.json({ error: { code: "forbidden" } }, 403);

  const body = createShareSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);
  if (body.data.mode === "password" && !body.data.password) {
    return c.json({ error: { code: "invalid_input", message: "password is required when mode is 'password'" } }, 400);
  }

  let pinnedVersionId: string | undefined;
  if (body.data.versionNo) {
    const version = await getVersionByNumber(db, artifact.id, body.data.versionNo);
    if (!version) return c.json({ error: { code: "not_found", message: "versionNo not found" } }, 404);
    pinnedVersionId = version.id;
  }

  const createdBy = identity.kind === "agent" ? identity.agentId : actingUserId(identity)!;
  const share = await createShare(db, {
    artifactId: artifact.id,
    mode: body.data.mode,
    password: body.data.password,
    expires: body.data.expires,
    pinnedVersionId,
    createdBy,
  });

  await recordAudit(db, { orgId: artifact.orgId, identity, action: "share.create", targetType: "share", targetId: share.id });
  const env = c.get("env");
  return c.json({ id: share.id, token: share.token, url: `${env.APP_ORIGIN}/s/${share.token}`, mode: share.mode, expiresAt: share.expiresAt }, 201);
});

shareRoutes.delete("/shares/:id", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!requiresScope(identity, "shares:write")) return c.json({ error: { code: "forbidden", message: "Missing scope shares:write" } }, 403);

  const db = c.get("db");
  const share = await db.query.shares.findFirst({ where: eq(shares.id, c.req.param("id")) });
  if (!share) return c.json({ error: { code: "not_found" } }, 404);

  const artifact = await getArtifact(db, share.artifactId);
  if (!artifact) return c.json({ error: { code: "not_found" } }, 404);
  const access = await resolveAccessForIdentity(db, identity, artifact);
  if (!access.write) return c.json({ error: { code: "forbidden" } }, 403);

  await revokeShare(db, share.id);
  await recordAudit(db, { orgId: artifact.orgId, identity, action: "share.revoke", targetType: "share", targetId: share.id });
  return c.json({ ok: true });
});
