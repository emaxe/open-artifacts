import { eq, sql } from "drizzle-orm";
import { resolveExpiresAt, resolveShareAccess, type ShareAccessResult, type ShareMode, type ShareViewer } from "@open-artifacts/shared";
import type { Database } from "../db/client.js";
import { shares } from "../db/schema.js";
import { generateShareToken, hashSecret, verifySecret } from "./crypto.js";
import { getOrgRole } from "./users.js";
import type { Identity } from "../types.js";

export interface CreateShareInput {
  artifactId: string;
  mode: ShareMode;
  password?: string;
  expires?: string | number;
  pinnedVersionId?: string;
  createdBy: string;
}

export async function createShare(db: Database, input: CreateShareInput) {
  if (input.mode === "password" && !input.password) {
    // Belt and braces behind the route-level check: a password share can never be written
    // without a hash — see the NULL-hash regression covered by share-access.test.ts.
    throw new Error("createShare: password is required when mode is 'password'");
  }
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
 * Resolves whether `identity` counts as a viewer for a `team`-mode share on an artifact owned by
 * `artifactOrgId`. Deliberately membership of ANY role (not the `resolveOrgArtifactAccess`
 * visibility matrix) — see the comment on the `"team"` case in `resolveShareAccess`.
 */
export async function resolveShareViewer(db: Database, identity: Identity | null, artifactOrgId: string): Promise<ShareViewer> {
  if (!identity) return { authenticated: false, isOrgMember: false };

  if (identity.kind === "user") {
    if (identity.isSuperadmin) return { authenticated: true, isOrgMember: true };
    return { authenticated: true, isOrgMember: (await getOrgRole(db, artifactOrgId, identity.userId)) !== null };
  }

  if (identity.kind === "user_key") {
    return { authenticated: true, isOrgMember: (await getOrgRole(db, artifactOrgId, identity.userId)) !== null };
  }

  // kind === "agent": locked to its own org, never a superadmin bypass.
  return { authenticated: true, isOrgMember: identity.orgId === artifactOrgId };
}

/**
 * The one async entry point to the share-access matrix. Does the argon2 verify (which can't live
 * inside the pure `resolveShareAccess` resolver) and delegates everything else to it.
 */
export async function checkShareAccess(
  share: typeof shares.$inferSelect,
  opts: { providedPassword?: string; unlocked?: boolean; viewer?: ShareViewer } = {},
): Promise<ShareAccessResult> {
  let passwordCheck: "absent" | "unlocked" | "wrong" = opts.unlocked ? "unlocked" : "absent";
  if (!opts.unlocked && opts.providedPassword && share.passwordHash) {
    passwordCheck = (await verifySecret(opts.providedPassword, share.passwordHash)) ? "unlocked" : "wrong";
  }
  return resolveShareAccess(share, { passwordCheck, viewer: opts.viewer });
}

/** "Active public" = mode 'public', not revoked, not expired, on a non-deleted artifact of this org. */
export async function countActivePublicShares(db: Database, orgId: string): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    SELECT count(*)::text AS count
    FROM "shares" s
    JOIN "artifacts" a ON a."id" = s."artifact_id"
    WHERE a."org_id" = ${orgId}
      AND a."deleted_at" IS NULL
      AND s."mode" = 'public'
      AND s."revoked_at" IS NULL
      AND (s."expires_at" IS NULL OR s."expires_at" > now())
  `);
  return Number(result.rows[0]?.count ?? 0);
}

/** Revokes every currently-active public share for an org's artifacts in one statement. Idempotent. */
export async function revokeActivePublicSharesForOrg(db: Database, orgId: string): Promise<number> {
  const result = await db.execute<{ id: string }>(sql`
    UPDATE "shares"
    SET "revoked_at" = now()
    WHERE "id" IN (
      SELECT s."id"
      FROM "shares" s
      JOIN "artifacts" a ON a."id" = s."artifact_id"
      WHERE a."org_id" = ${orgId}
        AND a."deleted_at" IS NULL
        AND s."mode" = 'public'
        AND s."revoked_at" IS NULL
        AND (s."expires_at" IS NULL OR s."expires_at" > now())
    )
    RETURNING "id"
  `);
  return result.rowCount ?? result.rows.length;
}
