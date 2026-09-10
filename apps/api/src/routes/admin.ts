import { Hono } from "hono";
import { isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppBindings } from "../types.js";
import { requireAuth, requireSuperadmin } from "../middleware/auth.js";
import { artifacts, agents, orgs, users } from "../db/schema.js";
import { listAuditLog } from "../services/audit.js";
import { defaultInstanceSettings, getInstanceSettings, updateInstanceSettings } from "../services/settings.js";
import { getTopArtifacts } from "../services/analytics.js";

export const adminRoutes = new Hono<AppBindings>();
// Scoped to "/admin/*" rather than a bare "*": once merged into the shared `api` router (all
// feature routers are mounted at the same "/" prefix in app.ts), a bare "*" middleware would
// match every route in the whole API, not just this router's own paths.
adminRoutes.use("/admin/*", requireAuth, requireSuperadmin);

adminRoutes.get("/admin/stats", async (c) => {
  const db = c.get("db");
  const [[artifactCount], [orgCount], [agentCount], [userCount], [storage]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(artifacts).where(isNull(artifacts.deletedAt)),
    db.select({ n: sql<number>`count(*)` }).from(orgs),
    db.select({ n: sql<number>`count(*)` }).from(agents),
    db.select({ n: sql<number>`count(*)` }).from(users),
    db.select({ total: sql<number>`coalesce(sum(${artifacts.sizeBytes}), 0)` }).from(artifacts).where(isNull(artifacts.deletedAt)),
  ]);

  return c.json({
    artifacts: Number(artifactCount!.n),
    orgs: Number(orgCount!.n),
    agents: Number(agentCount!.n),
    users: Number(userCount!.n),
    storageBytes: Number(storage!.total),
  });
});

adminRoutes.get("/admin/orgs", async (c) => {
  const db = c.get("db");
  const list = await db.query.orgs.findMany();
  return c.json({ orgs: list });
});

adminRoutes.get("/admin/orgs/:id/top-artifacts", async (c) => {
  const db = c.get("db");
  const top = await getTopArtifacts(db, c.req.param("id"));
  return c.json({ topArtifacts: top });
});

adminRoutes.get("/admin/users", async (c) => {
  const db = c.get("db");
  const list = await db.query.users.findMany();
  return c.json({ users: list.map((u) => ({ id: u.id, email: u.email, name: u.name, isSuperadmin: u.isSuperadmin, createdAt: u.createdAt })) });
});

adminRoutes.get("/admin/audit", async (c) => {
  const db = c.get("db");
  const orgId = c.req.query("orgId");
  const limit = Number(c.req.query("limit") ?? 100);
  const log = await listAuditLog(db, { orgId, limit });
  return c.json({ auditLog: log });
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
});

adminRoutes.patch("/admin/settings", async (c) => {
  const db = c.get("db");
  const body = settingsPatchSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const current = await getInstanceSettings(db, defaultInstanceSettings(c.get("env")));
  const next = await updateInstanceSettings(db, body.data, current);
  return c.json({ settings: next });
});
