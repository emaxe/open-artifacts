import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { createShareSchema, updateShareSchema, resolveRequestedShareMode } from "@open-artifacts/shared";
import type { AppBindings } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { getArtifact, getVersionByNumber, resolveAccessForIdentity } from "../services/artifacts.js";
import { createShare, listSharesForArtifact, revokeShare, updateShareMode } from "../services/shares.js";
import { resolveSharePolicyForRequest } from "../services/share-policy.js";
import { unlockCookieName, grantUnlock, clearUnlock, UNLOCK_TTL_MS } from "../services/share-unlock.js";
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
  const env = c.get("env");
  return c.json({
    shares: list.map((s) => ({
      id: s.id,
      token: s.token,
      url: `${env.APP_ORIGIN}/s/${s.token}`,
      mode: s.mode,
      label: s.label,
      expiresAt: s.expiresAt,
      viewCount: s.viewCount,
      managerViewCount: s.managerViewCount,
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

  const policy = await resolveSharePolicyForRequest(db, c.get("env"), artifact.orgId);
  const resolved = resolveRequestedShareMode(body.data.mode, policy);
  if (!resolved.ok) {
    return c.json(
      {
        error: {
          code: "public_shares_forbidden",
          message: "Public links are disabled for this team",
          allowedModes: policy.allowedModes,
          defaultShareMode: policy.defaultShareMode,
        },
      },
      403,
    );
  }
  if (resolved.mode === "password" && !body.data.password) {
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
    mode: resolved.mode,
    label: body.data.label || undefined,
    password: body.data.password,
    expires: body.data.expires,
    pinnedVersionId,
    createdBy,
  });

  await recordAudit(db, { orgId: artifact.orgId, identity, action: "share.create", targetType: "share", targetId: share.id, meta: { mode: share.mode } });
  const env = c.get("env");
  return c.json(
    { id: share.id, token: share.token, url: `${env.APP_ORIGIN}/s/${share.token}`, mode: share.mode, label: share.label, expiresAt: share.expiresAt },
    201,
  );
});

/**
 * Changes an existing share's mode in place — same token, same URL — so switching a link from
 * `public` to `team` (or vice versa) doesn't force redistributing a new one. Primarily reached
 * from the visibility control in the `/s/:token` viewer panel itself, which is why on success it
 * also hands the caller (if a cookie session) a fresh unlock cookie when the new mode is
 * `password`: they just typed that password into this very request, so withholding it would only
 * make them retype it into the unlock form a moment later — see the comment below.
 */
shareRoutes.patch("/shares/:id", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!requiresScope(identity, "shares:write")) return c.json({ error: { code: "forbidden", message: "Missing scope shares:write" } }, 403);

  const db = c.get("db");
  const share = await db.query.shares.findFirst({ where: eq(shares.id, c.req.param("id")) });
  if (!share) return c.json({ error: { code: "not_found" } }, 404);

  const artifact = await getArtifact(db, share.artifactId);
  if (!artifact) return c.json({ error: { code: "not_found" } }, 404);
  const access = await resolveAccessForIdentity(db, identity, artifact);
  if (!access.write) return c.json({ error: { code: "forbidden" } }, 403);

  // Changing the mode of a link that's already dead is meaningless and would just be confusing —
  // the same 410 the viewer itself returns for a revoked/expired share (routes/public.ts).
  if (share.revokedAt !== null || (share.expiresAt !== null && share.expiresAt.getTime() <= Date.now())) {
    return c.json({ error: { code: "gone" } }, 410);
  }

  const body = updateShareSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const policy = await resolveSharePolicyForRequest(db, c.get("env"), artifact.orgId);
  const resolved = resolveRequestedShareMode(body.data.mode, policy);
  if (!resolved.ok) {
    return c.json(
      {
        error: {
          code: "public_shares_forbidden",
          message: "Public links are disabled for this team",
          allowedModes: policy.allowedModes,
          defaultShareMode: policy.defaultShareMode,
        },
      },
      403,
    );
  }
  if (resolved.mode === "password" && !body.data.password) {
    return c.json({ error: { code: "invalid_input", message: "password is required when mode is 'password'" } }, 400);
  }

  const updated = await updateShareMode(db, share.id, { mode: resolved.mode, password: body.data.password });

  // Any standing unlock session belonged to the old password (or no password at all) — it must
  // not silently carry over to whatever the mode just became.
  clearUnlock(share.token);
  // The caller just proved they know the new password by setting it in this very request — that's
  // exactly what typing it into the unlock form proves too, so grant them the same session rather
  // than making them immediately re-enter it. Only for a cookie-authenticated browser session; an
  // API-key caller (user_key/agent) has no browser to set a cookie in.
  if (resolved.mode === "password" && identity.kind === "user") {
    const expiresAtMs = Math.min(Date.now() + UNLOCK_TTL_MS, updated.expiresAt ? updated.expiresAt.getTime() : Infinity);
    const secret = grantUnlock(updated.token, expiresAtMs);
    setCookie(c, unlockCookieName(updated.token), secret, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: Math.max(1, Math.floor((expiresAtMs - Date.now()) / 1000)),
    });
  }

  await recordAudit(db, {
    orgId: artifact.orgId,
    identity,
    action: "share.update_mode",
    targetType: "share",
    targetId: share.id,
    meta: { from: share.mode, to: updated.mode },
  });

  const env = c.get("env");
  return c.json({
    id: updated.id,
    token: updated.token,
    url: `${env.APP_ORIGIN}/s/${updated.token}`,
    mode: updated.mode,
    label: updated.label,
    expiresAt: updated.expiresAt,
  });
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
