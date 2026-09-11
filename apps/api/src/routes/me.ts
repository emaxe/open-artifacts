import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { API_KEY_SCOPES, createUserApiKeySchema } from "@open-artifacts/shared";
import type { AppBindings } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { isSessionUser } from "../services/identity.js";
import { listOrgMembershipsForUser } from "../services/orgs.js";
import { getUserKey, issueUserApiKey, listKeysForUser, revokeApiKey } from "../services/agents.js";
import { getInstanceSettings, defaultInstanceSettings } from "../services/settings.js";
import { recordAudit } from "../services/audit.js";
import { orgs, users } from "../db/schema.js";

export const meRoutes = new Hono<AppBindings>();

/**
 * The one endpoint open to every identity kind (session, personal key, agent key) — it's metadata
 * about the caller's own identity, not a scoped resource, so no `artifacts:*` scope is required.
 * Deliberately never includes `isSuperadmin`: a personal key must not leak that signal (see
 * services/org-scope.ts, which never grants a superadmin bypass to user_key either).
 */
meRoutes.get("/me/orgs", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  const db = c.get("db");

  if (identity.kind === "agent") {
    const org = await db.query.orgs.findFirst({ where: eq(orgs.id, identity.orgId) });
    return c.json({
      userId: null,
      email: null,
      name: null,
      authKind: "agent" as const,
      scopes: identity.scopes,
      orgs: org ? [{ orgId: org.id, name: org.name, slug: org.slug, kind: org.kind, role: "member" as const }] : [],
      defaultOrgId: identity.orgId,
    });
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, identity.userId) });
  if (!user) return c.json({ error: { code: "unauthorized" } }, 401);

  const memberships = await listOrgMembershipsForUser(db, identity.userId);
  const mainOrgId = memberships.find((m) => m.kind === "main")?.orgId ?? null;

  return c.json({
    userId: user.id,
    email: user.email,
    name: user.name,
    authKind: identity.kind === "user" ? ("session" as const) : ("user_key" as const),
    // A cookie session isn't scope-limited (see services/scopes.ts) — report the full set so
    // callers that branch on scopes (e.g. the CLI) see it as unrestricted rather than empty.
    scopes: identity.kind === "user" ? [...API_KEY_SCOPES] : identity.scopes,
    orgs: memberships,
    defaultOrgId: mainOrgId,
  });
});

meRoutes.get("/me/keys", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!isSessionUser(identity)) return c.json({ error: { code: "forbidden" } }, 403);

  const keys = await listKeysForUser(c.get("db"), identity.userId);
  return c.json({
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      scopes: k.scopes,
      expiresAt: k.expiresAt,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    })),
  });
});

meRoutes.post("/me/keys", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  // Session-only: a personal key must never be able to mint another key (or an agent key to
  // mint one either — both would let a leaked key reproduce itself indefinitely).
  if (!isSessionUser(identity)) return c.json({ error: { code: "forbidden" } }, 403);

  const body = createUserApiKeySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const db = c.get("db");
  const settings = await getInstanceSettings(db, defaultInstanceSettings(c.get("env")));
  const key = await issueUserApiKey(db, identity.userId, body.data.name, body.data.scopes, body.data.expires, settings.defaultKeyTtlDays);
  await recordAudit(db, { identity, action: "user_key.issue", targetType: "api_key", targetId: key.id });

  // The plaintext token is returned exactly once; only its hash is ever persisted.
  return c.json({ id: key.id, token: key.token, expiresAt: key.expiresAt, scopes: key.scopes }, 201);
});

meRoutes.delete("/me/keys/:id", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!isSessionUser(identity)) return c.json({ error: { code: "forbidden" } }, 403);

  const db = c.get("db");
  const key = await getUserKey(db, c.req.param("id"), identity.userId);
  if (!key) return c.json({ error: { code: "not_found" } }, 404);

  await revokeApiKey(db, key.id);
  await recordAudit(db, { identity, action: "user_key.revoke", targetType: "api_key", targetId: key.id });
  return c.json({ ok: true });
});
