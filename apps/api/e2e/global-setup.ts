import { spawn, type ChildProcess } from "node:child_process";
import { sql } from "drizzle-orm";
import { createDb } from "../src/db/client.js";

const TEST_PORT = 3999;
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/open_artifacts_dev";

const ENV = {
  ...process.env,
  NODE_ENV: "test",
  PORT: String(TEST_PORT),
  DATABASE_URL: TEST_DATABASE_URL,
  APP_ORIGIN: `http://localhost:${TEST_PORT}`,
  SESSION_SECRET: "e2e-session-secret-please-ignore-0123456789",
  IP_HASH_SALT: "e2e-salt",
  DEFAULT_KEY_TTL_DAYS: "90",
  DEFAULT_REGISTRATION_MODE: "open",
};

async function waitForHealth(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${TEST_PORT}/health`);
      if (res.ok) return;
    } catch {
      // server not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become healthy within ${timeoutMs}ms`);
}

// The API is run as a separate `tsx` process rather than importing createApp() in-process: some
// of its CJS dependencies (sanitize-html's htmlparser2, in particular) don't resolve correctly
// under Playwright's own TypeScript loader, even though they work fine under tsx/vitest/node.
export default async function globalSetup() {
  const db = createDb(TEST_DATABASE_URL);
  await db.execute(
    sql.raw(
      `truncate table "audit_log","api_usage_hourly","artifact_view_daily","artifact_views","shares","artifact_versions","artifacts","device_auth_requests","api_keys","agents","invites","org_members","orgs","sessions","users","settings" cascade`,
    ),
  );

  const child: ChildProcess = spawn("pnpm", ["exec", "tsx", "src/index.ts"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: ENV,
    stdio: "pipe",
  });

  child.stdout?.on("data", (chunk) => process.stdout.write(`[api] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[api] ${chunk}`));

  await waitForHealth();

  return async () => {
    child.kill();
  };
}
