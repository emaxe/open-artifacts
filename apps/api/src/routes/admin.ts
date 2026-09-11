import { Hono } from "hono";
import { eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppBindings } from "../types.js";
import { requireAuth, requireSuperadmin } from "../middleware/auth.js";
import { artifacts, agents, orgs, users } from "../db/schema.js";
import { listAuditLog, recordAudit } from "../services/audit.js";
import { defaultInstanceSettings, getInstanceSettings, updateInstanceSettings } from "../services/settings.js";
import { getTopArtifacts } from "../services/analytics.js";
import { setUserStatus, CannotModifySuperadminError } from "../services/users.js";

export const adminRoutes = new Hono<AppBindings>();
// Scoped to "/admin/*" rather than a bare "*": once merged into the shared `api` router (all
// feature routers are mounted at the same "/" prefix in app.ts), a bare "*" middleware would
// match every route in the whole API, not just this router's own paths.
adminRoutes.use("/admin/*", requireAuth, requireSuperadmin);

adminRoutes.get("/admin/stats", async (c) => {
  const db = c.get("db");
  const [[artifactCount], [teamOrgCount], [mainOrgCount], [agentCount], [userCount], [storage]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(artifacts).where(isNull(artifacts.deletedAt)),
    db.select({ n: sql<number>`count(*)` }).from(orgs).where(eq(orgs.kind, "team")),
    db.select({ n: sql<number>`count(*)` }).from(orgs).where(eq(orgs.kind, "main")),
    db.select({ n: sql<number>`count(*)` }).from(agents),
    db.select({ n: sql<number>`count(*)` }).from(users),
    db.select({ total: sql<number>`coalesce(sum(${artifacts.sizeBytes}), 0)` }).from(artifacts).where(isNull(artifacts.deletedAt)),
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
});

adminRoutes.patch("/admin/settings", async (c) => {
  const db = c.get("db");
  const body = settingsPatchSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const current = await getInstanceSettings(db, defaultInstanceSettings(c.get("env")));
  const next = await updateInstanceSettings(db, body.data, current);
  return c.json({ settings: next });
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
