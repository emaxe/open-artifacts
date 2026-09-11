import { and, eq, sql, ilike, inArray } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { orgMembers, orgs } from "../db/schema.js";

export class LastOwnerError extends Error {
  constructor() {
    super("Cannot change role: this is the last owner of the organization");
  }
}

export class NotAMemberError extends Error {
  constructor() {
    super("User is not a member of this organization");
  }
}

export async function listMemberOrgIds(db: Database, userId: string): Promise<string[]> {
  const rows = await db.query.orgMembers.findMany({ where: eq(orgMembers.userId, userId) });
  return rows.map((r) => r.orgId);
}

export async function changeMemberRole(
  db: Database,
  orgId: string,
  userId: string,
  role: "owner" | "admin" | "member" | "viewer",
) {
  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  if (!membership) throw new NotAMemberError();

  if (membership.role === "owner" && role !== "owner") {
    const [countRow] = await db
      .select({ n: sql<number>`count(*)` })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, "owner")));
    const ownerCount = countRow?.n ?? 0;
    if (Number(ownerCount) <= 1) throw new LastOwnerError();
  }

  await db.update(orgMembers).set({ role }).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
}

export interface OrgListItem {
  id: string;
  name: string;
  slug: string;
  role: string | null;
  memberCount: number;
}

export interface PageOpts {
  search?: string;
  page: number;
  pageSize: number;
}

async function countMembers(db: Database, orgId: string): Promise<number> {
  const [countRow] = await db.select({ n: sql<number>`count(*)` }).from(orgMembers).where(eq(orgMembers.orgId, orgId));
  return Number(countRow?.n ?? 0);
}

export async function listAllOrgs(db: Database, opts: PageOpts, currentUserId?: string): Promise<{ orgs: OrgListItem[]; total: number }> {
  const where = opts.search ? ilike(orgs.name, `%${opts.search}%`) : undefined;
  const [countRow] = await db.select({ n: sql<number>`count(*)` }).from(orgs).where(where);
  const total = countRow?.n ?? 0;
  const rows = await db.query.orgs.findMany({
    where,
    orderBy: (o, { desc }) => [desc(o.createdAt)],
    limit: opts.pageSize,
    offset: (opts.page - 1) * opts.pageSize,
  });
  const orgIds = rows.map((r) => r.id);
  const memberships = currentUserId && orgIds.length > 0
    ? await db.query.orgMembers.findMany({
        where: and(eq(orgMembers.userId, currentUserId), inArray(orgMembers.orgId, orgIds)),
      })
    : [];
  const roleByOrgId = new Map(memberships.map((m) => [m.orgId, m.role]));

  const list = await Promise.all(
    rows.map(async (o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      role: roleByOrgId.get(o.id) ?? null,
      memberCount: await countMembers(db, o.id),
    })),
  );
  return { orgs: list, total: Number(total) };
}

export async function listOrgsForUser(db: Database, userId: string, opts: PageOpts): Promise<{ orgs: OrgListItem[]; total: number }> {
  const memberships = await db.query.orgMembers.findMany({ where: eq(orgMembers.userId, userId) });
  const orgIds = memberships.map((m) => m.orgId);
  if (orgIds.length === 0) return { orgs: [], total: 0 };
  const roleByOrgId = new Map(memberships.map((m) => [m.orgId, m.role]));

  const where = opts.search ? and(inArray(orgs.id, orgIds), ilike(orgs.name, `%${opts.search}%`)) : inArray(orgs.id, orgIds);
  const [countRow] = await db.select({ n: sql<number>`count(*)` }).from(orgs).where(where);
  const total = countRow?.n ?? 0;
  const rows = await db.query.orgs.findMany({
    where,
    orderBy: (o, { desc }) => [desc(o.createdAt)],
    limit: opts.pageSize,
    offset: (opts.page - 1) * opts.pageSize,
  });
  const list = await Promise.all(
    rows.map(async (o) => ({ id: o.id, name: o.name, slug: o.slug, role: roleByOrgId.get(o.id) ?? null, memberCount: await countMembers(db, o.id) })),
  );
  return { orgs: list, total: Number(total) };
}

export async function getOrgDetail(db: Database, orgId: string) {
  const org = await db.query.orgs.findFirst({ where: eq(orgs.id, orgId) });
  if (!org) return null;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    storageQuotaBytes: org.storageQuotaBytes,
    createdAt: org.createdAt,
    memberCount: await countMembers(db, org.id),
  };
}
