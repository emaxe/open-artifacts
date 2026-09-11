import { Hono, type Context } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { orgRoleSchema } from "@open-artifacts/shared";
import { nanoid } from "nanoid";
import type { AppBindings } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { orgMembers, orgs, users, invites } from "../db/schema.js";
import { getOrgRole } from "../services/users.js";
import { recordAudit } from "../services/audit.js";
import { changeMemberRole, LastOwnerError, NotAMemberError, listAllOrgs, listOrgsForUser, getOrgDetail } from "../services/orgs.js";

export const orgRoutes = new Hono<AppBindings>();

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "org"}-${Math.random().toString(36).slice(2, 8)}`;
}

orgRoutes.get("/orgs", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const search = c.req.query("search") || undefined;
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? "20")));

  const db = c.get("db");
  const result = identity.isSuperadmin
    ? await listAllOrgs(db, { search, page, pageSize }, identity.userId)
    : await listOrgsForUser(db, identity.userId, { search, page, pageSize });

  return c.json({ orgs: result.orgs, total: result.total, page, pageSize });
});

orgRoutes.get("/orgs/:id", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const orgId = c.req.param("id");
  const db = c.get("db");
  
  const detail = await getOrgDetail(db, orgId);
  if (!detail) return c.json({ error: { code: "not_found" } }, 404);

  const myRole = await getOrgRole(db, orgId, identity.userId);
  if (!myRole && !identity.isSuperadmin) return c.json({ error: { code: "forbidden" } }, 403);

  return c.json({ ...detail, myRole });
});

orgRoutes.post("/orgs", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);
  const body = z.object({ name: z.string().min(1).max(200) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input" } }, 400);

  const db = c.get("db");
  const [org] = await db.insert(orgs).values({ name: body.data.name, slug: slugify(body.data.name) }).returning();
  await db.insert(orgMembers).values({ orgId: org!.id, userId: identity.userId, role: "owner" });
  await recordAudit(db, { orgId: org!.id, identity, action: "org.create", targetType: "org", targetId: org!.id });
  return c.json({ id: org!.id, name: org!.name, slug: org!.slug, role: "owner" }, 201);
});

async function requireOrgRole(c: Context<AppBindings>, orgId: string, allowed: string[]) {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return null;
  if (identity.isSuperadmin) return "owner";
  const role = await getOrgRole(c.get("db"), orgId, identity.userId);
  if (!role || !allowed.includes(role)) return null;
  return role;
}

orgRoutes.get("/orgs/:id/members", requireAuth, async (c) => {
  const orgId = c.req.param("id");
  const role = await requireOrgRole(c, orgId, ["owner", "admin", "member", "viewer"]);
  if (!role) return c.json({ error: { code: "forbidden" } }, 403);

  const db = c.get("db");
  const memberships = await db.query.orgMembers.findMany({ where: eq(orgMembers.orgId, orgId) });
  const members = await Promise.all(
    memberships.map(async (m) => {
      const user = await db.query.users.findFirst({ where: eq(users.id, m.userId) });
      return { userId: m.userId, email: user?.email, name: user?.name, role: m.role };
    }),
  );
  return c.json({ members });
});

orgRoutes.post("/orgs/:id/invites", requireAuth, async (c) => {
  const orgId = c.req.param("id");
  const role = await requireOrgRole(c, orgId, ["owner", "admin"]);
  if (!role) return c.json({ error: { code: "forbidden" } }, 403);

  const body = z
    .object({ email: z.string().email(), role: orgRoleSchema.default("member") })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input" } }, 400);

  const db = c.get("db");
  const token = nanoid(32);
  const [invite] = await db
    .insert(invites)
    .values({
      orgId,
      email: body.data.email,
      role: body.data.role,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning();
  await recordAudit(c.get("db"), { orgId, identity: c.get("identity")!, action: "org.invite", targetType: "invite", targetId: invite!.id });
  return c.json({ id: invite!.id, token: invite!.token, email: invite!.email, role: invite!.role }, 201);
});

orgRoutes.delete("/orgs/:id/members/:userId", requireAuth, async (c) => {
  const orgId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  const role = await requireOrgRole(c, orgId, ["owner", "admin"]);
  if (!role) return c.json({ error: { code: "forbidden" } }, 403);

  const db = c.get("db");
  await db.delete(orgMembers).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, targetUserId)));
  await recordAudit(db, { orgId, identity: c.get("identity")!, action: "org.remove_member", targetType: "user", targetId: targetUserId });
  return c.json({ ok: true });
});

const changeRoleSchema = z.object({ role: orgRoleSchema });

orgRoutes.patch("/orgs/:id/members/:userId", requireAuth, async (c) => {
  const orgId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  const role = await requireOrgRole(c, orgId, ["owner", "admin"]);
  if (!role) return c.json({ error: { code: "forbidden" } }, 403);

  const body = changeRoleSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const db = c.get("db");
  try {
    await changeMemberRole(db, orgId, targetUserId, body.data.role);
  } catch (err) {
    if (err instanceof LastOwnerError) return c.json({ error: { code: "last_owner", message: err.message } }, 409);
    if (err instanceof NotAMemberError) return c.json({ error: { code: "not_found", message: err.message } }, 404);
    throw err;
  }
  await recordAudit(db, { orgId, identity: c.get("identity")!, action: "org.change_role", targetType: "user", targetId: targetUserId, meta: { role: body.data.role } });
  return c.json({ ok: true });
});
