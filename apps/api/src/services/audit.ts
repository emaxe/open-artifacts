import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, lte, lt, or, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { auditLog, orgs, users } from "../db/schema.js";
import type { Identity } from "../types.js";
import { keyIdOf } from "./identity.js";

export interface RecordAuditInput {
  orgId?: string;
  identity: Identity | { kind: "system" };
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}

/** Written synchronously, in the same transaction as the mutation it describes — an audit log that lags is a lie. */
export async function recordAudit(db: Database, input: RecordAuditInput) {
  const actorType = input.identity.kind;
  const actorId =
    input.identity.kind === "user" || input.identity.kind === "user_key"
      ? input.identity.userId
      : input.identity.kind === "agent"
        ? input.identity.agentId
        : null;
  const keyId = input.identity.kind === "system" ? null : keyIdOf(input.identity);

  await db.insert(auditLog).values({
    orgId: input.orgId,
    actorType,
    actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    meta: keyId ? { ...(input.meta ?? {}), keyId } : (input.meta ?? null),
    ip: input.ip,
  });
}

export interface AuditActorRef {
  id: string;
  name: string;
  email: string;
}

export interface AuditEntryView {
  id: string;
  orgId: string | null;
  orgName: string | null;
  actorType: string;
  actorId: string | null;
  actor: AuditActorRef | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: unknown;
  at: Date;
}

export interface ListAuditLogOpts {
  orgId?: string;
  actorId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  /** Opaque cursor from a previous page's `nextCursor` — "<at ISO>|<id>". */
  cursor?: string;
}

function decodeCursor(cursor: string): { at: Date; id: string } | null {
  const sepIndex = cursor.lastIndexOf("|");
  if (sepIndex === -1) return null;
  const at = new Date(cursor.slice(0, sepIndex));
  const id = cursor.slice(sepIndex + 1);
  if (Number.isNaN(at.getTime()) || !id) return null;
  return { at, id };
}

function encodeCursor(at: Date, id: string): string {
  return `${at.toISOString()}|${id}`;
}

/**
 * Keyset-paginated (on `at DESC, id DESC`) rather than OFFSET-based — correct for an append-only
 * log where new rows keep landing at the head, and cheap with the existing `audit_log_at_idx`.
 * Actors and orgs are resolved in two batched `inArray` queries, not per-row.
 */
export async function listAuditLog(db: Database, opts: ListAuditLogOpts = {}): Promise<{ entries: AuditEntryView[]; nextCursor: string | null }> {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  const conditions = [
    opts.orgId ? eq(auditLog.orgId, opts.orgId) : undefined,
    opts.actorId ? eq(auditLog.actorId, opts.actorId) : undefined,
    opts.action ? eq(auditLog.action, opts.action) : undefined,
    opts.from ? gte(auditLog.at, opts.from) : undefined,
    opts.to ? lte(auditLog.at, opts.to) : undefined,
  ];

  if (opts.cursor) {
    const decoded = decodeCursor(opts.cursor);
    if (decoded) {
      // Strictly older than the cursor row: (at < cursor.at) OR (at = cursor.at AND id < cursor.id).
      conditions.push(or(lt(auditLog.at, decoded.at), and(eq(auditLog.at, decoded.at), lt(auditLog.id, decoded.id))));
    }
  }

  const where = and(...conditions.filter((c): c is NonNullable<typeof c> => !!c));

  const rows = await db.query.auditLog.findMany({
    where,
    orderBy: [desc(auditLog.at), desc(auditLog.id)],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const userActorIds = [...new Set(page.filter((r) => (r.actorType === "user" || r.actorType === "user_key") && r.actorId).map((r) => r.actorId!))];
  const orgIds = [...new Set(page.filter((r) => r.orgId).map((r) => r.orgId!))];

  const [actorRows, orgRows] = await Promise.all([
    userActorIds.length > 0 ? db.query.users.findMany({ where: inArray(users.id, userActorIds) }) : Promise.resolve([]),
    orgIds.length > 0 ? db.query.orgs.findMany({ where: inArray(orgs.id, orgIds) }) : Promise.resolve([]),
  ]);
  const actorById = new Map(actorRows.map((u) => [u.id, { id: u.id, name: u.name, email: u.email }]));
  const orgNameById = new Map(orgRows.map((o) => [o.id, o.name]));

  const entries: AuditEntryView[] = page.map((r) => ({
    id: r.id,
    orgId: r.orgId,
    orgName: r.orgId ? (orgNameById.get(r.orgId) ?? null) : null,
    actorType: r.actorType,
    actorId: r.actorId,
    actor: (r.actorType === "user" || r.actorType === "user_key") && r.actorId ? (actorById.get(r.actorId) ?? null) : null,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    meta: r.meta,
    at: r.at,
  }));

  const last = page.at(-1);
  const nextCursor = hasMore && last ? encodeCursor(last.at, last.id) : null;

  return { entries, nextCursor };
}

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
