import { and, asc, eq, sql, ilike, inArray, isNull, ne, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { OrgRole } from "@open-artifacts/shared";
import type { Database } from "../db/client.js";
import { artifacts, orgMembers, orgs, users } from "../db/schema.js";

export interface OrgMembershipRef {
  orgId: string;
  name: string;
  slug: string;
  kind: "main" | "team";
  role: OrgRole;
}

/** Every org a user belongs to right now, for personal-key scope resolution (see services/org-scope.ts). */
export async function listOrgMembershipsForUser(db: Database, userId: string): Promise<OrgMembershipRef[]> {
  return db
    .select({ orgId: orgs.id, name: orgs.name, slug: orgs.slug, kind: orgs.kind, role: orgMembers.role })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgMembers.orgId, orgs.id))
    .where(eq(orgMembers.userId, userId))
    .orderBy(asc(orgs.name));
}

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

export class UserNotFoundError extends Error {
  constructor() {
    super("User not found");
  }
}

export class CannotLeaveMainOrgError extends Error {
  constructor() {
    super("Cannot leave or delete your own main workspace");
  }
}

export function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "org"}-${nanoid(8)}`;
}

/**
 * Creates the auto-provisioned "main" workspace every user gets on registration, and makes
 * `userId` its owner. Must run inside the same transaction as the user insert (see registerUser
 * in services/users.ts) so a user never briefly exists without one.
 */
export async function createMainOrg(db: Database, userId: string, name: string) {
  const [org] = await db
    .insert(orgs)
    .values({ name, slug: slugify(name), kind: "main", createdBy: userId })
    .returning();
  await db.insert(orgMembers).values({ orgId: org!.id, userId, role: "owner" });
  return org!;
}

export async function listMemberOrgIds(db: Database, userId: string): Promise<string[]> {
  const rows = await db.query.orgMembers.findMany({ where: eq(orgMembers.userId, userId) });
  return rows.map((r) => r.orgId);
}

async function countOwners(db: Database, orgId: string): Promise<number> {
  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, "owner")));
  return Number(countRow?.n ?? 0);
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
    if ((await countOwners(db, orgId)) <= 1) throw new LastOwnerError();
  }

  await db.update(orgMembers).set({ role }).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
}

/**
 * Removes a member from an org, refusing to remove the last remaining owner, and refusing to
 * remove the creator of their own "main" workspace — that org has no ownership-transfer story,
 * so its creator can never leave or be removed from it (they can still leave/be removed from
 * every other org, including a "main" workspace someone else invited them into).
 */
export async function removeMember(db: Database, orgId: string, userId: string) {
  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  if (!membership) throw new NotAMemberError();

  const org = await db.query.orgs.findFirst({ where: eq(orgs.id, orgId) });
  if (org?.kind === "main" && org.createdBy === userId) throw new CannotLeaveMainOrgError();

  if (membership.role === "owner" && (await countOwners(db, orgId)) <= 1) {
    throw new LastOwnerError();
  }

  await db.delete(orgMembers).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
}

export interface OrgOwnerRef {
  id: string;
  name: string;
  email: string;
}

export interface OrgListItem {
  id: string;
  name: string;
  slug: string;
  kind: "main" | "team";
  role: string | null;
  memberCount: number;
  artifactCount: number;
  owner: OrgOwnerRef | null;
  createdAt: Date;
}

export interface PageOpts {
  search?: string;
  page: number;
  pageSize: number;
  /** Defaults to "all" when omitted. */
  kind?: "main" | "team" | "all";
}

/** Member/artifact counts for a batch of orgs in two grouped queries instead of one COUNT(*) per org. */
export async function countsByOrg(db: Database, orgIds: string[]): Promise<Map<string, { members: number; artifacts: number }>> {
  const counts = new Map<string, { members: number; artifacts: number }>();
  for (const id of orgIds) counts.set(id, { members: 0, artifacts: 0 });
  if (orgIds.length === 0) return counts;

  const memberRows = await db
    .select({ orgId: orgMembers.orgId, n: sql<number>`count(*)` })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(and(inArray(orgMembers.orgId, orgIds), ne(users.status, "deleted")))
    .groupBy(orgMembers.orgId);
  for (const row of memberRows) counts.set(row.orgId, { ...counts.get(row.orgId)!, members: Number(row.n) });

  const artifactRows = await db
    .select({ orgId: artifacts.orgId, n: sql<number>`count(*)` })
    .from(artifacts)
    .where(and(inArray(artifacts.orgId, orgIds), isNull(artifacts.deletedAt)))
    .groupBy(artifacts.orgId);
  for (const row of artifactRows) counts.set(row.orgId, { ...counts.get(row.orgId)!, artifacts: Number(row.n) });

  return counts;
}

/**
 * The canonical "owner" shown for each org: the earliest-added member still holding the `owner`
 * role. One DISTINCT ON query for the whole batch — a plain JOIN would multiply rows for orgs
 * with more than one owner, and `orgs.createdBy` alone can be NULL for pre-migration orgs.
 */
export async function ownersByOrg(db: Database, orgIds: string[]): Promise<Map<string, OrgOwnerRef>> {
  const map = new Map<string, OrgOwnerRef>();
  if (orgIds.length === 0) return map;

  const rows = await db
    .selectDistinctOn([orgMembers.orgId], {
      orgId: orgMembers.orgId,
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(and(inArray(orgMembers.orgId, orgIds), eq(orgMembers.role, "owner"), ne(users.status, "deleted")))
    .orderBy(orgMembers.orgId, asc(orgMembers.createdAt));
  for (const row of rows) map.set(row.orgId, { id: row.id, name: row.name, email: row.email });
  return map;
}

/** Matches name, slug, or the email of the org's owner (any of them). */
function buildOrgSearchCondition(search: string) {
  const pattern = `%${search}%`;
  return or(
    ilike(orgs.name, pattern),
    ilike(orgs.slug, pattern),
    sql`exists (
      select 1 from ${orgMembers} om
      inner join ${users} u on u.id = om.user_id
      where om.org_id = ${orgs.id} and om.role = 'owner' and u.email ilike ${pattern}
    )`,
  );
}

function buildOrgKindCondition(kind: PageOpts["kind"]) {
  return kind && kind !== "all" ? eq(orgs.kind, kind) : undefined;
}

async function assembleOrgList(
  db: Database,
  rows: { id: string; name: string; slug: string; kind: "main" | "team"; createdAt: Date }[],
  roleByOrgId: Map<string, string>,
): Promise<OrgListItem[]> {
  const orgIds = rows.map((r) => r.id);
  const [counts, owners] = await Promise.all([countsByOrg(db, orgIds), ownersByOrg(db, orgIds)]);
  return rows.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    kind: o.kind,
    role: roleByOrgId.get(o.id) ?? null,
    memberCount: counts.get(o.id)?.members ?? 0,
    artifactCount: counts.get(o.id)?.artifacts ?? 0,
    owner: owners.get(o.id) ?? null,
    createdAt: o.createdAt,
  }));
}

export async function listAllOrgs(db: Database, opts: PageOpts, currentUserId?: string): Promise<{ orgs: OrgListItem[]; total: number }> {
  const where = and(opts.search ? buildOrgSearchCondition(opts.search) : undefined, buildOrgKindCondition(opts.kind));
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

  return { orgs: await assembleOrgList(db, rows, roleByOrgId), total: Number(total) };
}

export async function listOrgsForUser(db: Database, userId: string, opts: PageOpts): Promise<{ orgs: OrgListItem[]; total: number }> {
  const memberships = await db.query.orgMembers.findMany({ where: eq(orgMembers.userId, userId) });
  const orgIds = memberships.map((m) => m.orgId);
  if (orgIds.length === 0) return { orgs: [], total: 0 };
  const roleByOrgId = new Map(memberships.map((m) => [m.orgId, m.role]));

  const where = and(
    inArray(orgs.id, orgIds),
    opts.search ? buildOrgSearchCondition(opts.search) : undefined,
    buildOrgKindCondition(opts.kind),
  );
  const [countRow] = await db.select({ n: sql<number>`count(*)` }).from(orgs).where(where);
  const total = countRow?.n ?? 0;
  const rows = await db.query.orgs.findMany({
    where,
    orderBy: (o, { desc }) => [desc(o.createdAt)],
    limit: opts.pageSize,
    offset: (opts.page - 1) * opts.pageSize,
  });
  return { orgs: await assembleOrgList(db, rows, roleByOrgId), total: Number(total) };
}

/** Adds an already-registered user directly to an org, bypassing the invite round-trip. Idempotent. */
export async function addMember(db: Database, orgId: string, userId: string, role: OrgRole): Promise<{ alreadyMember: boolean }> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new UserNotFoundError();

  const existing = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  if (existing) return { alreadyMember: true };

  await db.insert(orgMembers).values({ orgId, userId, role });
  return { alreadyMember: false };
}

export async function updateOrg(db: Database, orgId: string, patch: { name?: string; storageQuotaBytes?: number }) {
  const [updated] = await db.update(orgs).set(patch).where(eq(orgs.id, orgId)).returning();
  return updated ?? null;
}

export async function getOrgDetail(db: Database, orgId: string) {
  const org = await db.query.orgs.findFirst({ where: eq(orgs.id, orgId) });
  if (!org) return null;
  const [counts, owners] = await Promise.all([countsByOrg(db, [orgId]), ownersByOrg(db, [orgId])]);
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    kind: org.kind,
    storageQuotaBytes: org.storageQuotaBytes,
    createdAt: org.createdAt,
    memberCount: counts.get(orgId)?.members ?? 0,
    artifactCount: counts.get(orgId)?.artifacts ?? 0,
    owner: owners.get(orgId) ?? null,
  };
}
