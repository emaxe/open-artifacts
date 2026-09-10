/**
 * Parses a duration string like "90d", "15m", "12h", "30s" into milliseconds.
 * "0" means "no expiry" and resolves to `null`.
 * Bare integers are treated as days for backward-compatible CLI ergonomics (`--expires 7`).
 */
export function parseDurationMs(input: string | number): number | null {
  if (typeof input === "number") {
    return input <= 0 ? null : input * 24 * 60 * 60 * 1000;
  }

  const trimmed = input.trim();
  if (trimmed === "0") return null;

  const match = /^(\d+)\s*(s|m|h|d|w)?$/i.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid duration: "${input}". Expected formats like "90d", "15m", "0".`);
  }

  const value = Number(match[1]);
  const unit = (match[2] ?? "d").toLowerCase();
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  if (value === 0) return null;
  return value * unitMs[unit]!;
}

/** Resolves a duration string relative to `now` into an absolute expiry Date, or `null` for "never expires". */
export function resolveExpiresAt(input: string | number, now: Date = new Date()): Date | null {
  const ms = parseDurationMs(input);
  return ms === null ? null : new Date(now.getTime() + ms);
}

export function isExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  if (expiresAt === null) return false;
  return expiresAt.getTime() <= now.getTime();
}
