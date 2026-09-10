import { createMiddleware } from "hono/factory";
import type { AppBindings } from "../types.js";
import { recordApiUsage } from "../services/analytics.js";

function statusClass(status: number): "2xx" | "3xx" | "4xx" | "5xx" {
  if (status < 300) return "2xx";
  if (status < 400) return "3xx";
  if (status < 500) return "4xx";
  return "5xx";
}

/** Records one usage row per agent-authenticated request. Session (human) traffic isn't metered here. */
export const usageMetering = createMiddleware<AppBindings>(async (c, next) => {
  const startedAt = Date.now();
  await next();
  const identity = c.get("identity");
  if (identity?.kind !== "agent") return;

  const db = c.get("db");
  recordApiUsage(db, {
    orgId: identity.orgId,
    agentId: identity.agentId,
    keyId: identity.keyId,
    endpoint: c.req.routePath ?? c.req.path,
    method: c.req.method,
    statusClass: statusClass(c.res.status),
    durationMs: Date.now() - startedAt,
  }).catch((err) => console.error("usage metering failed:", err));
});
