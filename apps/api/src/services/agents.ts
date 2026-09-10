import { and, eq, isNull } from "drizzle-orm";
import { resolveExpiresAt, type ApiKeyScope } from "@open-artifacts/shared";
import type { Database } from "../db/client.js";
import { agents, apiKeys } from "../db/schema.js";
import { generateApiKey, hashSecret, parseApiKeyToken, verifySecret } from "./crypto.js";
import type { Identity } from "../types.js";

export async function createAgent(db: Database, orgId: string, createdBy: string, name: string, description?: string) {
  const [agent] = await db.insert(agents).values({ orgId, name, description, createdBy }).returning();
  return agent!;
}

export interface IssuedKey {
  id: string;
  token: string;
  expiresAt: Date | null;
  scopes: ApiKeyScope[];
}

export async function issueApiKey(
  db: Database,
  agentId: string,
  scopes: ApiKeyScope[],
  ttl: string | number | undefined,
  defaultTtlDays: number,
): Promise<IssuedKey> {
  const generated = generateApiKey();
  const keyHash = await hashSecret(generated.secret);
  const expiresAt = resolveExpiresAt(ttl ?? defaultTtlDays);

  const [row] = await db
    .insert(apiKeys)
    .values({ agentId, prefix: generated.prefix, keyHash, scopes, expiresAt: expiresAt ?? undefined })
    .returning();

  return { id: row!.id, token: generated.token, expiresAt, scopes };
}

export async function revokeApiKey(db: Database, keyId: string) {
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, keyId));
}

// Short-lived positive-result cache so a chatty agent doesn't pay an argon2 verify on every request.
const VERIFY_CACHE_TTL_MS = 60_000;
const verifyCache = new Map<string, { identity: Identity; expiresAtMs: number }>();

export function clearApiKeyVerifyCacheForTests() {
  verifyCache.clear();
}

export type ApiKeyVerifyError = "malformed" | "not_found" | "revoked" | "expired" | "bad_secret";

export async function verifyApiKeyToken(
  db: Database,
  token: string,
): Promise<{ ok: true; identity: Identity } | { ok: false; error: ApiKeyVerifyError }> {
  const cached = verifyCache.get(token);
  if (cached && cached.expiresAtMs > Date.now()) {
    return { ok: true, identity: cached.identity };
  }

  const parsed = parseApiKeyToken(token);
  if (!parsed) return { ok: false, error: "malformed" };

  const row = await db.query.apiKeys.findFirst({ where: eq(apiKeys.prefix, parsed.prefix) });
  if (!row) return { ok: false, error: "not_found" };
  if (row.revokedAt) return { ok: false, error: "revoked" };
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return { ok: false, error: "expired" };

  const validSecret = await verifySecret(parsed.secret, row.keyHash);
  if (!validSecret) return { ok: false, error: "bad_secret" };

  const agent = await db.query.agents.findFirst({ where: eq(agents.id, row.agentId) });
  if (!agent) return { ok: false, error: "not_found" };

  // Fire-and-forget last_used_at bump; failures here should never block the request.
  db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).catch(() => {});

  const identity: Identity = {
    kind: "agent",
    agentId: agent.id,
    orgId: agent.orgId,
    keyId: row.id,
    scopes: row.scopes as ApiKeyScope[],
  };
  verifyCache.set(token, { identity, expiresAtMs: Date.now() + VERIFY_CACHE_TTL_MS });
  return { ok: true, identity };
}

export async function listAgentsForOrg(db: Database, orgId: string) {
  return db.query.agents.findMany({ where: eq(agents.orgId, orgId) });
}

export async function listKeysForAgent(db: Database, agentId: string) {
  return db.query.apiKeys.findMany({ where: and(eq(apiKeys.agentId, agentId), isNull(apiKeys.revokedAt)) });
}
