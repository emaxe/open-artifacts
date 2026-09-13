import { and, eq, inArray } from "drizzle-orm";
import {
  computeContentHash,
  resolveOrgArtifactAccess,
  parseLifetimeMinutes,
  lifetimeExceedsLimit,
  expiresAtFromMinutes,
  type ArtifactAccessResult,
  type OwnerType,
} from "@open-artifacts/shared";
import type { Database } from "../db/client.js";
import { artifacts, artifactVersions } from "../db/schema.js";
import type { Identity } from "../types.js";
import { getOrgRole } from "./users.js";
import { actorRef } from "./identity.js";
import { liveArtifactWhere } from "./artifact-liveness.js";
import { assertWithinQuota, getOrgUsageBytes, type EffectiveQuota } from "./quota.js";
import { deleteAllFilesForArtifact } from "./artifact-files.js";

export { QuotaExceededError } from "./quota.js";

export class VersionConflictError extends Error {
  constructor() {
    super("Artifact was modified by someone else since you last read it");
  }
}

export class ArtifactTooLargeError extends Error {
  constructor(public readonly maxBytes: number) {
    super(`Artifact content exceeds the maximum allowed size (${maxBytes} bytes)`);
  }
}

export class LifetimeExceedsMaxError extends Error {
  constructor(public readonly maxMinutes: number | null) {
    super(`Requested artifact lifetime exceeds the maximum allowed (${maxMinutes} minutes)`);
  }
}

/**
 * Resolves a caller-supplied `lifetime` (wire value: string duration, number of minutes, `null`
 * for "never", or `undefined` to use the ceiling) into an absolute `expiresAt`, validated against
 * `maxLifetimeMinutes` (`null` = unlimited). Throws `LifetimeExceedsMaxError` rather than
 * silently clamping — the caller should learn about the retention policy, not get a shorter
 * lifetime than requested without being told.
 */
function resolveArtifactExpiry(
  lifetime: string | number | null | undefined,
  maxLifetimeMinutes: number | null,
  from: Date,
): Date | null {
  const requestedMinutes = lifetime === undefined ? maxLifetimeMinutes : parseLifetimeMinutes(lifetime);
  if (lifetimeExceedsLimit(requestedMinutes, maxLifetimeMinutes)) {
    throw new LifetimeExceedsMaxError(maxLifetimeMinutes);
  }
  return expiresAtFromMinutes(requestedMinutes, from);
}

// Re-exported for call sites that already imported liveArtifactWhere from here before it moved
// into its own module (to break a circular import with services/quota.ts).
export { liveArtifactWhere } from "./artifact-liveness.js";

function ownerFromIdentity(identity: Identity): { ownerType: OwnerType; ownerId: string } {
  return actorRef(identity);
}

export interface CreateArtifactInput {
  orgId: string;
  identity: Identity;
  title: string;
  description?: string;
  kind: "html" | "markdown" | "mermaid" | "svg";
  content: string;
  visibility: "private" | "org";
  /** Caller's choice: a duration string, a number of minutes, `null` for "never", or omitted to use `maxLifetimeMinutes`. */
  lifetime?: string | number | null;
  /**
   * The effective ceiling for this org (`null` = unlimited), from `resolveLifetimeLimitForRequest`.
   * Required on purpose — the compiler forces every creation surface to resolve the policy rather
   * than silently skipping it.
   */
  maxLifetimeMinutes: number | null;
  /**
   * The effective maximum size (bytes) of the artifact's own source text, from instance settings
   * (`InstanceSettings.maxArtifactSizeBytes`). Required for the same reason as `maxLifetimeMinutes`
   * above — this used to be a hardcoded module constant that the admin-editable setting silently
   * never fed into; making it a required parameter is the fix, not just a rename.
   */
  maxArtifactSizeBytes: number;
  /** The effective org/artifact byte quotas (source + files), from `resolveQuotaForRequest`. */
  quota: EffectiveQuota;
}

