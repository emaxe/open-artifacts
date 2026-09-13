import { Hono } from "hono";
import { eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { defaultShareModeSchema } from "@open-artifacts/shared";
import type { AppBindings } from "../types.js";
import { requireAuth, requireSuperadmin } from "../middleware/auth.js";
import { artifacts, agents, artifactFiles, orgs, users } from "../db/schema.js";
import { listAuditLog, recordAudit } from "../services/audit.js";
import { defaultInstanceSettings, getInstanceSettings, updateInstanceSettings } from "../services/settings.js";
import { getTopArtifacts } from "../services/analytics.js";
import { setUserStatus, CannotModifySuperadminError } from "../services/users.js";
import { clampArtifactExpirations, clampOrgLifetimeOverrides } from "../services/lifetime.js";
import { purgeExpiredArtifacts } from "../services/retention.js";
import { clampOrgQuotaOverrides } from "../services/quota.js";
import { reconcileStorage } from "../services/storage-gc.js";

export const adminRoutes = new Hono<AppBindings>();
// Scoped to "/admin/*" rather than a bare "*": once merged into the shared `api` router (all
// feature routers are mounted at the same "/" prefix in app.ts), a bare "*" middleware would
// match every route in the whole API, not just this router's own paths.
adminRoutes.use("/admin/*", requireAuth, requireSuperadmin);

adminRoutes.get("/admin/stats", async (c) => {
  const db = c.get("db");
  const [[artifactCount], [teamOrgCount], [mainOrgCount], [agentCount], [userCount], [storage], [fileCount]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(artifacts).where(isNull(artifacts.deletedAt)),
    db.select({ n: sql<number>`count(*)` }).from(orgs).where(eq(orgs.kind, "team")),
    db.select({ n: sql<number>`count(*)` }).from(orgs).where(eq(orgs.kind, "main")),
    db.select({ n: sql<number>`count(*)` }).from(agents),
    db.select({ n: sql<number>`count(*)` }).from(users),
    // Includes uploaded file bytes alongside artifact source text — the same total the per-team
    // quota (services/quota.ts) is checked against, so this number and a team's own usage always
    // agree in what they're counting.
    db.select({ total: sql<number>`coalesce(sum(${artifacts.sizeBytes} + ${artifacts.filesBytes}), 0)` }).from(artifacts).where(isNull(artifacts.deletedAt)),
    db.select({ n: sql<number>`count(*)` }).from(artifactFiles),
  ]);

  return c.json({
    artifacts: Number(artifactCount!.n),
    // "orgs" kept for backward compat with any existing consumer; teamOrgs/mainOrgs is what the
    // new overview UI actually renders — a combined "Организации" count stopped meaning much once
    // every user got an auto-provisioned main workspace (see docs/superpowers/specs).
    orgs: Number(teamOrgCount!.n) + Number(mainOrgCount!.n),
    teamOrgs: Number(teamOrgCount!.n),
    mainOrgs: Number(mainOrgCount!.n),
    agents: Number(agentCount!.n),
    users: Number(userCount!.n),
    storageBytes: Number(storage!.total),
    files: Number(fileCount!.n),
    storageEnabled: c.get("storage").enabled,
  });
});



adminRoutes.get("/admin/orgs/:id/top-artifacts", async (c) => {
  const db = c.get("db");
  const top = await getTopArtifacts(db, c.req.param("id"));
  return c.json({ topArtifacts: top });
});



adminRoutes.get("/admin/audit", async (c) => {
  const db = c.get("db");
  const orgId = c.req.query("orgId") || undefined;
  const actorId = c.req.query("actorId") || undefined;
  const action = c.req.query("action") || undefined;
  const fromRaw = c.req.query("from");
  const toRaw = c.req.query("to");
  const cursor = c.req.query("cursor") || undefined;
  const limit = Number(c.req.query("limit") ?? 50);

  const { entries, nextCursor } = await listAuditLog(db, {
    orgId,
    actorId,
    action,
    from: fromRaw ? new Date(fromRaw) : undefined,
    to: toRaw ? new Date(toRaw) : undefined,
    cursor,
    limit,
  });
  return c.json({ entries, nextCursor });
});

adminRoutes.get("/admin/settings", async (c) => {
  const db = c.get("db");
  const settings = await getInstanceSettings(db, defaultInstanceSettings(c.get("env")));
  return c.json({ settings });
});

const settingsPatchSchema = z.object({
  registrationMode: z.enum(["open", "invite_only", "closed"]).optional(),
  defaultKeyTtlDays: z.number().int().nonnegative().optional(),
  cdnAllowlist: z.array(z.string().url()).optional(),
  viewRetentionDays: z.number().int().positive().optional(),
  maxArtifactSizeBytes: z.number().int().positive().optional(),
  inviteTtlDays: z.number().int().positive().optional(),
  // Minutes; 0 = unlimited. Also the default lifetime for newly created artifacts.
  maxArtifactLifetimeMinutes: z.number().int().nonnegative().optional(),
  allowPublicShares: z.boolean().optional(),
  defaultShareMode: defaultShareModeSchema.optional(),
  // Bytes; 0 = unlimited (the default). A team may set its own stricter override — see quota.ts.
  orgQuotaBytes: z.number().int().nonnegative().optional(),
  artifactQuotaBytes: z.number().int().nonnegative().optional(),
});

