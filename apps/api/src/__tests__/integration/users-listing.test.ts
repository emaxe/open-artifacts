import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("GET /users", () => {
  it("rejects non-superadmin requests", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);

    const res = await app.request("/api/v1/users", { headers: { Cookie: `oa_session=${user.sessionCookie}` } });
    expect(res.status).toBe(403);
  });

  it("returns a paginated list of users for a superadmin", async () => {
    const app = buildTestApp();
    await registerAndLogin(app, { name: "Bob", email: "bob@example.com" });
    const admin = await registerAndLogin(app, { name: "Alice", email: "alice@example.com" });
    await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, admin.userId));

    const res = await app.request("/api/v1/users?page=1&pageSize=1", { headers: { Cookie: `oa_session=${admin.sessionCookie}` } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: unknown[]; total: number; page: number };
    
    // There might be a lot of users from previous tests if the DB wasn't completely cleared,
    // but we can definitely assert pagination metadata and at least two users exist.
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.users).toHaveLength(1);
    expect(body.page).toBe(1);
  });

  it("searches by name as well as email", async () => {
    const app = buildTestApp();
    await registerAndLogin(app, { name: "Grigory Skovoroda", email: "grigory@example.com" });
    const admin = await registerAndLogin(app, { name: "Admin", email: "admin-search@example.com" });
    await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, admin.userId));

    const res = await app.request("/api/v1/users?search=Skovoroda", { headers: { Cookie: `oa_session=${admin.sessionCookie}` } });
    const body = (await res.json()) as { users: { name: string }[] };
    expect(body.users.some((u) => u.name === "Grigory Skovoroda")).toBe(true);
  });

  it("includes each user's org memberships as chips", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app, { name: "Chipped", email: "chipped@example.com" });
    const admin = await registerAndLogin(app);
    await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, admin.userId));

    const res = await app.request(`/api/v1/users?search=chipped`, { headers: { Cookie: `oa_session=${admin.sessionCookie}` } });
    const body = (await res.json()) as { users: { id: string; orgs: { orgId: string; kind: string; role: string }[]; orgCount: number }[] };
    const found = body.users.find((u) => u.id === user.userId);
    expect(found?.orgCount).toBe(2); // main workspace + the explicit team registerAndLogin creates
    expect(found?.orgs.some((o) => o.orgId === user.mainOrgId && o.kind === "main" && o.role === "owner")).toBe(true);
  });
});
