import { Hono } from "hono";
import { ilike, inArray, or, sql } from "drizzle-orm";
import type { AppBindings } from "../types.js";
import { requireAuth, requireSuperadmin } from "../middleware/auth.js";
import { orgMembers, users } from "../db/schema.js";

export const userRoutes = new Hono<AppBindings>();

userRoutes.get("/users", requireAuth, requireSuperadmin, async (c) => {
  const db = c.get("db");
  const search = c.req.query("search") || undefined;
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? "20")));

  const where = search ? or(ilike(users.email, `%${search}%`), ilike(users.name, `%${search}%`)) : undefined;
  const [countRow] = await db.select({ n: sql<number>`count(*)` }).from(users).where(where);
  const total = countRow?.n ?? 0;

  const list = await db.query.users.findMany({
    where,
    orderBy: (u, { desc }) => [desc(u.createdAt)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  // One batched query for org chips instead of an N+1 per row.
  const userIds = list.map((u) => u.id);
  const memberships =
    userIds.length > 0
      ? await db.query.orgMembers.findMany({ where: inArray(orgMembers.userId, userIds), with: { org: true } })
      : [];
  const orgsByUser = new Map<string, { orgId: string; name: string; kind: "main" | "team"; role: string }[]>();
  for (const m of memberships) {
    if (!m.org) continue;
    const list = orgsByUser.get(m.userId) ?? [];
    list.push({ orgId: m.orgId, name: m.org.name, kind: m.org.kind, role: m.role });
    orgsByUser.set(m.userId, list);
  }

  return c.json({
    users: list.map((u) => {
      const memberOf = orgsByUser.get(u.id) ?? [];
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        isSuperadmin: u.isSuperadmin,
        status: u.status,
        createdAt: u.createdAt,
        orgs: memberOf.slice(0, 5),
        orgCount: memberOf.length,
      };
    }),
    total: Number(total),
    page,
    pageSize,
  });
});
