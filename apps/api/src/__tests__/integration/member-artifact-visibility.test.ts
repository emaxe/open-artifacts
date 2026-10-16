import { beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, extractCookie, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

async function inviteMember(app: ReturnType<typeof buildTestApp>, owner: { orgId: string; sessionCookie: string }, email: string) {
  const inviteRes = await app.request(`/api/v1/orgs/${owner.orgId}/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
    body: JSON.stringify({ email, role: "member" }),
  });
  const invite = (await inviteRes.json()) as { token: string };
  const res = await app.request(`/api/v1/auth/register?invite=${invite.token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery staple", name: "Member" }),
  });
  return extractCookie(res, "oa_session")!;
}

async function create(app: ReturnType<typeof buildTestApp>, cookie: string, orgId: string, extra: object = {}) {
  const res = await app.request(`/api/v1/artifacts?orgId=${orgId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${cookie}` },
    body: JSON.stringify({ title: "Doc", kind: "html", content: "<p>x</p>", ...extra }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { artifact: { id: string; visibility: string } }).artifact;
}

describe("team-visible artifacts for regular members", () => {
  it("defaults to org visibility; a member sees it in the list but can't write", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const memberCookie = await inviteMember(app, owner, "m@example.com");

    const artifact = await create(app, owner.sessionCookie, owner.orgId);
    expect(artifact.visibility).toBe("org");

    const list = await app.request(`/api/v1/artifacts?orgId=${owner.orgId}`, { headers: { Cookie: `oa_session=${memberCookie}` } });
    const listBody = (await list.json()) as { artifacts: { id: string; canWrite: boolean }[] };
    expect(listBody.artifacts.map((a) => a.id)).toContain(artifact.id);
    expect(listBody.artifacts.find((a) => a.id === artifact.id)?.canWrite).toBe(false);

    const get = await app.request(`/api/v1/artifacts/${artifact.id}`, { headers: { Cookie: `oa_session=${memberCookie}` } });
    expect(get.status).toBe(200);
    expect(((await get.json()) as { access: { write: boolean } }).access.write).toBe(false);

    const patch = await app.request(`/api/v1/artifacts/${artifact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${memberCookie}` },
      body: JSON.stringify({ title: "Hacked" }),
    });
    expect(patch.status).toBe(403);
  });

  it("hides explicitly private artifacts from members", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const memberCookie = await inviteMember(app, owner, "m@example.com");

    const artifact = await create(app, owner.sessionCookie, owner.orgId, { visibility: "private" });

    const list = await app.request(`/api/v1/artifacts?orgId=${owner.orgId}`, { headers: { Cookie: `oa_session=${memberCookie}` } });
    const listBody = (await list.json()) as { artifacts: { id: string }[] };
    expect(listBody.artifacts.map((a) => a.id)).not.toContain(artifact.id);
  });
});
