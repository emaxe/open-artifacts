import { parseDurationMs } from "./ttl.js";

/**
 * Normalizes a stored lifetime limit (instance setting or org column) into the internal
 * convention: `null` = unlimited. Both `0` (setting) and SQL `NULL` (column) mean unlimited.
 */
export function toLifetimeLimit(stored: number | null | undefined): number | null {
  if (stored === null || stored === undefined || stored <= 0) return null;
  return stored;
}

/**
 * Parses a caller-supplied artifact lifetime into minutes. Unlike `parseDurationMs`
 * (used for shares/keys, where a bare number means DAYS), a bare number here means
 * MINUTES — this function is for `artifacts.lifetime`, not `shares.expires`. Never mix
 * the two conventions across a value: a duration string with an explicit unit ("2h",
 * "7d") is unambiguous either way and is delegated to `parseDurationMs`.
 * `0` / `null` / `undefined` mean "never expires" and resolve to `null`.
 */
export function parseLifetimeMinutes(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return input <= 0 ? null : input;

  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    const minutes = Number(trimmed);
    return minutes <= 0 ? null : minutes;
  }

  const ms = parseDurationMs(trimmed);
  if (ms === null) return null;
  if (ms < 60_000) {
    throw new Error(`Duration "${input}" is shorter than one minute; artifact lifetimes are measured in minutes.`);
  }
  return Math.round(ms / 60_000);
}

/** Intersects two lifetime limits (`null` = unlimited): the stricter (smaller) finite bound wins. */
export function effectiveLifetimeLimit(global: number | null, team: number | null): number | null {
  if (global === null) return team;
  if (team === null) return global;
  return Math.min(global, team);
}

/** Whether a requested lifetime (`null` = unlimited) exceeds a limit (`null` = unlimited). */
export function lifetimeExceedsLimit(requestedMinutes: number | null, limitMinutes: number | null): boolean {
  if (limitMinutes === null) return false;
  if (requestedMinutes === null) return true;
  return requestedMinutes > limitMinutes;
}

/** Resolves a lifetime in minutes (`null` = unlimited) relative to `from` into an absolute expiry Date. */
export function expiresAtFromMinutes(minutes: number | null, from: Date = new Date()): Date | null {
  if (minutes === null) return null;
  return new Date(from.getTime() + minutes * 60_000);
}
