import { createMiddleware } from "hono/factory";
import type { AppBindings } from "../types.js";
import { recordApiUsage } from "../services/analytics.js";

function statusClass(status: number): "2xx" | "3xx" | "4xx" | "5xx" {
  if (status < 300) return "2xx";
  if (status < 400) return "3xx";
  if (status < 500) return "4xx";
  return "5xx";
}

/**
 * Records one usage row per API-key-authenticated request (agent or personal). Session (cookie)
 * traffic isn't metered here. For personal keys, the org comes from `resolvedOrgId`, set by
 * `resolveOrgScope` during route handling — if the route never resolved one (e.g. a cross-org
 * listing), there's no single org to attribute the row to, so metering is skipped for it.
 */
export const usageMetering = createMiddleware<AppBindings>(async (c, next) => {
  const startedAt = Date.now();
  await next();
  const identity = c.get("identity");
  if (!identity) return;

  const db = c.get("db");
  const endpoint = c.req.routePath ?? c.req.path;
  const method = c.req.method;
  const status = statusClass(c.res.status);
  const durationMs = Date.now() - startedAt;

  if (identity.kind === "agent") {
    recordApiUsage(db, { orgId: identity.orgId, agentId: identity.agentId, keyId: identity.keyId, endpoint, method, statusClass: status, durationMs }).catch((err) =>
      console.error("usage metering failed:", err),
    );
    return;
  }

  if (identity.kind === "user_key") {
    const orgId = c.get("resolvedOrgId");
    if (!orgId) return;
    recordApiUsage(db, { orgId, agentId: null, keyId: identity.keyId, endpoint, method, statusClass: status, durationMs }).catch((err) =>
      console.error("usage metering failed:", err),
    );
  }
});
