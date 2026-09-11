import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import { createAgentSchema, createApiKeySchema } from "@open-artifacts/shared";
import type { AppBindings } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { createAgent, issueApiKey, listAgentsForOrg, listKeysForAgent, revokeApiKey, listAllAgents, listAgentsForOrgs } from "../services/agents.js";
import { getOrgRole } from "../services/users.js";
import { recordAudit } from "../services/audit.js";
import { getInstanceSettings, defaultInstanceSettings } from "../services/settings.js";
import { listMemberOrgIds } from "../services/orgs.js";
import { agents, apiKeys } from "../db/schema.js";

export const agentRoutes = new Hono<AppBindings>();

async function requireOrgMember(c: Context<AppBindings>, orgId: string) {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return false;
  if (identity.isSuperadmin) return true;
  const role = await getOrgRole(c.get("db"), orgId, identity.userId);
  return role !== null;
}

agentRoutes.get("/agents", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  const orgId = c.req.query("orgId");
  const db = c.get("db");

  if (orgId) {
    if (!(await requireOrgMember(c, orgId))) return c.json({ error: { code: "forbidden" } }, 403);
    return c.json({ agents: await listAgentsForOrg(db, orgId) });
  }

  if (identity.kind !== "user") return c.json({ error: { code: "invalid_input", message: "orgId query param is required" } }, 400);
  if (identity.isSuperadmin) return c.json({ agents: await listAllAgents(db) });
  return c.json({ agents: await listAgentsForOrgs(db, await listMemberOrgIds(db, identity.userId)) });
});

agentRoutes.post("/agents", requireAuth, async (c) => {
  const orgId = c.req.query("orgId");
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);
  if (!orgId || !(await requireOrgMember(c, orgId))) return c.json({ error: { code: "forbidden" } }, 403);

  const body = createAgentSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const db = c.get("db");
  const agent = await createAgent(db, orgId, identity.userId, body.data.name, body.data.description);
  await recordAudit(db, { orgId, identity, action: "agent.create", targetType: "agent", targetId: agent.id });
  return c.json(agent, 201);
});

agentRoutes.post("/agents/:id/keys", requireAuth, async (c) => {
  const agentId = c.req.param("id");
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const db = c.get("db");
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
  if (!agent) return c.json({ error: { code: "not_found" } }, 404);
  if (!(await requireOrgMember(c, agent.orgId))) return c.json({ error: { code: "forbidden" } }, 403);

  const body = createApiKeySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const settings = await getInstanceSettings(db, defaultInstanceSettings(c.get("env")));
  const key = await issueApiKey(db, agentId, body.data.scopes, body.data.expires, settings.defaultKeyTtlDays);
  await recordAudit(db, { orgId: agent.orgId, identity, action: "agent.issue_key", targetType: "api_key", targetId: key.id });

  // The plaintext token is returned exactly once; only the hash is ever persisted.
  return c.json({ id: key.id, token: key.token, expiresAt: key.expiresAt, scopes: key.scopes }, 201);
});

agentRoutes.get("/agents/:id/keys", requireAuth, async (c) => {
  const agentId = c.req.param("id");
  const db = c.get("db");
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, agentId) });
  if (!agent) return c.json({ error: { code: "not_found" } }, 404);
  if (!(await requireOrgMember(c, agent.orgId))) return c.json({ error: { code: "forbidden" } }, 403);

  const keys = await listKeysForAgent(db, agentId);
  return c.json({ keys: keys.map((k) => ({ id: k.id, prefix: k.prefix, scopes: k.scopes, expiresAt: k.expiresAt, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt })) });
});

agentRoutes.delete("/keys/:id", requireAuth, async (c) => {
  const keyId = c.req.param("id");
  const db = c.get("db");
  const key = await db.query.apiKeys.findFirst({ where: eq(apiKeys.id, keyId) });
  if (!key) return c.json({ error: { code: "not_found" } }, 404);
  const agent = await db.query.agents.findFirst({ where: eq(agents.id, key.agentId) });
  if (!agent || !(await requireOrgMember(c, agent.orgId))) return c.json({ error: { code: "forbidden" } }, 403);

  await revokeApiKey(db, keyId);
  await recordAudit(db, { orgId: agent.orgId, identity: c.get("identity")!, action: "agent.revoke_key", targetType: "api_key", targetId: keyId });
  return c.json({ ok: true });
});