export async function createArtifact(db: Database, input: CreateArtifactInput) {
  const sizeBytes = Buffer.byteLength(input.content, "utf8");
  if (sizeBytes > input.maxArtifactSizeBytes) throw new ArtifactTooLargeError(input.maxArtifactSizeBytes);
  await assertWithinQuota(db, { orgId: input.orgId, quota: input.quota, additionalBytes: sizeBytes });

  const owner = ownerFromIdentity(input.identity);
  const contentHash = computeContentHash(input.content);
  const now = new Date();
  // Derived from the same `now` used for createdAt below, so a later policy-lowering recompute
  // (which reads back created_at from the row) agrees with the deadline set here.
  const expiresAt = resolveArtifactExpiry(input.lifetime, input.maxLifetimeMinutes, now);

  return db.transaction(async (tx) => {
    const [artifact] = await tx
      .insert(artifacts)
      .values({
        orgId: input.orgId,
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        title: input.title,
        description: input.description,
        kind: input.kind,
        visibility: input.visibility,
        sizeBytes,
        createdAt: now,
        updatedAt: now,
        expiresAt,
      })
      .returning();

    const [version] = await tx
      .insert(artifactVersions)
      .values({
        artifactId: artifact!.id,
        versionNo: 1,
        content: input.content,
        contentHash,
        sizeBytes,
        createdByType: owner.ownerType,
        createdById: owner.ownerId,
      })
      .returning();

    const [updated] = await tx
      .update(artifacts)
      .set({ currentVersionId: version!.id })
      .where(eq(artifacts.id, artifact!.id))
      .returning();

    return { artifact: updated!, version: version! };
  });
}

export async function getArtifact(db: Database, artifactId: string) {
  return db.query.artifacts.findFirst({ where: and(eq(artifacts.id, artifactId), liveArtifactWhere()) });
}

export type ArtifactLiveness = "live" | "expired" | "deleted" | "missing";

/**
 * Like `getArtifact`, but ignores the liveness filter so a public share/embed viewer can tell
 * "this link is gone" (410) apart from "this link never existed" (404) instead of both 404-ing.
 */
export async function getArtifactWithLiveness(
  db: Database,
  artifactId: string,
  now: Date = new Date(),
): Promise<{ artifact: typeof artifacts.$inferSelect | null; liveness: ArtifactLiveness }> {
  const artifact = await db.query.artifacts.findFirst({ where: eq(artifacts.id, artifactId) });
  if (!artifact) return { artifact: null, liveness: "missing" };
  if (artifact.deletedAt !== null) return { artifact, liveness: "deleted" };
  if (artifact.expiresAt !== null && artifact.expiresAt.getTime() <= now.getTime()) return { artifact, liveness: "expired" };
  return { artifact, liveness: "live" };
}

export async function getCurrentVersion(db: Database, artifact: typeof artifacts.$inferSelect) {
  if (!artifact.currentVersionId) return null;
  return db.query.artifactVersions.findFirst({ where: eq(artifactVersions.id, artifact.currentVersionId) });
}

export async function getVersionByNumber(db: Database, artifactId: string, versionNo: number) {
  return db.query.artifactVersions.findFirst({
    where: and(eq(artifactVersions.artifactId, artifactId), eq(artifactVersions.versionNo, versionNo)),
  });
}

export async function listVersions(db: Database, artifactId: string) {
  return db.query.artifactVersions.findMany({
    where: eq(artifactVersions.artifactId, artifactId),
    orderBy: (v, { desc }) => [desc(v.versionNo)],
  });
}

/**
 * Like `listVersions`, but projects out `content` and `contentHash` — a public-viewer panel needs
 * only the metadata to render a version picker, and `listVersions`'s full `findMany` would pull
 * every version's full content into memory (an artifact with 50 versions at the 5 MiB cap is
 * 250 MiB per page view). `limit` caps how many of the most recent versions come back; the caller
 * decides whether to say "and N more" when the true count exceeds it.
 */
