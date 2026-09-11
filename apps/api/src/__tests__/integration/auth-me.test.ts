import { beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("GET /auth/me", () => {
  it("reports the auto-provisioned main workspace and the user's own memberships only", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);

    const res = await app.request("/api/v1/auth/me", { headers: { Cookie: `oa_session=${user.sessionCookie}` } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      mainOrgId: string;
      pendingInviteCount: number;
      orgs: { orgId: string; kind: string; role: string; slug: string }[];
    };
    expect(body.mainOrgId).toBeTruthy();
    expect(body.orgs.map((o) => o.orgId).sort()).toEqual([body.mainOrgId, user.orgId].sort());
    expect(body.orgs.find((o) => o.orgId === body.mainOrgId)?.kind).toBe("main");
    expect(body.orgs.find((o) => o.orgId === body.mainOrgId)?.role).toBe("owner");
    expect(body.pendingInviteCount).toBe(0);
  });

  it("counts pending invites addressed to the user's email", async () => {
    const app = buildTestApp();
    const ownerA = await registerAndLogin(app);
    const ownerB = await registerAndLogin(app);
    const invitee = await registerAndLogin(app, { email: "counted@example.com" });

    for (const owner of [ownerA, ownerB]) {
      await app.request(`/api/v1/orgs/${owner.orgId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
        body: JSON.stringify({ email: invitee.email, role: "member" }),
      });
    }

    const res = await app.request("/api/v1/auth/me", { headers: { Cookie: `oa_session=${invitee.sessionCookie}` } });
    const body = (await res.json()) as { pendingInviteCount: number };
    expect(body.pendingInviteCount).toBe(2);
  });
});
