import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { AppBindings, AppVariables, Identity } from "../types.js";
import { getSessionWithUser } from "../services/users.js";
import { verifyApiKeyToken } from "../services/agents.js";

export const SESSION_COOKIE_NAME = "oa_session";

/**
 * Resolves an identity from either a Bearer API key or a session cookie, without touching
 * context state — the body of `resolveIdentity` below, factored out so routes that need identity
 * only conditionally (e.g. a `team`-mode share on `/s/:token`) can call it directly instead of
 * paying for it as middleware on every request. Never throws.
 */
export async function resolveIdentityFromRequest(c: Context<AppBindings>): Promise<{ identity: Identity | null; apiKeyError?: AppVariables["apiKeyError"] }> {
  const db = c.get("db");
  const authHeader = c.req.header("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    const result = await verifyApiKeyToken(db, token);
    if (result.ok) return { identity: result.identity };
    return { identity: null, apiKeyError: result.error };
  }

  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionId) {
    const found = await getSessionWithUser(db, sessionId);
    if (found) return { identity: { kind: "user", userId: found.user.id, isSuperadmin: found.user.isSuperadmin } };
  }

  return { identity: null };
}

/** Resolves `identity` from either a Bearer API key or a session cookie. Never throws — routes decide what's required. */
export const resolveIdentity = createMiddleware<AppBindings>(async (c, next) => {
  const result = await resolveIdentityFromRequest(c);
  c.set("identity", result.identity);
  if (result.apiKeyError) c.set("apiKeyError", result.apiKeyError); // surfaced by requireAuth for a precise 401
  return next();
});

export const requireAuth = createMiddleware<AppBindings>(async (c, next) => {
  const identity = c.get("identity");
  if (!identity) {
    const keyError = c.get("apiKeyError");
    if (keyError === "expired") return c.json({ error: { code: "key_expired", message: "API key has expired" } }, 401);
    if (keyError === "revoked") return c.json({ error: { code: "key_revoked", message: "API key has been revoked" } }, 401);
    return c.json({ error: { code: "unauthorized", message: "Authentication required" } }, 401);
  }
  return next();
});

export const requireSuperadmin = createMiddleware<AppBindings>(async (c, next) => {
  const identity = c.get("identity");
  if (!identity || identity.kind !== "user" || !identity.isSuperadmin) {
    return c.json({ error: { code: "forbidden", message: "Superadmin access required" } }, 403);
  }
  return next();
});
