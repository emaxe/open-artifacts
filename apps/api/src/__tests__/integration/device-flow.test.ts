import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { apiKeys } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("OAuth device flow", () => {
  it("issues a usable API key after the human approves it in the browser", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);

    const codeRes = await app.request("/api/v1/oauth/device/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName: "test-bot", scopes: ["artifacts:read", "artifacts:write"] }),
    });
    expect(codeRes.status).toBe(200);
    const device = (await codeRes.json()) as { device_code: string; user_code: string; interval: number };

    // Poll before approval: pending.
    const pendingPoll = await app.request("/api/v1/oauth/device/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceCode: device.device_code, grantType: "urn:ietf:params:oauth:grant-type:device_code" }),
    });
    expect(pendingPoll.status).toBe(428);

    // Human approves in the browser (authenticated session).
    const approveRes = await app.request("/api/v1/oauth/device/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
      body: JSON.stringify({ userCode: device.user_code, orgId }),
    });
    expect(approveRes.status).toBe(200);

    // Poll again: should now succeed and issue a key.
    const tokenRes = await app.request("/api/v1/oauth/device/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceCode: device.device_code, grantType: "urn:ietf:params:oauth:grant-type:device_code" }),
    });
    expect(tokenRes.status).toBe(200);
    const tokenBody = (await tokenRes.json()) as { api_key: string; org_id: string };
    expect(tokenBody.org_id).toBe(orgId);
    expect(tokenBody.api_key).toMatch(/^oa_live_/);

    // The issued key actually authenticates against the artifacts API.
    const listRes = await app.request(`/api/v1/artifacts?orgId=${orgId}`, {
      headers: { Authorization: `Bearer ${tokenBody.api_key}` },
    });
    expect(listRes.status).toBe(200);

    // Replaying the same device_code a second time must not mint a second key (one-time use).
    const replayRes = await app.request("/api/v1/oauth/device/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceCode: device.device_code, grantType: "urn:ietf:params:oauth:grant-type:device_code" }),
    });
    expect(replayRes.status).toBe(400);
  });

  it("rejects an expired API key with 401 key_expired", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);

    const codeRes = await app.request("/api/v1/oauth/device/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName: "expiring-bot", scopes: ["artifacts:read"] }),
    });
    const device = (await codeRes.json()) as { device_code: string; user_code: string };

    await app.request("/api/v1/oauth/device/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
      body: JSON.stringify({ userCode: device.user_code, orgId }),
    });

    const tokenRes = await app.request("/api/v1/oauth/device/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceCode: device.device_code, grantType: "urn:ietf:params:oauth:grant-type:device_code" }),
    });
    const { api_key: apiKey } = (await tokenRes.json()) as { api_key: string };

    // Force the key into the past directly in the DB (simulating natural expiry).
    const db = getTestDb();
    const prefix = apiKey.split("_")[2]!;
    await db.update(apiKeys).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(apiKeys.prefix, prefix));

    const res = await app.request(`/api/v1/artifacts?orgId=${orgId}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("key_expired");
  });

  it("issues a personal key spanning all the approver's orgs when grantKind is 'user'", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app); // main org + one team org

    const codeRes = await app.request("/api/v1/oauth/device/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName: "my-laptop", scopes: ["artifacts:read", "artifacts:write"], grantKind: "user" }),
    });
    const device = (await codeRes.json()) as { device_code: string; user_code: string };

    // The approval page doesn't need (or accept picking) an org for a personal-key request.
    const pendingRes = await app.request(`/api/v1/oauth/device/pending?code=${device.user_code}`, {
      headers: { Cookie: `oa_session=${user.sessionCookie}` },
    });
    expect(((await pendingRes.json()) as { grantKind: string }).grantKind).toBe("user");

    const approveRes = await app.request("/api/v1/oauth/device/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${user.sessionCookie}` },
      body: JSON.stringify({ userCode: device.user_code }), // no orgId
    });
    expect(approveRes.status).toBe(200);

    const tokenRes = await app.request("/api/v1/oauth/device/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceCode: device.device_code, grantType: "urn:ietf:params:oauth:grant-type:device_code" }),
    });
    expect(tokenRes.status).toBe(200);
    const tokenBody = (await tokenRes.json()) as { api_key: string; grant_kind: string; org_id: string | null; agent_id: string | null; user_id: string };
    expect(tokenBody.grant_kind).toBe("user");
    expect(tokenBody.org_id).toBeNull();
    expect(tokenBody.agent_id).toBeNull();
    expect(tokenBody.user_id).toBe(user.userId);

    // Works across both of the approver's orgs, not just one.
    const meOrgsRes = await app.request("/api/v1/me/orgs", { headers: { Authorization: `Bearer ${tokenBody.api_key}` } });
    const meOrgsBody = (await meOrgsRes.json()) as { orgs: { orgId: string }[] };
    expect(meOrgsBody.orgs.map((o) => o.orgId).sort()).toEqual([user.mainOrgId, user.orgId].sort());
  });

  it("rejects an unapproved / denied device code with access_denied", async () => {
    const app = buildTestApp();
    const { sessionCookie } = await registerAndLogin(app);

    const codeRes = await app.request("/api/v1/oauth/device/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName: "denied-bot", scopes: ["artifacts:read"] }),
    });
    const device = (await codeRes.json()) as { device_code: string; user_code: string };

    await app.request("/api/v1/oauth/device/deny", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
      body: JSON.stringify({ userCode: device.user_code }),
    });

    const tokenRes = await app.request("/api/v1/oauth/device/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceCode: device.device_code, grantType: "urn:ietf:params:oauth:grant-type:device_code" }),
    });
    expect(tokenRes.status).toBe(403);
  });
});
