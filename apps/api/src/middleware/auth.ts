import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { AppBindings } from "../types.js";
import { getSessionWithUser } from "../services/users.js";
import { verifyApiKeyToken } from "../services/agents.js";

export const SESSION_COOKIE_NAME = "oa_session";

/** Resolves `identity` from either a Bearer API key or a session cookie. Never throws — routes decide what's required. */
export const resolveIdentity = createMiddleware<AppBindings>(async (c, next) => {
  const db = c.get("db");
  const authHeader = c.req.header("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    const result = await verifyApiKeyToken(db, token);
    if (result.ok) {
      c.set("identity", result.identity);
    } else {
      c.set("identity", null);
      c.set("apiKeyError", result.error); // surfaced by requireAuth for a precise 401
    }
    return next();
  }

  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionId) {
    const found = await getSessionWithUser(db, sessionId);
    if (found) {
      c.set("identity", { kind: "user", userId: found.user.id, isSuperadmin: found.user.isSuperadmin });
      return next();
    }
  }

  c.set("identity", null);
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