adminRoutes.patch("/admin/settings", async (c) => {
  const db = c.get("db");
  const body = settingsPatchSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const current = await getInstanceSettings(db, defaultInstanceSettings(c.get("env")));
  const next = await updateInstanceSettings(db, body.data, current);

  let shortenedArtifacts: number | undefined;
  if (body.data.maxArtifactLifetimeMinutes !== undefined && body.data.maxArtifactLifetimeMinutes !== current.maxArtifactLifetimeMinutes) {
    // Keep stored team overrides truthful, then re-clamp every artifact's deadline from its own
    // created_at. Lowering the max is a destructive, irreversible action (content gets hard-deleted
    // once the sweeper catches up), so it gets its own audit entry.
    await clampOrgLifetimeOverrides(db, body.data.maxArtifactLifetimeMinutes);
    shortenedArtifacts = await clampArtifactExpirations(db, { globalMaxMinutes: body.data.maxArtifactLifetimeMinutes });
    await recordAudit(db, {
      identity: c.get("identity")!,
      action: "settings.artifact_lifetime_update",
      meta: { maxArtifactLifetimeMinutes: body.data.maxArtifactLifetimeMinutes, shortenedArtifacts },
    });
  }

  if (
    (body.data.orgQuotaBytes !== undefined && body.data.orgQuotaBytes !== current.orgQuotaBytes) ||
    (body.data.artifactQuotaBytes !== undefined && body.data.artifactQuotaBytes !== current.artifactQuotaBytes)
  ) {
    // Same reasoning as the lifetime clamp above: lowering a quota is destructive to what a team
    // believed its own override meant, so keep stored overrides truthful and log it separately.
    await clampOrgQuotaOverrides(db, body.data.orgQuotaBytes ?? current.orgQuotaBytes, body.data.artifactQuotaBytes ?? current.artifactQuotaBytes);
    await recordAudit(db, {
      identity: c.get("identity")!,
      action: "settings.quota_update",
      meta: { orgQuotaBytes: body.data.orgQuotaBytes, artifactQuotaBytes: body.data.artifactQuotaBytes },
    });
  }

  if (
    (body.data.allowPublicShares !== undefined && body.data.allowPublicShares !== current.allowPublicShares) ||
    (body.data.defaultShareMode !== undefined && body.data.defaultShareMode !== current.defaultShareMode)
  ) {
    // Deliberately does NOT rewrite `orgs` rows (unlike the lifetime clamp above) — every read of
    // a team's share policy goes through resolveSharePolicy, so a stored team preference stays
    // honest and survives this flag being toggled off and back on. See share-policy.ts.
    await recordAudit(db, {
      identity: c.get("identity")!,
      action: "settings.share_policy_update",
      meta: { allowPublicShares: body.data.allowPublicShares, defaultShareMode: body.data.defaultShareMode },
    });
  }

  return c.json({ settings: next, shortenedArtifacts });
});

/** Manual trigger for the retention sweeper — also the test-friendly way to purge without waiting for the interval. */
adminRoutes.post("/admin/retention/purge", async (c) => {
  const db = c.get("db");
  const result = await purgeExpiredArtifacts(db);
  await recordAudit(db, { identity: c.get("identity")!, action: "artifact.purge_run", meta: { purged: result.purged } });
  return c.json(result);
});

/**
 * Safety-net trigger for "a file with no artifact must not exist" (see storage-gc.ts's
 * reconcileStorage doc comment) — queues any bucket object with no matching `artifact_files` row
 * for deletion. Not run on a timer; an admin action, like the retention purge above.
 */
adminRoutes.post("/admin/storage/reconcile", async (c) => {
  const db = c.get("db");
  const result = await reconcileStorage(db, c.get("storage"));
  await recordAudit(db, { identity: c.get("identity")!, action: "storage.reconcile_run", meta: { orphans: result.orphans } });
  return c.json(result);
});

const statusPatchSchema = z.object({ status: z.enum(["active", "blocked", "deleted"]) });

adminRoutes.patch("/admin/users/:id/status", async (c) => {
  const db = c.get("db");
  const targetId = c.req.param("id");
  const body = statusPatchSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  try {
    await setUserStatus(db, targetId, body.data.status);
  } catch (err) {
    if (err instanceof CannotModifySuperadminError) return c.json({ error: { code: "forbidden", message: err.message } }, 403);
    throw err;
  }
  await recordAudit(db, { identity: c.get("identity")!, action: "user.set_status", targetType: "user", targetId, meta: { status: body.data.status } });
  return c.json({ ok: true });
});