export async function listVersionSummaries(db: Database, artifactId: string, limit?: number) {
  return db.query.artifactVersions.findMany({
    where: eq(artifactVersions.artifactId, artifactId),
    orderBy: (v, { desc }) => [desc(v.versionNo)],
    limit,
    columns: {
      id: true,
      versionNo: true,
      sizeBytes: true,
      message: true,
      createdAt: true,
      createdByType: true,
      createdById: true,
    },
  });
}

export async function listArtifactsForOrg(db: Database, orgId: string) {
  return db.query.artifacts.findMany({
    where: and(eq(artifacts.orgId, orgId), liveArtifactWhere()),
    orderBy: (a, { desc }) => [desc(a.updatedAt)],
  });
}

export async function listArtifactsForOrgs(db: Database, orgIds: string[]) {
  if (orgIds.length === 0) return [];
  return db.query.artifacts.findMany({
    where: and(inArray(artifacts.orgId, orgIds), liveArtifactWhere()),
    orderBy: (a, { desc }) => [desc(a.updatedAt)],
  });
}

export async function listAllArtifacts(db: Database) {
  return db.query.artifacts.findMany({
    where: liveArtifactWhere(),
    orderBy: (a, { desc }) => [desc(a.updatedAt)],
  });
}

export interface UpdateArtifactInput {
  title?: string;
  description?: string;
  visibility?: "private" | "org";
  identity: Identity;
  /** Optimistic-locking guard: if provided, must match the artifact's current content hash. */
  ifMatchContentHash?: string;
  /**
   * Present only when the caller is changing the lifetime. Bundled with the ceiling so the two
   * can't travel apart; `restoreVersion` below simply omits this and leaves the lifetime alone.
   */
  lifetime?: { requested: string | number | null; maxMinutes: number | null };
  /**
   * Present only when the caller is changing content. Bundles the new text with the size/quota
   * ceilings the same way `lifetime` bundles its own ceiling — a content update can't accidentally
   * skip evaluating them, the mistake the old bare `MAX_ARTIFACT_SIZE_BYTES` constant made once.
   */
  content?: { text: string; message?: string; maxArtifactSizeBytes: number; quota: EffectiveQuota };
}

export async function updateArtifact(db: Database, artifactId: string, input: UpdateArtifactInput) {
  return db.transaction(async (tx) => {
    const artifact = await tx.query.artifacts.findFirst({
      where: and(eq(artifacts.id, artifactId), liveArtifactWhere()),
    });
    if (!artifact) throw new Error("Artifact not found");

    if (input.ifMatchContentHash) {
      const current = artifact.currentVersionId
        ? await tx.query.artifactVersions.findFirst({ where: eq(artifactVersions.id, artifact.currentVersionId) })
        : null;
      if (!current || current.contentHash !== input.ifMatchContentHash) {
        throw new VersionConflictError();
      }
    }

    const patch: Partial<typeof artifacts.$inferInsert> = { updatedAt: new Date() };
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.visibility !== undefined) patch.visibility = input.visibility;
    if (input.lifetime !== undefined) {
      // Recomputed from the artifact's ORIGINAL created_at, not "now" — the same rule the policy
      // recompute uses, so extending then having the instance lower its max can't smuggle in
      // extra lifetime relative to a fresh artifact created under the same policy.
      patch.expiresAt = resolveArtifactExpiry(input.lifetime.requested, input.lifetime.maxMinutes, artifact.createdAt);
    }

    let newVersion: typeof artifactVersions.$inferSelect | undefined;
    if (input.content !== undefined) {
      const { text, message, maxArtifactSizeBytes, quota } = input.content;
      const sizeBytes = Buffer.byteLength(text, "utf8");
      if (sizeBytes > maxArtifactSizeBytes) throw new ArtifactTooLargeError(maxArtifactSizeBytes);

      // Exclude THIS artifact's own current source/files from both totals before adding the new
      // source size back in, so growing one artifact is never double-counted against itself.
      const orgTotal = await getOrgUsageBytes(tx, artifact.orgId);
      const orgUsedBytesExcluding = orgTotal - artifact.sizeBytes;
      const artifactUsedBytesExcluding = Number(artifact.filesBytes);
      await assertWithinQuota(tx, {
        orgId: artifact.orgId,
        artifactId,
        quota,
        additionalBytes: sizeBytes,
        orgUsedBytesExcluding,
        artifactUsedBytesExcluding,
      });

      const versions = await tx.query.artifactVersions.findMany({
        where: eq(artifactVersions.artifactId, artifactId),
        orderBy: (v, { desc }) => [desc(v.versionNo)],
        limit: 1,
      });
      const nextVersionNo = (versions[0]?.versionNo ?? 0) + 1;
      const owner = ownerFromIdentity(input.identity);

      [newVersion] = await tx
        .insert(artifactVersions)
        .values({
          artifactId,
          versionNo: nextVersionNo,
          content: text,
          contentHash: computeContentHash(text),
          sizeBytes,
          createdByType: owner.ownerType,
          createdById: owner.ownerId,
          message,
        })
        .returning();

      patch.currentVersionId = newVersion!.id;
      patch.sizeBytes = sizeBytes;
    }

    const [updated] = await tx.update(artifacts).set(patch).where(eq(artifacts.id, artifactId)).returning();
    return { artifact: updated!, version: newVersion };
  });
}

