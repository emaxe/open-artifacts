export type ShareMode = "public" | "password";

export interface ShareRecord {
  mode: ShareMode;
  passwordHash: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export type ShareAccessDenialReason = "revoked" | "expired" | "password_required" | "password_incorrect";

export type ShareAccessResult =
  | { allowed: true }
  | { allowed: false; reason: ShareAccessDenialReason };

export interface ResolveShareAccessOptions {
  /** Plaintext password supplied by the viewer, if any. */
  providedPassword?: string;
  /** Verifies a plaintext password against the stored hash. Injected so this stays argon2-agnostic and pure. */
  verifyPassword?: (plaintext: string, hash: string) => boolean;
  now?: Date;
}

/** Resolves whether a share token grants read access right now — independent of org role/visibility. */
export function resolveShareAccess(share: ShareRecord, opts: ResolveShareAccessOptions = {}): ShareAccessResult {
  const now = opts.now ?? new Date();

  if (share.revokedAt !== null) return { allowed: false, reason: "revoked" };
  if (share.expiresAt !== null && share.expiresAt.getTime() <= now.getTime()) {
    return { allowed: false, reason: "expired" };
  }

  if (share.mode === "public") return { allowed: true };

  // mode === "password"
  if (!share.passwordHash) return { allowed: true };
  if (!opts.providedPassword) return { allowed: false, reason: "password_required" };
  if (!opts.verifyPassword) {
    throw new Error("resolveShareAccess: verifyPassword is required to check a password-protected share");
  }
  const ok = opts.verifyPassword(opts.providedPassword, share.passwordHash);
  return ok ? { allowed: true } : { allowed: false, reason: "password_incorrect" };
}
