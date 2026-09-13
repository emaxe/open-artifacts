import { randomUUID, createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Database, DbOrTx } from "../db/client.js";
import { artifacts, artifactFiles } from "../db/schema.js";
import type { Identity } from "../types.js";
import { actorRef } from "./identity.js";
import { buildStorageKey, type Storage } from "./storage.js";
import { assertWithinQuota, type EffectiveQuota } from "./quota.js";

export class StorageDisabledError extends Error {
  constructor() {
    super("Object storage is not configured for this instance (S3_BUCKET unset)");
  }
}

export interface AttachFileInput {
  artifactId: string;
  orgId: string;
  name: string;
  contentType: string;
  body: Buffer;
  identity: Identity;
  quota: EffectiveQuota;
}

/**
 * Order matters and is deliberate: check the quota (read-only), THEN write to S3, THEN record the
 * row. If the DB insert below fails after a successful `putObject`, the object is orphaned — with
 * no matching `artifact_files` row it's invisible to every read path, and `reconcileStorage()`
 * (services/storage-gc.ts) is the safety net that eventually queues it for deletion. The reverse
 * order (insert first, then upload) would instead risk a LIVE artifact linking to a file that was
 * never actually written, which is worse: a visibly broken link rather than an invisible orphan.
 */
export async function attachFile(db: Database, storage: Storage, input: AttachFileInput) {
  if (!storage.enabled) throw new StorageDisabledError();

  await assertWithinQuota(db, {
    orgId: input.orgId,
    artifactId: input.artifactId,
    quota: input.quota,
    additionalBytes: input.body.length,
  });

  const id = randomUUID();
  const storageKey = buildStorageKey(input.orgId, input.artifactId, id);
  await storage.putObject(storageKey, input.body, input.contentType);

  const owner = actorRef(input.identity);
  const checksum = createHash("sha256").update(input.body).digest("hex");
  const token = nanoid(32);

  const [row] = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(artifactFiles)
      .values({
        id,
        artifactId: input.artifactId,
        token,
        storageKey,
        name: input.name,
        contentType: input.contentType,
        sizeBytes: input.body.length,
        checksum,
        createdByType: owner.ownerType,
        createdById: owner.ownerId,
      })
      .returning();
    await tx
      .update(artifacts)
      .set({ filesBytes: sql`${artifacts.filesBytes} + ${input.body.length}`, updatedAt: new Date() })
      .where(eq(artifacts.id, input.artifactId));
    return inserted;
  });
  return row!;
}

export async function listFilesForArtifact(db: Database, artifactId: string) {
  return db.query.artifactFiles.findMany({
    where: eq(artifactFiles.artifactId, artifactId),
    orderBy: (f, { desc }) => [desc(f.createdAt)],
  });
}

export async function getFileByToken(db: Database, token: string) {
  return db.query.artifactFiles.findFirst({ where: eq(artifactFiles.token, token) });
}

export async function getFileById(db: Database, artifactId: string, fileId: string) {
  return db.query.artifactFiles.findFirst({ where: and(eq(artifactFiles.id, fileId), eq(artifactFiles.artifactId, artifactId)) });
}

/**
 * Deletes one file's row (which fires `artifact_files_gc_trigger`, queuing its object for
 * removal — see the migration) and debits `artifacts.filesBytes`. Returns `null` if the file
 * doesn't belong to this artifact, so the route can 404 without a separate existence check.
 */
export async function deleteFile(db: Database, artifactId: string, fileId: string) {
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(artifactFiles)
      .where(and(eq(artifactFiles.id, fileId), eq(artifactFiles.artifactId, artifactId)))
      .returning();
    if (!deleted) return null;
    await tx
      .update(artifacts)
      .set({ filesBytes: sql`greatest(${artifacts.filesBytes} - ${deleted.sizeBytes}, 0)`, updatedAt: new Date() })
      .where(eq(artifacts.id, artifactId));
    return deleted;
  });
}

/** Deletes every file row for an artifact — used by soft-delete and the retention sweeper. Each deleted row fires the GC trigger. */
export async function deleteAllFilesForArtifact(db: DbOrTx, artifactId: string) {
  await db.delete(artifactFiles).where(eq(artifactFiles.artifactId, artifactId));
}