export async function restoreVersion(
  db: Database,
  artifactId: string,
  versionNo: number,
  identity: Identity,
  ceilings: { maxArtifactSizeBytes: number; quota: EffectiveQuota },
) {
  const target = await getVersionByNumber(db, artifactId, versionNo);
  if (!target) throw new Error("Version not found");
  return updateArtifact(db, artifactId, {
    identity,
    content: { text: target.content, message: `Restored from version ${versionNo}`, ...ceilings },
  });
}

/**
 * Marks an artifact deleted and deletes its `artifact_files` rows in the same transaction — the
 * `artifact_files_gc_trigger` (see the migration) then enqueues each one's object for removal.
 * There's no "undelete" path in this API, so this is the point where "files disappear with their
 * artifact" actually happens for a user/agent-initiated delete (the retention sweeper is the other one).
 */
export async function softDeleteArtifact(db: Database, artifactId: string) {
  await db.transaction(async (tx) => {
    await deleteAllFilesForArtifact(tx, artifactId);
    await tx.update(artifacts).set({ deletedAt: new Date(), filesBytes: 0 }).where(eq(artifacts.id, artifactId));
  });
}

/** Resolves read/write/delete access for an authenticated (non-share) request. */
export async function resolveAccessForIdentity(
  db: Database,
  identity: Identity,
  artifact: typeof artifacts.$inferSelect,
): Promise<ArtifactAccessResult> {
  if (identity.kind === "user") {
    if (identity.isSuperadmin) return { read: true, write: true, delete: true };
    const role = await getOrgRole(db, artifact.orgId, identity.userId);
    return resolveOrgArtifactAccess(
      { actorType: "user", actorId: identity.userId, role },
      { ownerType: artifact.ownerType, ownerId: artifact.ownerId, visibility: artifact.visibility },
    );
  }

  if (identity.kind === "user_key") {
    // No superadmin bypass here, unlike the cookie-session branch above: a personal key must
    // never exceed what the holder's actual org role grants, even for a superadmin's own key.
    const role = await getOrgRole(db, artifact.orgId, identity.userId);
    return resolveOrgArtifactAccess(
      { actorType: "user", actorId: identity.userId, role },
      { ownerType: artifact.ownerType, ownerId: artifact.ownerId, visibility: artifact.visibility },
    );
  }

  // Agents act with an implicit "member" role scoped to their own org; cross-org is always denied.
  if (identity.orgId !== artifact.orgId) return { read: false, write: false, delete: false };
  return resolveOrgArtifactAccess(
    { actorType: "agent", actorId: identity.agentId, role: "member" },
    { ownerType: artifact.ownerType, ownerId: artifact.ownerId, visibility: artifact.visibility },
  );
}
