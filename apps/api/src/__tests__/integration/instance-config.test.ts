import { beforeEach, describe, expect, it } from "vitest";
import { settings } from "../../db/schema.js";
import { buildTestApp, getTestDb, getTestEnv, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("GET /api/v1/instance/config", () => {
  it("is reachable without authentication and reflects the configured default", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/v1/instance/config");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    // Regression guard: this must stay a minimal, deliberately-picked surface — never the whole
    // InstanceSettings object (cdnAllowlist, quotas, TTLs are admin-only, see routes/admin.ts).
    expect(Object.keys(body)).toEqual(["registrationMode"]);
    expect(body.registrationMode).toBe(getTestEnv().DEFAULT_REGISTRATION_MODE);
  });

  it("reflects a registrationMode written to instance settings", async () => {
    const app = buildTestApp();
    const db = getTestDb();
    await db
      .insert(settings)
      .values({ key: "instance", value: { registrationMode: "open" } })
      .onConflictDoUpdate({ target: settings.key, set: { value: { registrationMode: "open" } } });

    const res = await app.request("/api/v1/instance/config");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { registrationMode: string };
    expect(body.registrationMode).toBe("open");
  });
});
