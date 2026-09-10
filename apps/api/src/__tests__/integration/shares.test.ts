import { beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

function authedHeaders(sessionCookie: string) {
  return { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` };
}

async function createArtifact(app: ReturnType<typeof buildTestApp>, orgId: string, sessionCookie: string, content = "<h1>hi</h1>") {
  const res = await app.request(`/api/v1/artifacts?orgId=${orgId}`, {
    method: "POST",
    headers: authedHeaders(sessionCookie),
    body: JSON.stringify({ title: "Shared doc", kind: "html", content, visibility: "private" }),
  });
  const body = (await res.json()) as { artifact: { id: string } };
  return body.artifact.id;
}

describe("sharing", () => {
  it("serves a public share's content unauthenticated and counts a view", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const artifactId = await createArtifact(app, orgId, sessionCookie, "<h1>public content</h1>");

    const shareRes = await app.request(`/api/v1/artifacts/${artifactId}/shares`, {
      method: "POST",
      headers: authedHeaders(sessionCookie),
      body: JSON.stringify({ mode: "public" }),
    });
    expect(shareRes.status).toBe(201);
    const share = (await shareRes.json()) as { token: string };

    // No auth header at all — this is the public route.
    const embedRes = await app.request(`/embed/${share.token}`);
    expect(embedRes.status).toBe(200);
    const html = await embedRes.text();
    expect(html).toContain("public content");
    expect(embedRes.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(embedRes.headers.get("content-security-policy")).toContain("connect-src 'none'");

    const sharesListRes = await app.request(`/api/v1/artifacts/${artifactId}/shares`, { headers: authedHeaders(sessionCookie) });
    const { shares } = (await sharesListRes.json()) as { shares: { viewCount: number }[] };
    expect(shares[0]!.viewCount).toBe(1);
  });

  it("blocks a password-protected share until the correct password is submitted", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const artifactId = await createArtifact(app, orgId, sessionCookie, "<h1>secret content</h1>");

    const shareRes = await app.request(`/api/v1/artifacts/${artifactId}/shares`, {
      method: "POST",
      headers: authedHeaders(sessionCookie),
      body: JSON.stringify({ mode: "password", password: "hunter2" }),
    });
    const share = (await shareRes.json()) as { token: string };

    const blockedRes = await app.request(`/embed/${share.token}`);
    expect(blockedRes.status).toBe(403);

    const wrongUnlock = await app.request(`/s/${share.token}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    expect(wrongUnlock.status).toBe(401);

    const rightUnlock = await app.request(`/s/${share.token}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "hunter2" }),
    });
    expect(rightUnlock.status).toBe(200);
    const unlockCookie = rightUnlock.headers.get("set-cookie")!.split(";")[0]!;

    const unlockedRes = await app.request(`/embed/${share.token}`, { headers: { Cookie: unlockCookie } });
    expect(unlockedRes.status).toBe(200);
    expect(await unlockedRes.text()).toContain("secret content");
  });

  it("denies access after a share is revoked", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const artifactId = await createArtifact(app, orgId, sessionCookie);

    const shareRes = await app.request(`/api/v1/artifacts/${artifactId}/shares`, {
      method: "POST",
      headers: authedHeaders(sessionCookie),
      body: JSON.stringify({ mode: "public" }),
    });
    const share = (await shareRes.json()) as { id: string; token: string };

    const revokeRes = await app.request(`/api/v1/shares/${share.id}`, { method: "DELETE", headers: authedHeaders(sessionCookie) });
    expect(revokeRes.status).toBe(200);

    const embedRes = await app.request(`/embed/${share.token}`);
    expect(embedRes.status).toBe(410);
  });
});
