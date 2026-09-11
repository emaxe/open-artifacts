import { and, eq, isNull, sql, inArray } from "drizzle-orm";
import { computeContentHash, resolveOrgArtifactAccess, type ArtifactAccessResult, type OwnerType } from "@open-artifacts/shared";
import type { Database } from "../db/client.js";
import { artifacts, artifactVersions, orgs } from "../db/schema.js";
import type { Identity } from "../types.js";
import { getOrgRole } from "./users.js";

export const MAX_ARTIFACT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB, plan default

export class QuotaExceededError extends Error {
  constructor() {
    super("Organization storage quota exceeded");
  }
}

export class VersionConflictError extends Error {
  constructor() {
    super("Artifact was modified by someone else since you last read it");
  }
}

export class ArtifactTooLargeError extends Error {
  constructor() {
    super(`Artifact content exceeds the maximum allowed size (${MAX_ARTIFACT_SIZE_BYTES} bytes)`);
  }
}

function ownerFromIdentity(identity: Identity): { ownerType: OwnerType; ownerId: string } {
  return identity.kind === "user"
    ? { ownerType: "user", ownerId: identity.userId }
    : { ownerType: "agent", ownerId: identity.agentId };
}

async function assertWithinQuota(db: Database, orgId: string, additionalBytes: number) {
  const org = await db.query.orgs.findFirst({ where: eq(orgs.id, orgId) });
  if (!org) throw new Error("Org not found");

  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${artifacts.sizeBytes}), 0)` })
    .from(artifacts)
    .where(and(eq(artifacts.orgId, orgId), isNull(artifacts.deletedAt)));
  const total = rows[0]!.total;

  if (Number(total) + additionalBytes > org.storageQuotaBytes) {
    throw new QuotaExceededError();
  }
}

export interface CreateArtifactInput {
  orgId: string;
  identity: Identity;
  title: string;
  description?: string;
  kind: "html" | "markdown" | "mermaid" | "svg";
  content: string;
  visibility: "private" | "org";
}

export async function createArtifact(db: Database, input: CreateArtifactInput) {
  const sizeBytes = Buffer.byteLength(input.content, "utf8");
  if (sizeBytes > MAX_ARTIFACT_SIZE_BYTES) throw new ArtifactTooLargeError();
  await assertWithinQuota(db, input.orgId, sizeBytes);

  const owner = ownerFromIdentity(input.identity);
  const contentHash = computeContentHash(input.content);

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
  return db.query.artifacts.findFirst({ where: and(eq(artifacts.id, artifactId), isNull(artifacts.deletedAt)) });
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

export async function listArtifactsForOrg(db: Database, orgId: string) {
  return db.query.artifacts.findMany({
    where: and(eq(artifacts.orgId, orgId), isNull(artifacts.deletedAt)),
    orderBy: (a, { desc }) => [desc(a.updatedAt)],
  });
}

export async function listArtifactsForOrgs(db: Database, orgIds: string[]) {
  if (orgIds.length === 0) return [];
  return db.query.artifacts.findMany({
    where: and(inArray(artifacts.orgId, orgIds), isNull(artifacts.deletedAt)),
    orderBy: (a, { desc }) => [desc(a.updatedAt)],
  });
}

export async function listAllArtifacts(db: Database) {
  return db.query.artifacts.findMany({
    where: isNull(artifacts.deletedAt),
    orderBy: (a, { desc }) => [desc(a.updatedAt)],
  });
}

export interface UpdateArtifactInput {
  title?: string;
  description?: string;
  visibility?: "private" | "org";
  content?: string;
  message?: string;
  identity: Identity;
  /** Optimistic-locking guard: if provided, must match the artifact's current content hash. */
  ifMatchContentHash?: string;
}

export async function updateArtifact(db: Database, artifactId: string, input: UpdateArtifactInput) {
  return db.transaction(async (tx) => {
    const artifact = await tx.query.artifacts.findFirst({
      where: and(eq(artifacts.id, artifactId), isNull(artifacts.deletedAt)),
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

    let newVersion: typeof artifactVersions.$inferSelect | undefined;
    if (input.content !== undefined) {
      const sizeBytes = Buffer.byteLength(input.content, "utf8");
      if (sizeBytes > MAX_ARTIFACT_SIZE_BYTES) throw new ArtifactTooLargeError();

      const usageRows = await tx
        .select({ total: sql<number>`coalesce(sum(${artifacts.sizeBytes}), 0)` })
        .from(artifacts)
        .where(and(eq(artifacts.orgId, artifact.orgId), isNull(artifacts.deletedAt)));
      const total = usageRows[0]!.total;
      if (Number(total) - artifact.sizeBytes + sizeBytes > (await tx.query.orgs.findFirst({ where: eq(orgs.id, artifact.orgId) }))!.storageQuotaBytes) {
        throw new QuotaExceededError();
      }

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
          content: input.content,
          contentHash: computeContentHash(input.content),
          sizeBytes,
          createdByType: owner.ownerType,
          createdById: owner.ownerId,
          message: input.message,
        })
        .returning();

      patch.currentVersionId = newVersion!.id;
      patch.sizeBytes = sizeBytes;
    }

    const [updated] = await tx.update(artifacts).set(patch).where(eq(artifacts.id, artifactId)).returning();
    return { artifact: updated!, version: newVersion };
  });
}

export async function restoreVersion(db: Database, artifactId: string, versionNo: number, identity: Identity) {
  const target = await getVersionByNumber(db, artifactId, versionNo);
  if (!target) throw new Error("Version not found");
  return updateArtifact(db, artifactId, {
    identity,
    content: target.content,
    message: `Restored from version ${versionNo}`,
  });
}

export async function softDeleteArtifact(db: Database, artifactId: string) {
  await db.update(artifacts).set({ deletedAt: new Date() }).where(eq(artifacts.id, artifactId));
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

  // Agents act with an implicit "member" role scoped to their own org; cross-org is always denied.
  if (identity.orgId !== artifact.orgId) return { read: false, write: false, delete: false };
  return resolveOrgArtifactAccess(
    { actorType: "agent", actorId: identity.agentId, role: "member" },
    { ownerType: artifact.ownerType, ownerId: artifact.ownerId, visibility: artifact.visibility },
  );
}
