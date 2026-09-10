import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { nanoid } from "nanoid";

const ARGON2_OPTS = { type: argon2.argon2id } as const;

export async function hashSecret(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, ARGON2_OPTS);
}

export async function verifySecret(plaintext: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

/**
 * Synchronous verify used only where the shared `resolveShareAccess` matrix requires a
 * pure/synchronous predicate. Not used on the hot path for API-key auth (which stays async).
 */
export interface GeneratedApiKey {
  prefix: string;
  secret: string;
  /** Full token to hand to the caller once: `oa_live_<prefix>_<secret>`. Never stored. */
  token: string;
}

export function generateApiKey(): GeneratedApiKey {
  const prefix = nanoid(10);
  const secret = randomBytes(24).toString("base64url");
  return { prefix, secret, token: `oa_live_${prefix}_${secret}` };
}

export function parseApiKeyToken(token: string): { prefix: string; secret: string } | null {
  const match = /^oa_live_([A-Za-z0-9_-]{10})_([A-Za-z0-9_-]+)$/.exec(token.trim());
  if (!match) return null;
  return { prefix: match[1]!, secret: match[2]! };
}

export function generateDeviceCode(): string {
  return randomBytes(32).toString("base64url");
}

/** Human-friendly code the user types at /activate, e.g. "WXYZ-1234". Excludes ambiguous chars. */
export function generateUserCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function generateShareToken(): string {
  return nanoid(24);
}
