import { Hono } from "hono";
import { z } from "zod";
import { deviceCodeRequestSchema } from "@open-artifacts/shared";
import type { AppBindings } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import {
  approveDeviceAuthRequest,
  createDeviceAuthRequest,
  denyDeviceAuthRequest,
  findPendingByUserCode,
  pollDeviceAuthRequest,
} from "../services/device-auth.js";
import { getInstanceSettings, defaultInstanceSettings } from "../services/settings.js";
import { getOrgRole } from "../services/users.js";
import { recordAudit } from "../services/audit.js";

export const oauthDeviceRoutes = new Hono<AppBindings>();

oauthDeviceRoutes.post("/oauth/device/code", async (c) => {
  const body = deviceCodeRequestSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const db = c.get("db");
  const env = c.get("env");
  const request = await createDeviceAuthRequest(db, body.data.agentName, body.data.scopes, body.data.grantKind);
  const verificationUri = `${env.APP_ORIGIN}/activate`;

  return c.json({
    device_code: request.deviceCode,
    user_code: request.userCode,
    verification_uri: verificationUri,
    verification_uri_complete: `${verificationUri}?code=${request.userCode}`,
    expires_in: request.expiresIn,
    interval: request.interval,
  });
});

oauthDeviceRoutes.post("/oauth/device/token", async (c) => {
  const body = z
    .object({ deviceCode: z.string().min(1), grantType: z.string().optional() })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "invalid_request" }, 400);

  const db = c.get("db");
  const env = c.get("env");
  const settings = await getInstanceSettings(db, defaultInstanceSettings(env));
  const result = await pollDeviceAuthRequest(db, body.data.deviceCode, settings.defaultKeyTtlDays);

  switch (result.status) {
    case "authorization_pending":
      return c.json({ error: "authorization_pending" }, 428);
    case "slow_down":
      return c.json({ error: "slow_down" }, 429);
    case "expired_token":
      return c.json({ error: "expired_token" }, 400);
    case "access_denied":
      return c.json({ error: "access_denied" }, 403);
    case "ok":
      return c.json(
        result.grantKind === "user"
          ? { api_key: result.apiKey, expires_at: result.expiresAt, grant_kind: "user", user_id: result.userId, org_id: null, agent_id: null }
          : { api_key: result.apiKey, expires_at: result.expiresAt, grant_kind: "agent", org_id: result.orgId, agent_id: result.agentId },
      );
  }
});

// --- Human-facing approval endpoints (require an authenticated session) ---

oauthDeviceRoutes.get("/oauth/device/pending", requireAuth, async (c) => {
  const userCode = c.req.query("code");
  if (!userCode) return c.json({ error: { code: "invalid_input" } }, 400);
  const db = c.get("db");
  const request = await findPendingByUserCode(db, userCode);
  if (!request) return c.json({ error: { code: "not_found" } }, 404);
  return c.json({ agentName: request.agentName, scopes: request.requestedScopes, grantKind: request.grantKind, expiresAt: request.expiresAt });
});

oauthDeviceRoutes.post("/oauth/device/approve", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const body = z.object({ userCode: z.string().min(1), orgId: z.string().uuid().optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const db = c.get("db");
  // grantKind comes from the stored request, not the approver's client — an approver can't turn
  // a "personal key" request into an org-locked agent grant (or vice versa) by sending a different body.
  const pending = await findPendingByUserCode(db, body.data.userCode);
  if (!pending) return c.json({ error: { code: "not_found" } }, 404);

  if (pending.grantKind === "user") {
    const result = await approveDeviceAuthRequest(db, body.data.userCode, identity.userId, { kind: "user" });
    if (!result.ok) return c.json({ error: { code: result.error } }, 400);
    await recordAudit(db, { identity, action: "device_auth.approve", meta: { userCode: body.data.userCode, grantKind: "user" } });
    return c.json({ ok: true });
  }

  if (!body.data.orgId) return c.json({ error: { code: "invalid_input", message: "orgId is required to approve an agent grant" } }, 400);
  const role = identity.isSuperadmin ? "owner" : await getOrgRole(db, body.data.orgId, identity.userId);
  if (!role) return c.json({ error: { code: "forbidden", message: "You are not a member of that org" } }, 403);

  const result = await approveDeviceAuthRequest(db, body.data.userCode, identity.userId, { kind: "agent", orgId: body.data.orgId });
  if (!result.ok) return c.json({ error: { code: result.error } }, 400);

  await recordAudit(db, { orgId: body.data.orgId, identity, action: "device_auth.approve", meta: { userCode: body.data.userCode, grantKind: "agent" } });
  return c.json({ ok: true });
});

oauthDeviceRoutes.post("/oauth/device/deny", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const body = z.object({ userCode: z.string().min(1) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input" } }, 400);

  const result = await denyDeviceAuthRequest(c.get("db"), body.data.userCode);
  if (!result.ok) return c.json({ error: { code: result.error } }, 400);
  return c.json({ ok: true });
});
