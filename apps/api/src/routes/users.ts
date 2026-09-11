import { Hono } from "hono";
import { ilike, sql } from "drizzle-orm";
import type { AppBindings } from "../types.js";
import { requireAuth, requireSuperadmin } from "../middleware/auth.js";
import { users } from "../db/schema.js";

export const userRoutes = new Hono<AppBindings>();

userRoutes.get("/users", requireAuth, requireSuperadmin, async (c) => {
  const db = c.get("db");
  const search = c.req.query("search") || undefined;
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? "20")));

  const where = search ? ilike(users.email, `%${search}%`) : undefined;
  const [countRow] = await db.select({ n: sql<number>`count(*)` }).from(users).where(where);
  const total = countRow?.n ?? 0;

  const list = await db.query.users.findMany({
    where,
    orderBy: (u, { desc }) => [desc(u.createdAt)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return c.json({
    users: list.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isSuperadmin: u.isSuperadmin,
      status: u.status,
      createdAt: u.createdAt,
    })),
    total: Number(total),
    page,
    pageSize,
  });
});
