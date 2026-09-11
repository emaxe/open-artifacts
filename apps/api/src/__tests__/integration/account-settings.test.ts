import { beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("PATCH /auth/me", () => {
  it("updates email and password when the current password is correct", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);

    const res = await app.request("/api/v1/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${user.sessionCookie}` },
      body: JSON.stringify({ email: "new-email@example.com", newPassword: "a new strong password", currentPassword: user.password }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { email: string };
    expect(body.email).toBe("new-email@example.com");

    const loginRes = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new-email@example.com", password: "a new strong password" }),
    });
    expect(loginRes.status).toBe(200);
  });

  it("rejects the update when the current password is wrong", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);

    const res = await app.request("/api/v1/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${user.sessionCookie}` },
      body: JSON.stringify({ email: "new-email@example.com", currentPassword: "totally wrong" }),
    });
    expect(res.status).toBe(401);
  });
});
