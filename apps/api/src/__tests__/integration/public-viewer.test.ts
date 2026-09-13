import { beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, extractCookie, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

function authedHeaders(sessionCookie: string) {
  return { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` };
}

async function createArtifact(
  app: ReturnType<typeof buildTestApp>,
  orgId: string,
  sessionCookie: string,
  overrides: Partial<{ title: string; content: string; visibility: "private" | "org" }> = {},
) {
  const res = await app.request(`/api/v1/artifacts?orgId=${orgId}`, {
    method: "POST",
    headers: authedHeaders(sessionCookie),
    body: JSON.stringify({
      title: overrides.title ?? "Shared doc",
      kind: "html",
      content: overrides.content ?? "<h1>v1 content</h1>",
      visibility: overrides.visibility ?? "private",
    }),
  });
  const body = (await res.json()) as { artifact: { id: string } };
  return body.artifact.id;
}

/** Publishes a new version by content, using the optimistic-lock (`If-Match`) flow the web UI uses. */
async function pushVersion(app: ReturnType<typeof buildTestApp>, artifactId: string, sessionCookie: string, content: string) {
  const current = await app.request(`/api/v1/artifacts/${artifactId}`, { headers: authedHeaders(sessionCookie) });
  const { contentHash } = (await current.json()) as { contentHash: string };
  const res = await app.request(`/api/v1/artifacts/${artifactId}`, {
    method: "PATCH",
    headers: { ...authedHeaders(sessionCookie), "If-Match": contentHash },
    body: JSON.stringify({ content }),
  });
  expect(res.status).toBe(200);
}

async function createShareForArtifact(
  app: ReturnType<typeof buildTestApp>,
  artifactId: string,
  sessionCookie: string,
  body: { mode?: "public" | "password" | "team"; password?: string; versionNo?: number } = {},
) {
  const res = await app.request(`/api/v1/artifacts/${artifactId}/shares`, {
    method: "POST",
    headers: authedHeaders(sessionCookie),
    body: JSON.stringify({ mode: "public", ...body }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; token: string };
}

async function inviteAndRegister(
  app: ReturnType<typeof buildTestApp>,
  owner: { orgId: string; sessionCookie: string },
  email: string,
  role: "owner" | "admin" | "member" | "viewer" = "member",
) {
  const inviteRes = await app.request(`/api/v1/orgs/${owner.orgId}/invites`, {
    method: "POST",
    headers: authedHeaders(owner.sessionCookie),
    body: JSON.stringify({ email, role }),
  });
  expect(inviteRes.status).toBe(201);
  const invite = (await inviteRes.json()) as { token: string };
  const res = await app.request(`/api/v1/auth/register?invite=${invite.token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery staple", name: "Teammate" }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { userId: string };
  const sessionCookie = extractCookie(res, "oa_session")!;
  return { userId: body.userId, sessionCookie };
}

describe("GET /s/:token — audience-gated viewer panel", () => {
  it("shows an anonymous visitor the minimal panel with no manager/member metadata", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { title: "Public Doc" });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const res = await app.request(`/s/${share.token}`);
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("Public Doc");
    expect(html).toContain("Version 1");
    expect(html).not.toContain("/t/");
    expect(html).not.toContain("Open in workspace");
    expect(html).not.toMatch(/\d+ views?/);
    expect(html).not.toContain(owner.email);
  });

  it("shows the artifact's owner the full manager panel", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { title: "Owner's Doc" });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const res = await app.request(`/s/${share.token}`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain(`/t/${owner.orgId}/artifacts/${artifactId}`);
    expect(html).toContain("Open in workspace");
    expect(html).toContain('<details class="oa-versions"');
  });

  it("shows an admin of the same team the full manager panel even though they don't own the artifact", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const admin = await inviteAndRegister(app, owner, "admin@example.com", "admin");
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { title: "Team Doc" });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const res = await app.request(`/s/${share.token}`, { headers: { Cookie: `oa_session=${admin.sessionCookie}` } });
    const html = await res.text();
    expect(html).toContain("Open in workspace");
  });

  it("shows a plain teammate the member panel (author/team, no version picker) on a private artifact they don't own", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const member = await inviteAndRegister(app, owner, "member@example.com", "member");
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { title: "Private Doc", visibility: "private" });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const res = await app.request(`/s/${share.token}`, { headers: { Cookie: `oa_session=${member.sessionCookie}` } });
    const html = await res.text();

    // Member panel: sees who made it and which team, but has no write access to this private
    // artifact, so no dead link into a cabinet page that would just 403, and no version controls.
    expect(html).not.toContain("Open in workspace");
    expect(html).not.toContain('<details class="oa-versions"');
  });

  it("shows a plain teammate the cabinet link when the artifact is org-visible", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const member = await inviteAndRegister(app, owner, "member2@example.com", "member");
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { title: "Org Doc", visibility: "org" });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const res = await app.request(`/s/${share.token}`, { headers: { Cookie: `oa_session=${member.sessionCookie}` } });
    const html = await res.text();
    expect(html).toContain(`/t/${owner.orgId}/artifacts/${artifactId}`);
    expect(html).not.toContain('<details class="oa-versions"');
  });

  it("shows the minimal panel to a logged-in user from a completely unrelated team", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const stranger = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { title: "Doc" });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const res = await app.request(`/s/${share.token}`, { headers: { Cookie: `oa_session=${stranger.sessionCookie}` } });
    const html = await res.text();
    expect(html).not.toContain("Open in workspace");
  });
});

