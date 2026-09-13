/**
 * Normalizes a stored storage-quota limit (instance setting or org column) into the internal
 * convention: `null` = unlimited. Both `0` (setting) and SQL `NULL` (column) mean unlimited —
 * the same convention `toLifetimeLimit` uses for artifact lifetimes.
 */
export function toQuotaLimit(stored: number | null | undefined): number | null {
  if (stored === null || stored === undefined || stored <= 0) return null;
  return stored;
}

/** Intersects two byte quotas (`null` = unlimited): the stricter (smaller) finite bound wins. */
export function effectiveQuotaLimit(global: number | null, team: number | null): number | null {
  if (global === null) return team;
  if (team === null) return global;
  return Math.min(global, team);
}

/** Whether a byte total would exceed a limit (`null` = unlimited). */
export function quotaExceeds(totalBytes: number, limitBytes: number | null): boolean {
  if (limitBytes === null) return false;
  return totalBytes > limitBytes;
}

/** Bytes still available under a limit (`null` = unlimited stays `null`, never negative otherwise). */
export function quotaRemaining(usedBytes: number, limitBytes: number | null): number | null {
  if (limitBytes === null) return null;
  return Math.max(0, limitBytes - usedBytes);
}
