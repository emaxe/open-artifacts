import { eq } from "drizzle-orm";
import { resolveExpiresAt, type ShareAccessResult } from "@open-artifacts/shared";
import type { Database } from "../db/client.js";
import { shares } from "../db/schema.js";
import { generateShareToken, hashSecret, verifySecret } from "./crypto.js";

export interface CreateShareInput {
  artifactId: string;
  mode: "public" | "password";
  password?: string;
  expires?: string | number;
  pinnedVersionId?: string;
  createdBy: string;
}

export async function createShare(db: Database, input: CreateShareInput) {
  const token = generateShareToken();
  const passwordHash = input.mode === "password" && input.password ? await hashSecret(input.password) : null;
  const expiresAt = input.expires !== undefined ? resolveExpiresAt(input.expires) : null;

  const [share] = await db
    .insert(shares)
    .values({
      artifactId: input.artifactId,
      token,
      mode: input.mode,
      passwordHash,
      expiresAt: expiresAt ?? undefined,
      pinnedVersionId: input.pinnedVersionId,
      createdBy: input.createdBy,
    })
    .returning();
  return share!;
}

export async function getShareByToken(db: Database, token: string) {
  return db.query.shares.findFirst({ where: eq(shares.token, token) });
}

export async function listSharesForArtifact(db: Database, artifactId: string) {
  return db.query.shares.findMany({ where: eq(shares.artifactId, artifactId) });
}

export async function revokeShare(db: Database, shareId: string) {
  await db.update(shares).set({ revokedAt: new Date() }).where(eq(shares.id, shareId));
}

export async function incrementShareViewCount(db: Database, shareId: string) {
  await db
    .update(shares)
    .set({ viewCount: (await db.query.shares.findFirst({ where: eq(shares.id, shareId) }))!.viewCount + 1 })
    .where(eq(shares.id, shareId));
}

/**
 * Resolves whether a share token grants read access right now. Mirrors the pure
 * `resolveShareAccess` matrix from `@open-artifacts/shared`, but inlined as async because
 * argon2 password verification can't be expressed as the sync predicate that function expects.
 */
export async function checkShareAccess(
  share: typeof shares.$inferSelect,
  providedPassword?: string,
): Promise<ShareAccessResult> {
  if (share.revokedAt !== null) return { allowed: false, reason: "revoked" };
  if (share.expiresAt !== null && share.expiresAt.getTime() <= Date.now()) {
    return { allowed: false, reason: "expired" };
  }
  if (share.mode === "public" || !share.passwordHash) return { allowed: true };
  if (!providedPassword) return { allowed: false, reason: "password_required" };
  const ok = await verifySecret(providedPassword, share.passwordHash);
  return ok ? { allowed: true } : { allowed: false, reason: "password_incorrect" };
}
