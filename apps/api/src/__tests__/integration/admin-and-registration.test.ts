import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { settings, users } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("admin route scoping", () => {
  it("keeps /admin/* superadmin-only without leaking auth requirements onto other routes", async () => {
    const app = buildTestApp();
    const { sessionCookie } = await registerAndLogin(app);
    const headers = { Cookie: `oa_session=${sessionCookie}` };

    // A regular (non-superadmin) user is forbidden from admin routes...
    const adminRes = await app.request("/api/v1/admin/stats", { headers });
    expect(adminRes.status).toBe(403);

    // ...but every ordinary authenticated route still works normally (regression guard for the
    // "wildcard middleware from one router leaks into siblings mounted at the same path" bug).
    const meRes = await app.request("/api/v1/auth/me", { headers });
    expect(meRes.status).toBe(200);

    // And fully public/unauthenticated routes are unaffected too.
    const codeRes = await app.request("/api/v1/oauth/device/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName: "probe", scopes: ["artifacts:read"] }),
    });
    expect(codeRes.status).toBe(200);
  });

  it("lets a superadmin through to /admin/*", async () => {
    const app = buildTestApp();
    const { sessionCookie, userId } = await registerAndLogin(app);
    await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, userId));

    const res = await app.request("/api/v1/admin/stats", { headers: { Cookie: `oa_session=${sessionCookie}` } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: number };
    expect(body.users).toBeGreaterThanOrEqual(1);
  });
});

describe("registration mode gating", () => {
  it("rejects self-registration without an invite when the mode is invite_only", async () => {
    const app = buildTestApp();
    const db = getTestDb();
    await db
      .insert(settings)
      .values({ key: "instance", value: { registrationMode: "invite_only" } })
      .onConflictDoUpdate({ target: settings.key, set: { value: { registrationMode: "invite_only" } } });

    const res = await app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "correct horse battery staple", name: "Nobody" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invite_required");
  });
});
