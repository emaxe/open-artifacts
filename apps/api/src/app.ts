import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFileSync, existsSync } from "node:fs";
import type { AppBindings } from "./types.js";
import type { Database } from "./db/client.js";
import type { Env } from "./env.js";
import { resolveIdentity } from "./middleware/auth.js";
import { usageMetering } from "./middleware/usage.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { orgRoutes } from "./routes/orgs.js";
import { agentRoutes } from "./routes/agents.js";
import { oauthDeviceRoutes } from "./routes/oauth-device.js";
import { artifactRoutes } from "./routes/artifacts.js";
import { shareRoutes } from "./routes/shares.js";
import { adminRoutes } from "./routes/admin.js";
import { publicRoutes } from "./routes/public.js";
import { mcpRoutes } from "./routes/mcp.js";

export function createApp(db: Database, env: Env) {
  const app = new Hono<AppBindings>();

  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("env", env);
    c.set("requestStartedAt", Date.now());
    return next();
  });

  if (env.NODE_ENV !== "test") app.use("*", logger());

  app.route("/", healthRoutes);
  app.route("/", publicRoutes);

  const api = new Hono<AppBindings>();
  api.use("*", resolveIdentity);
  api.use("*", usageMetering);
  api.use("*", rateLimit({ limit: 120, windowMs: 60_000 }));
  api.route("/", authRoutes);
  api.route("/", orgRoutes);
  api.route("/", agentRoutes);
  api.route("/", oauthDeviceRoutes);
  api.route("/", artifactRoutes);
  api.route("/", shareRoutes);
  api.route("/", adminRoutes);

  app.route("/api/v1", api);

  // Mounted at root (not /api/v1) since MCP is its own protocol, not a REST-versioned surface —
  // same pattern as /s/:token and /embed/:token. Shares resolveIdentity/usageMetering/rateLimit
  // with the REST API so MCP traffic gets rate-limited and shows up in admin usage stats too.
  const mcp = new Hono<AppBindings>();
  mcp.use("*", resolveIdentity);
  mcp.use("*", usageMetering);
  mcp.use("*", rateLimit({ limit: 120, windowMs: 60_000 }));
  mcp.route("/", mcpRoutes);
  app.route("/", mcp);

  const webDist = new URL("../../web/dist", import.meta.url).pathname;
  if (existsSync(webDist)) {
    app.use("/*", serveStatic({ root: webDist }));
    // SPA fallback: any remaining GET that isn't a known API/public route resolves to index.html
    // so client-side routing (e.g. /activate) works on a hard refresh.
    app.get("*", (c) => c.html(readFileSync(`${webDist}/index.html`, "utf8")));
  }

  app.notFound((c) => c.json({ error: { code: "not_found", message: "Route not found" } }, 404));

  return app;
}
