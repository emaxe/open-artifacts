export const SHARE_MODES = ["public", "password", "team"] as const;
export type ShareMode = (typeof SHARE_MODES)[number];

/**
 * Modes usable as a *default* — `"password"` is excluded: a create-share request that omits
 * `mode` carries no password, so it can never resolve to a password-protected share.
 */
export const DEFAULT_SHARE_MODES = ["public", "team"] as const;
export type DefaultShareMode = (typeof DEFAULT_SHARE_MODES)[number];

export interface SharePolicySource {
  /** Instance-wide policy (superadmin, `InstanceSettings`). */
  instance: { allowPublicShares: boolean; defaultShareMode: DefaultShareMode };
  /** One team's own policy. `defaultShareMode: null` = inherit the instance default. */
  org: { allowPublicShares: boolean; defaultShareMode: DefaultShareMode | null };
}

export interface EffectiveSharePolicy {
  allowPublicShares: boolean;
  defaultShareMode: DefaultShareMode;
  /** Exactly the modes a caller may name right now, in UI display order. */
  allowedModes: ShareMode[];
}

/**
 * Resolves the effective share policy for one team: the instance-wide flags intersected with
 * that team's own. Mirrors `effectiveLifetimeLimit` in `./lifetime.ts` — the stricter side always
 * wins — but the two knobs here play different roles:
 *
 * - `allowPublicShares` is the clamp: a team may only be equal-or-stricter than the instance,
 *   never looser (the boolean analogue of `Math.min`).
 * - `defaultShareMode` is inheritance, NOT a second, competing floor. There are only two legal
 *   default values, and "public is looser than team" is already fully expressed by
 *   `allowPublicShares` — making the default *also* act as a floor would give two knobs for one
 *   constraint (an instance default of `"team"` acting as a floor would forbid a team from
 *   *defaulting* to public even while public links remain explicitly creatable, which is
 *   incoherent). A team's own default is stored as a preference and survives an instance-wide
 *   flag being toggled off and back on; if forbidding public links is the actual intent, that is
 *   exactly what `allowPublicShares` is for, and the clamp below covers it.
 */
export function resolveSharePolicy(src: SharePolicySource): EffectiveSharePolicy {
  const allowPublicShares = src.instance.allowPublicShares && src.org.allowPublicShares;
  const rawDefault = src.org.defaultShareMode ?? src.instance.defaultShareMode;
  // A `public` default degrades to `team` when public links are forbidden. Never `password` —
  // DEFAULT_SHARE_MODES excludes it, so there is nothing further to degrade to.
  const defaultShareMode: DefaultShareMode = rawDefault === "public" && !allowPublicShares ? "team" : rawDefault;
  const allowedModes: ShareMode[] = ["team", "password", ...(allowPublicShares ? (["public"] as const) : [])];
  return { allowPublicShares, defaultShareMode, allowedModes };
}

export type ResolveRequestedShareModeResult = { ok: true; mode: ShareMode } | { ok: false; reason: "public_forbidden" };

/** Resolves a caller's (possibly absent) requested share mode against an effective policy. */
export function resolveRequestedShareMode(
  requested: ShareMode | undefined,
  policy: EffectiveSharePolicy,
): ResolveRequestedShareModeResult {
  const mode = requested ?? policy.defaultShareMode;
  if (mode === "public" && !policy.allowPublicShares) return { ok: false, reason: "public_forbidden" };
  return { ok: true, mode };
}