describe("GET /s/:token and /embed/:token — version selection via ?v=", () => {
  it("lets the manager view an older version via ?v=, without changing what anyone else sees", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { content: "<p>version one</p>" });
    await pushVersion(app, artifactId, owner.sessionCookie, "<p>version two</p>");
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const ownerEmbed = await app.request(`/embed/${share.token}?v=1`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    expect(await ownerEmbed.text()).toContain("version one");

    const anonEmbed = await app.request(`/embed/${share.token}?v=1`);
    expect(await anonEmbed.text()).toContain("version two"); // ?v= silently ignored, not a 403
    expect(anonEmbed.status).toBe(200);
  });

  it("falls back to the default version when ?v= names a version that doesn't exist", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { content: "<p>only version</p>" });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const res = await app.request(`/embed/${share.token}?v=999`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("only version");
  });

  it.each(["abc", "-1", "0", "1.5"])("ignores an invalid ?v=%s and falls back to the default", async (raw) => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { content: "<p>default content</p>" });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const res = await app.request(`/embed/${share.token}?v=${encodeURIComponent(raw)}`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("default content");
  });

  it("a pinned share always shows its pinned version, even after a newer one is published", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { content: "<p>pinned content</p>" });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie, { versionNo: 1 });
    await pushVersion(app, artifactId, owner.sessionCookie, "<p>newer content</p>");

    const anon = await app.request(`/embed/${share.token}`);
    expect(await anon.text()).toContain("pinned content");
  });
});

describe("GET /s/:token — link lifecycle", () => {
  it("410s a revoked share even for the artifact's own owner", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie);
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const revokeRes = await app.request(`/api/v1/shares/${share.id}`, { method: "DELETE", headers: authedHeaders(owner.sessionCookie) });
    expect(revokeRes.status).toBe(200);

    const res = await app.request(`/s/${share.token}`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    expect(res.status).toBe(410);
  });

  it("404s an unknown token", async () => {
    const app = buildTestApp();
    const res = await app.request(`/s/does-not-exist`);
    expect(res.status).toBe(404);
  });
});

describe("GET /embed/:token — view counting", () => {
  it("counts an anonymous view but not a manager's own view", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie);
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    await app.request(`/embed/${share.token}`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    await app.request(`/embed/${share.token}`);

    const sharesRes = await app.request(`/api/v1/artifacts/${artifactId}/shares`, { headers: authedHeaders(owner.sessionCookie) });
    const { shares } = (await sharesRes.json()) as { shares: { viewCount: number }[] };
    expect(shares[0]!.viewCount).toBe(1);
  });
});

describe("GET /s/:token — XSS resistance", () => {
  it("escapes a hostile title instead of rendering it as markup", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, {
      title: `</title><img src=x onerror=alert(1)>`,
    });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const res = await app.request(`/s/${share.token}`);
    const html = await res.text();
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;img");
  });

  it("escapes a hostile teammate name shown in the member/manager panel", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app, { name: `<script>alert(1)</script>` });
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { title: "Doc" });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const res = await app.request(`/s/${share.token}`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    const html = await res.text();
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

describe("GET /s/:token — CSP and caching headers", () => {
  it("carries a nonce-based CSP and no-store caching directives", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie);
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const res = await app.request(`/s/${share.token}`);
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toContain("frame-src 'self'");
    expect(csp).toMatch(/script-src 'nonce-[^']+'/);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("vary")).toContain("Cookie");

    const nonceMatch = /script-src 'nonce-([^']+)'/.exec(csp)!;
    const html = await res.text();
    expect(html).toContain(`nonce="${nonceMatch[1]}"`);
  });

  it("issues a fresh nonce on every request", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie);
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const [a, b] = await Promise.all([app.request(`/s/${share.token}`), app.request(`/s/${share.token}`)]);
    const nonceOf = (res: Response) => /script-src 'nonce-([^']+)'/.exec(res.headers.get("content-security-policy")!)![1];
    expect(nonceOf(a)).not.toBe(nonceOf(b));
  });
});

