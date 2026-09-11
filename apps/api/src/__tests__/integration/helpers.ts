import { sql } from "drizzle-orm";
import { createDb, type Database } from "../../db/client.js";
import { createApp } from "../../app.js";
import { loadEnv, resetEnvCacheForTests } from "../../env.js";
import { clearApiKeyVerifyCacheForTests } from "../../services/agents.js";
import { clearRateLimitBucketsForTests } from "../../middleware/rate-limit.js";

let db: Database | undefined;

export function getTestDb(): Database {
  if (!db) db = createDb(process.env.DATABASE_URL!);
  return db;
}

export function getTestEnv() {
  resetEnvCacheForTests();
  return loadEnv();
}

export function buildTestApp() {
  return createApp(getTestDb(), getTestEnv());
}

const TABLES = [
  "audit_log",
  "api_usage_hourly",
  "artifact_view_daily",
  "artifact_views",
  "shares",
  "artifact_versions",
  "artifacts",
  "device_auth_requests",
  "api_keys",
  "agents",
  "invites",
  "org_members",
  "orgs",
  "sessions",
  "users",
  "settings",
];

export async function resetDb() {
  const database = getTestDb();
  await database.execute(sql.raw(`truncate table ${TABLES.map((t) => `"${t}"`).join(", ")} cascade`));
  clearApiKeyVerifyCacheForTests();
  clearRateLimitBucketsForTests();
}

/** Extracts a single cookie's value from a Set-Cookie response header. */
export function extractCookie(res: Response, name: string): string | undefined {
  const raw = res.headers.get("set-cookie");
  if (!raw) return undefined;
  const match = new RegExp(`${name}=([^;]+)`).exec(raw);
  return match?.[1];
}

/**
 * Registers a fresh user (who now always gets an auto-provisioned "main" workspace) and, on top
 * of that, creates one more explicit team org — most existing tests are written against "the
 * org this user owns" and expect exactly one, so `orgId` here is that explicit team, kept
 * distinct from `mainOrgId` so callers can tell them apart where it matters.
 */
export async function registerAndLogin(app: ReturnType<typeof buildTestApp>, overrides: Partial<{ email: string; password: string; name: string }> = {}) {
  const email = overrides.email ?? `user-${Math.random().toString(36).slice(2)}@example.com`;
  const password = overrides.password ?? "correct horse battery staple";
  const name = overrides.name ?? "Test User";

  const res = await app.request("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { userId: string; mainOrgId: string };
  const sessionCookie = extractCookie(res, "oa_session")!;

  const orgRes = await app.request("/api/v1/orgs", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
    body: JSON.stringify({ name: `${name}'s workspace` }),
  });
  if (orgRes.status !== 201) throw new Error(`org creation failed: ${orgRes.status} ${await orgRes.text()}`);
  const orgBody = (await orgRes.json()) as { id: string };

  return { userId: body.userId, mainOrgId: body.mainOrgId, orgId: orgBody.id, sessionCookie, email, password };
}
