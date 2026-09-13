import { inArray, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { artifactFiles, storageGcQueue } from "../db/schema.js";
import type { Storage } from "./storage.js";

export interface DrainResult {
  deleted: number;
  failed: number;
}

/**
 * Drains queued object deletions, batched like `purgeExpiredArtifacts` (services/retention.ts).
 * Rows are enqueued exclusively by `artifact_files_gc_trigger` (see the migration) — this is the
 * only place application code ever calls `storage.deleteObjects`, so every deletion path (an
 * explicit file delete, an artifact delete, the retention sweeper, or an org's own raw-SQL
 * cascade) converges here regardless of which one produced the row.
 */
export async function drainStorageGcQueue(db: Database, storage: Storage, opts: { batchSize?: number; maxBatches?: number } = {}): Promise<DrainResult> {
  if (!storage.enabled) return { deleted: 0, failed: 0 };
  const batchSize = opts.batchSize ?? 500;
  const maxBatches = opts.maxBatches ?? 20;

  let deleted = 0;
  let failed = 0;

  for (let batch = 0; batch < maxBatches; batch++) {
    const rows = await db.select({ storageKey: storageGcQueue.storageKey }).from(storageGcQueue).limit(batchSize);
    if (rows.length === 0) break;
    const keys = rows.map((r) => r.storageKey);

    try {
      await storage.deleteObjects(keys);
      await db.delete(storageGcQueue).where(inArray(storageGcQueue.storageKey, keys));
      deleted += keys.length;
    } catch (err) {
      // Leave the rows queued and try again next sweep; bump attempts/lastError for visibility
      // rather than losing track of what still needs deleting.
      console.error("[storage-gc] batch delete failed:", err);
      await db
        .update(storageGcQueue)
        .set({ attempts: sql`${storageGcQueue.attempts} + 1`, lastError: err instanceof Error ? err.message : String(err) })
        .where(inArray(storageGcQueue.storageKey, keys));
      failed += keys.length;
      break; // avoid hammering a storage backend that's currently down
    }

    if (rows.length < batchSize) break;
  }

  return { deleted, failed };
}

/**
 * Starts the storage GC sweeper on an interval, same shape as `startRetentionSweeper`. Only ever
 * called from `index.ts`, never `app.ts` (which stays side-effect-free for tests).
 */
export function startStorageGcSweeper(db: Database, storage: Storage, intervalMs: number): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    drainStorageGcQueue(db, storage)
      .catch((err) => console.error("[storage-gc] drain failed:", err))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

export interface ReconcileResult {
  orphans: number;
}

/**
 * Safety net for "a file with no artifact must not exist": lists every object actually in the
 * bucket and queues for deletion any key with no matching `artifact_files` row — the state that
 * should be unreachable given the FK + GC trigger, but that a manual DB operation, a crash between
 * `putObject` and the row insert (see `attachFile`), or an out-of-band bucket write could still
 * produce. Triggered by an admin action, not run on a timer.
 */
export async function reconcileStorage(db: Database, storage: Storage): Promise<ReconcileResult> {
  if (!storage.enabled) return { orphans: 0 };

  const [allKeys, knownRows] = await Promise.all([
    storage.listAllKeys("orgs/"),
    db.select({ storageKey: artifactFiles.storageKey }).from(artifactFiles),
  ]);
  const known = new Set(knownRows.map((r) => r.storageKey));
  const orphanKeys = allKeys.filter((key) => !known.has(key));
  if (orphanKeys.length === 0) return { orphans: 0 };

  for (const storageKey of orphanKeys) {
    await db.insert(storageGcQueue).values({ storageKey, sizeBytes: 0 }).onConflictDoNothing();
  }
  return { orphans: orphanKeys.length };
}
