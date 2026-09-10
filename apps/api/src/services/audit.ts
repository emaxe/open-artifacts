import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { auditLog } from "../db/schema.js";
import type { Identity } from "../types.js";

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
    input.identity.kind === "user"
      ? input.identity.userId
      : input.identity.kind === "agent"
        ? input.identity.agentId
        : null;

  await db.insert(auditLog).values({
    orgId: input.orgId,
    actorType,
    actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    meta: input.meta ?? null,
    ip: input.ip,
  });
}

export async function listAuditLog(db: Database, opts: { orgId?: string; limit?: number } = {}) {
  return db.query.auditLog.findMany({
    where: opts.orgId ? eq(auditLog.orgId, opts.orgId) : undefined,
    orderBy: [desc(auditLog.at)],
    limit: opts.limit ?? 100,
  });
}

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
