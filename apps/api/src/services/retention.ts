import { and, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { artifacts, artifactVersions, shares } from "../db/schema.js";
import { recordAudit } from "./audit.js";

export interface PurgeResult {
  purged: number;
}

/**
 * The repo's first background job. Hard-deletes the content (`artifact_versions` rows) of every
 * artifact whose `expires_at` has passed, in batches, leaving the `artifacts` row itself as an
 * audit/analytics tombstone (`artifact_views`, `artifact_view_daily` and `audit_log` all reference
 * `artifact_id` and must keep resolving). Idempotent via the `purged_at IS NULL` guard: running
 * this twice in a row purges nothing the second time, so it's safe to call from both the interval
 * in `index.ts` and an admin-triggered route, and to call directly from tests without waiting.
 */
export async function purgeExpiredArtifacts(
  db: Database,
  opts: { now?: Date; batchSize?: number; maxBatches?: number } = {},
): Promise<PurgeResult> {
  const now = opts.now ?? new Date();
  const batchSize = opts.batchSize ?? 200;
  const maxBatches = opts.maxBatches ?? 20;

  let purged = 0;

  for (let batch = 0; batch < maxBatches; batch++) {
    const due = await db
      .select({ id: artifacts.id, orgId: artifacts.orgId, expiresAt: artifacts.expiresAt })
      .from(artifacts)
      .where(and(sql`${artifacts.expiresAt} is not null`, lte(artifacts.expiresAt, now), isNull(artifacts.purgedAt)))
      .limit(batchSize);

    if (due.length === 0) break;
    const ids = due.map((row) => row.id);

    await db.transaction(async (tx) => {
      // A pinned share holds a hard (ON DELETE NO ACTION) FK to artifact_versions — deleting the
      // versions first would raise a foreign-key violation. Unpin and revoke before touching
      // content; the revoke also stops the public link from working the moment content is gone,
      // rather than racing the lazy-expiry check in routes/public.ts.
      await tx
        .update(shares)
        .set({ pinnedVersionId: null, revokedAt: sql`coalesce(${shares.revokedAt}, ${now})` })
        .where(inArray(shares.artifactId, ids));

      await tx.delete(artifactVersions).where(inArray(artifactVersions.artifactId, ids));

      await tx
        .update(artifacts)
        .set({ currentVersionId: null, sizeBytes: 0, deletedAt: sql`coalesce(${artifacts.deletedAt}, ${now})`, purgedAt: now })
        .where(inArray(artifacts.id, ids));

      for (const row of due) {
        await recordAudit(tx, {
          orgId: row.orgId,
          identity: { kind: "system" },
          action: "artifact.expire",
          targetType: "artifact",
          targetId: row.id,
          meta: { expiresAt: row.expiresAt },
        });
      }
    });

    purged += due.length;
    if (due.length < batchSize) break;
  }

  return { purged };
}

/**
 * Starts the sweeper on an interval. Only ever called from `index.ts` — `app.ts` stays free of
 * side effects so it can be constructed repeatedly in tests without spinning up background work.
 * Returns a stop function; errors are logged, never thrown, so one bad tick doesn't crash the
 * process or block the next one (an in-flight guard skips overlapping ticks).
 */
export function startRetentionSweeper(db: Database, intervalMs: number): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    purgeExpiredArtifacts(db)
      .catch((err) => console.error("[retention] purge failed:", err))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
