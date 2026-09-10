import { and, eq, gte, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { apiUsageHourly, artifacts, artifactViews } from "../db/schema.js";

export interface RecordViewInput {
  artifactId: string;
  shareId?: string;
  ipHash?: string;
  uaHash?: string;
  referer?: string;
}

export async function recordArtifactView(db: Database, input: RecordViewInput) {
  await db.insert(artifactViews).values(input);
}

export async function getArtifactViewsByDay(db: Database, artifactId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db
    .select({
      day: sql<string>`to_char(${artifactViews.viewedAt}, 'YYYY-MM-DD')`,
      views: sql<number>`count(*)`,
      uniques: sql<number>`count(distinct ${artifactViews.ipHash})`,
    })
    .from(artifactViews)
    .where(and(eq(artifactViews.artifactId, artifactId), gte(artifactViews.viewedAt, since)))
    .groupBy(sql`to_char(${artifactViews.viewedAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${artifactViews.viewedAt}, 'YYYY-MM-DD')`);
}

export async function getTopArtifacts(db: Database, orgId: string, limit = 10) {
  return db
    .select({
      artifactId: artifactViews.artifactId,
      title: artifacts.title,
      views: sql<number>`count(*)`,
    })
    .from(artifactViews)
    .innerJoin(artifacts, eq(artifacts.id, artifactViews.artifactId))
    .where(eq(artifacts.orgId, orgId))
    .groupBy(artifactViews.artifactId, artifacts.title)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
}

export interface RecordUsageInput {
  orgId: string;
  agentId: string;
  keyId: string;
  endpoint: string;
  method: string;
  statusClass: "2xx" | "3xx" | "4xx" | "5xx";
  durationMs: number;
}

/**
 * Upserts one hourly usage bucket per request. A per-request write is simpler and crash-safe
 * compared to in-memory batching; at self-hosted scale (single Postgres, one app instance)
 * the extra upsert is not a meaningful cost. Revisit with in-memory batching if usage volume
 * ever makes this a bottleneck.
 */
export async function recordApiUsage(db: Database, input: RecordUsageInput) {
  const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  await db
    .insert(apiUsageHourly)
    .values({
      orgId: input.orgId,
      agentId: input.agentId,
      keyId: input.keyId,
      endpoint: input.endpoint,
      method: input.method,
      statusClass: input.statusClass,
      hour,
      count: 1,
      totalDurationMs: input.durationMs,
    })
    .onConflictDoUpdate({
      target: [
        apiUsageHourly.orgId,
        apiUsageHourly.endpoint,
        apiUsageHourly.method,
        apiUsageHourly.statusClass,
        apiUsageHourly.hour,
        apiUsageHourly.keyId,
      ],
      set: {
        count: sql`${apiUsageHourly.count} + 1`,
        totalDurationMs: sql`${apiUsageHourly.totalDurationMs} + ${input.durationMs}`,
      },
    });
}

export async function getUsageByHour(db: Database, orgId: string, hours = 24) {
  const rows = await db.query.apiUsageHourly.findMany({ where: eq(apiUsageHourly.orgId, orgId) });
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString().slice(0, 13);
  return rows.filter((r) => r.hour >= cutoff);
}
