import { nanoid } from "nanoid";

/**
 * In-memory unlock-session store for password-protected shares: token -> { secret, expiresAtMs }.
 * Deliberately ephemeral (not persisted) — losing it on restart just means re-entering the password.
 * A `team`-mode share never sets or reads this — it has no password step at all — so nothing here
 * needs to change to support it; keep it that way rather than wiring the two together.
 *
 * Lives here (not inlined in routes/public.ts, where it originated) because both `/s/:token/unlock`
 * (routes/public.ts) and `PATCH /shares/:id` (routes/shares.ts) need to read and write it: a mode
 * change must invalidate the old unlock session, and a fresh `password` mode grants the caller who
 * just set it one, exactly like they'd typed it into the unlock form.
 */
const unlockSessions = new Map<string, { secret: string; expiresAtMs: number }>();
export const UNLOCK_TTL_MS = 60 * 60 * 1000;

export function unlockCookieName(token: string) {
  return `oa_unlock_${token}`;
}

export function isUnlocked(token: string, cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const entry = unlockSessions.get(token);
  if (!entry) return false;
  if (entry.expiresAtMs <= Date.now()) {
    unlockSessions.delete(token);
    return false;
  }
  return entry.secret === cookieValue;
}

/** Grants a fresh unlock session for `token`, returning the secret to set as its cookie value. */
export function grantUnlock(token: string, expiresAtMs: number): string {
  const secret = nanoid(32);
  unlockSessions.set(token, { secret, expiresAtMs });
  return secret;
}

/** Invalidates any standing unlock session for `token` — e.g. its share's mode/password just changed. */
export function clearUnlock(token: string): void {
  unlockSessions.delete(token);
}