describe("GET /s/:token/download — source download", () => {
  it("serves the current version as text/plain with a safe attachment filename", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, {
      title: "My Report",
      content: "<h1>the exact content</h1>",
    });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const res = await app.request(`/s/${share.token}/download`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-disposition")).toContain("attachment;");
    expect(res.headers.get("content-disposition")).toContain("my-report-v1.html");
    expect(await res.text()).toBe("<h1>the exact content</h1>");
  });

  it("never returns a header containing raw CR/LF or quotes from a hostile title", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, {
      title: `a"b\r\nX-Evil: 1`,
    });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const res = await app.request(`/s/${share.token}/download`);
    const disposition = res.headers.get("content-disposition")!;
    expect(disposition).not.toMatch(/[\r\n]/);
    expect(res.headers.get("x-evil")).toBeNull();
  });

  it("is available to an anonymous visitor", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie);
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const res = await app.request(`/s/${share.token}/download`);
    expect(res.status).toBe(200);
  });

  it("honors ?v= for a manager but not for an anonymous visitor", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { content: "<p>v1</p>" });
    await pushVersion(app, artifactId, owner.sessionCookie, "<p>v2</p>");
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);

    const ownerDownload = await app.request(`/s/${share.token}/download?v=1`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    expect(await ownerDownload.text()).toBe("<p>v1</p>");

    const anonDownload = await app.request(`/s/${share.token}/download?v=1`);
    expect(await anonDownload.text()).toBe("<p>v2</p>");
  });

  it("410s once the share is revoked", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie);
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie);
    await app.request(`/api/v1/shares/${share.id}`, { method: "DELETE", headers: authedHeaders(owner.sessionCookie) });

    const res = await app.request(`/s/${share.token}/download`);
    expect(res.status).toBe(410);
  });
});

describe("GET /s/:token — password-protected shares", () => {
  it("shows the password form (no artifact metadata) before unlocking, even to the owner", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { title: "Secret Doc" });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie, { mode: "password", password: "hunter2" });

    const res = await app.request(`/s/${share.token}`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Password required");
    expect(html).not.toContain("Secret Doc");
  });

  it("shows the full panel after unlocking", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { title: "Secret Doc" });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie, { mode: "password", password: "hunter2" });

    const unlockRes = await app.request(`/s/${share.token}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "hunter2" }),
    });
    const unlockCookie = unlockRes.headers.get("set-cookie")!.split(";")[0]!;

    const res = await app.request(`/s/${share.token}`, { headers: { Cookie: unlockCookie } });
    const html = await res.text();
    expect(html).toContain("Secret Doc");
  });
});

describe("GET /s/:token — team-only shares", () => {
  it("redirects an anonymous visitor to login", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie);
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie, { mode: "team" });

    const res = await app.request(`/s/${share.token}`, { headers: { Accept: "text/html" }, redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login?next=");
  });

  it("shows a 403 restricted page (without artifact metadata) to a logged-in non-member", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const stranger = await registerAndLogin(app);
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { title: "Team Only Doc" });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie, { mode: "team" });

    const res = await app.request(`/s/${share.token}`, { headers: { Cookie: `oa_session=${stranger.sessionCookie}` } });
    expect(res.status).toBe(403);
    const html = await res.text();
    expect(html).not.toContain("Team Only Doc");
  });

  it("shows the member panel to a logged-in team member without write access", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const member = await inviteAndRegister(app, owner, "teammember@example.com", "member");
    const artifactId = await createArtifact(app, owner.orgId, owner.sessionCookie, { title: "Team Only Doc", visibility: "org" });
    const share = await createShareForArtifact(app, artifactId, owner.sessionCookie, { mode: "team" });

    const res = await app.request(`/s/${share.token}`, { headers: { Cookie: `oa_session=${member.sessionCookie}` } });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Team Only Doc");
    expect(html).not.toContain('<details class="oa-versions"');
  });
});
