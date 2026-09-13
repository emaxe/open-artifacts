import type { ShareMode } from "./share-policy.js";

export interface ShareRecord {
  mode: ShareMode;
  passwordHash: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export type ShareAccessDenialReason =
  | "revoked"
  | "expired"
  | "password_required"
  | "password_incorrect"
  | "login_required"
  | "not_a_member";

export type ShareAccessResult = { allowed: true } | { allowed: false; reason: ShareAccessDenialReason };

/** Verdict of the caller's own password/unlock step, computed by the caller (argon2 is async). */
export type PasswordCheck = "absent" | "unlocked" | "wrong";

export interface ShareViewer {
  /** A resolved identity exists (session cookie or Bearer key) — not necessarily an org member. */
  authenticated: boolean;
  /** That identity is a member (any role) of the artifact's org, or a superadmin. */
  isOrgMember: boolean;
}

export interface ResolveShareAccessOptions {
  now?: Date;
  /** Result of the caller's own password verification / unlock-cookie check. Default `"absent"`. */
  passwordCheck?: PasswordCheck;
  /** Required to resolve mode `"team"`; omit for an anonymous caller. */
  viewer?: ShareViewer;
}

/**
 * Resolves whether a share token grants read access right now — independent of org role/
 * visibility. This is the ONE live copy of the access matrix (see `apps/api/src/routes/public.ts`,
 * which used to inline its own checks because it holds an unlock cookie, not a plaintext
 * password — `passwordCheck` is the seam that lets it call this instead).
 *
 * The `switch` below is intentionally exhaustive with no `default` case: adding a 4th share mode
 * without extending this function is a compile error, not a silent "unknown mode ⇒ allowed".
 */
export function resolveShareAccess(share: ShareRecord, opts: ResolveShareAccessOptions = {}): ShareAccessResult {
  const now = opts.now ?? new Date();

  if (share.revokedAt !== null) return { allowed: false, reason: "revoked" };
  if (share.expiresAt !== null && share.expiresAt.getTime() <= now.getTime()) {
    return { allowed: false, reason: "expired" };
  }

  switch (share.mode) {
    case "public":
      return { allowed: true };

    case "password": {
      // A NULL hash is a broken row (createShare never writes one) — treat it as "still needs a
      // password", never as an accidental public share.
      if (!share.passwordHash) return { allowed: false, reason: "password_required" };
      const check = opts.passwordCheck ?? "absent";
      if (check === "unlocked") return { allowed: true };
      return { allowed: false, reason: check === "wrong" ? "password_incorrect" : "password_required" };
    }

    case "team": {
      // Deliberately membership of ANY role, NOT the `resolveOrgArtifactAccess` visibility
      // matrix. A team link is an explicit grant by someone who already had write access to the
      // artifact; requiring `read` under the visibility matrix would make it useless for exactly
      // the case it exists for — handing a `private` artifact to a teammate who doesn't own it.
      // A password share out-ranks that same matrix for an outsider for the same reason.
      if (!opts.viewer?.authenticated) return { allowed: false, reason: "login_required" };
      if (!opts.viewer.isOrgMember) return { allowed: false, reason: "not_a_member" };
      return { allowed: true };
    }
  }
}
