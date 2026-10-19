import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

type App = ReturnType<typeof buildTestApp>;
type Session = { sessionCookie: string; orgId: string; userId?: string };

const json = (cookie: string) => ({ "Content-Type": "application/json", Cookie: `oa_session=${cookie}` });

async function makeSuperadmin(userId: string) {
  await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, userId));
}
const patchInstance = (app: App, s: Session, body: object) =>
  app.request("/api/v1/admin/settings", { method: "PATCH", headers: json(s.sessionCookie), body: JSON.stringify(body) });
const patchOrg = (app: App, s: Session, body: object) =>
  app.request(`/api/v1/orgs/${s.orgId}`, { method: "PATCH", headers: json(s.sessionCookie), body: JSON.stringify(body) });
const createArtifact = (app: App, s: Session, body: object = {}) =>
  app.request(`/api/v1/artifacts?orgId=${s.orgId}`, {
    method: "POST",
    headers: json(s.sessionCookie),
    body: JSON.stringify({ title: "t", kind: "markdown", content: "# Hi", ...body }),
  });
const patchArtifact = (app: App, s: Session, id: string, body: object) =>
  app.request(`/api/v1/artifacts/${id}`, { method: "PATCH", headers: json(s.sessionCookie), body: JSON.stringify(body) });
const preview = async (app: App, s: Session, id: string) =>
  (await app.request(`/api/v1/artifacts/${id}/preview`, { headers: { Cookie: `oa_session=${s.sessionCookie}` } })).text();
const detail = async (app: App, s: Session, id: string) =>
  (await (await app.request(`/api/v1/artifacts/${id}`, { headers: { Cookie: `oa_session=${s.sessionCookie}` } })).json()) as {
    artifact: { theme: string | null; width: string | null; font: string | null };
    effectiveTheme: string;
  };

// Distinguishing marker per theme: their accent colour in light mode.
const ACCENT = { sand: "#4f6238", graphite: "#3b5b8c", ocean: "#0b6e8a", editorial: "#a9411f", terminal: "#087034" } as const;

async function setup() {
  const app = buildTestApp();
  const s = await registerAndLogin(app);
  await makeSuperadmin(s.userId!);
  return { app, s: s as Session };
}

describe("artifact theme hierarchy: artifact → team → service", () => {
  it("defaults to sand when nothing is configured", async () => {
    const { app, s } = await setup();
    const { artifact } = (await (await createArtifact(app, s)).json()) as { artifact: { id: string; theme: string | null } };
    expect(artifact.theme).toBeNull();
    expect((await detail(app, s, artifact.id)).effectiveTheme).toBe("sand");
    expect(await preview(app, s, artifact.id)).toContain(`--accent:${ACCENT.sand}`);
  });

  it("the service theme applies to inheriting artifacts, and changing it re-colours them with no republish", async () => {
    const { app, s } = await setup();
    const { artifact } = (await (await createArtifact(app, s)).json()) as { artifact: { id: string } };
    expect((await patchInstance(app, s, { artifactTheme: "graphite" })).status).toBe(200);
    expect(await preview(app, s, artifact.id)).toContain(`--accent:${ACCENT.graphite}`);
    await patchInstance(app, s, { artifactTheme: "terminal" });
    expect(await preview(app, s, artifact.id)).toContain(`--accent:${ACCENT.terminal}`);
  });

  it("a team theme overrides the service, and null reverts to inheriting", async () => {
    const { app, s } = await setup();
    await patchInstance(app, s, { artifactTheme: "graphite" });
    const { artifact } = (await (await createArtifact(app, s)).json()) as { artifact: { id: string } };

    expect((await patchOrg(app, s, { theme: "editorial" })).status).toBe(200);
    expect((await detail(app, s, artifact.id)).effectiveTheme).toBe("editorial");
    expect(await preview(app, s, artifact.id)).toContain(`--accent:${ACCENT.editorial}`);

    expect((await patchOrg(app, s, { theme: null })).status).toBe(200);
    expect((await detail(app, s, artifact.id)).effectiveTheme).toBe("graphite");
  });

  it("an artifact theme overrides the team, and null reverts to inheriting", async () => {
    const { app, s } = await setup();
    await patchOrg(app, s, { theme: "editorial" });
    const res = await createArtifact(app, s, { theme: "ocean" });
    expect(res.status).toBe(201);
    const { artifact } = (await res.json()) as { artifact: { id: string; theme: string } };
    expect(artifact.theme).toBe("ocean");
    expect(await preview(app, s, artifact.id)).toContain(`--accent:${ACCENT.ocean}`);

    expect((await patchArtifact(app, s, artifact.id, { theme: null })).status).toBe(200);
    expect((await detail(app, s, artifact.id)).effectiveTheme).toBe("editorial");
  });

  it("rejects unknown theme ids at every level", async () => {
    const { app, s } = await setup();
    expect((await createArtifact(app, s, { theme: "neon" })).status).toBe(400);
    const { artifact } = (await (await createArtifact(app, s)).json()) as { artifact: { id: string } };
    expect((await patchArtifact(app, s, artifact.id, { theme: "neon" })).status).toBe(400);
    expect((await patchOrg(app, s, { theme: "neon" })).status).toBe(400);
    expect((await patchInstance(app, s, { artifactTheme: "neon" })).status).toBe(400);
  });

  it("does not allow clearing the service theme", async () => {
    const { app, s } = await setup();
    expect((await patchInstance(app, s, { artifactTheme: null })).status).toBe(400);
  });

  it("exposes the team's raw, global and effective theme", async () => {
    const { app, s } = await setup();
    await patchInstance(app, s, { artifactTheme: "ocean" });
    const body = (await (await app.request(`/api/v1/orgs/${s.orgId}`, { headers: { Cookie: `oa_session=${s.sessionCookie}` } })).json()) as Record<string, unknown>;
    expect(body).toMatchObject({ theme: null, globalTheme: "ocean", effectiveTheme: "ocean" });
    await patchOrg(app, s, { theme: "terminal" });
    const after = (await (await app.request(`/api/v1/orgs/${s.orgId}`, { headers: { Cookie: `oa_session=${s.sessionCookie}` } })).json()) as Record<string, unknown>;
    expect(after).toMatchObject({ theme: "terminal", globalTheme: "ocean", effectiveTheme: "terminal" });
  });
});

describe("artifact font", () => {
  it("is stored per artifact, overrides the theme's font in the page, and clearable", async () => {
    const { app, s } = await setup();
    const { artifact } = (await (await createArtifact(app, s, { theme: "editorial", font: "inter" })).json()) as { artifact: { id: string; font: string } };
    expect(artifact.font).toBe("inter");
    const html = await preview(app, s, artifact.id);
    expect(html).toContain('--font-sans:"Inter"');
    expect(html.lastIndexOf("--font-sans:")).toBeGreaterThan(html.indexOf('"Source Serif 4"'));

    expect((await patchArtifact(app, s, artifact.id, { font: "jetbrains-mono" })).status).toBe(200);
    expect(await preview(app, s, artifact.id)).toContain('--font-sans:"JetBrains Mono"');

    expect((await patchArtifact(app, s, artifact.id, { font: null })).status).toBe(200);
    expect((await detail(app, s, artifact.id)).artifact.font).toBeNull();
    expect(await preview(app, s, artifact.id)).toContain('--font-sans:"Source Serif 4"');
  });
  it("rejects unknown fonts", async () => {
    const { app, s } = await setup();
    expect((await createArtifact(app, s, { font: "comic-sans" })).status).toBe(400);
  });
});

describe("artifact width", () => {
  it("is stored per artifact, applied to the rendered page, and clearable", async () => {
    const { app, s } = await setup();
    const { artifact } = (await (await createArtifact(app, s, { width: "full" })).json()) as { artifact: { id: string; width: string } };
    expect(artifact.width).toBe("full");
    expect(await preview(app, s, artifact.id)).toContain("--oa-main-w:100% !important");

    expect((await patchArtifact(app, s, artifact.id, { width: "narrow" })).status).toBe(200);
    expect(await preview(app, s, artifact.id)).toContain("--oa-main-w:720px !important");

    expect((await patchArtifact(app, s, artifact.id, { width: null })).status).toBe(200);
    expect((await detail(app, s, artifact.id)).artifact.width).toBeNull();
    expect(await preview(app, s, artifact.id)).not.toContain("--oa-main-w");
  });

  it("rejects unknown widths", async () => {
    const { app, s } = await setup();
    expect((await createArtifact(app, s, { width: "huge" })).status).toBe(400);
  });
});

describe("viewer-chosen appearance on a share link", () => {
  async function share(app: App, s: Session, artifactId: string) {
    const res = await app.request(`/api/v1/artifacts/${artifactId}/shares`, {
      method: "POST",
      headers: json(s.sessionCookie),
      body: JSON.stringify({ mode: "public" }),
    });
    expect(res.status).toBe(201);
    return ((await res.json()) as { token: string }).token;
  }
  async function make(app: App, s: Session, body: object = {}) {
    const { artifact } = (await (await createArtifact(app, s, body)).json()) as { artifact: { id: string } };
    return { id: artifact.id, token: await share(app, s, artifact.id) };
  }
  const embed = async (app: App, token: string, qs = "") => (await app.request(`/embed/${token}${qs}`)).text();

  it("applies the viewer's theme, colour scheme and width on top of the author's", async () => {
    const { app, s } = await setup();
    const { token } = await make(app, s, { theme: "ocean" });
    const stored = await embed(app, token);
    expect(stored).toContain(`--accent:${ACCENT.ocean}`);
    expect(stored).toContain("prefers-color-scheme:dark"); // follows the OS by default

    const mine = await embed(app, token, "?theme=terminal&scheme=dark&width=full");
    expect(mine).toContain("color-scheme:dark;");
    expect(mine).toContain("--bg:#0a0e0b"); // terminal, dark
    expect(mine).toContain("--oa-main-w:100% !important");
    expect(mine).not.toContain(`--accent:${ACCENT.ocean}`);
  });

  it("ignores values it does not recognise instead of echoing them", async () => {
    const { app, s } = await setup();
    const { token } = await make(app, s, { theme: "ocean" });
    const out = await embed(app, token, "?theme=evil%3Bx&scheme=%3Cb%3E&width=huge");
    expect(out).toContain(`--accent:${ACCENT.ocean}`);
    expect(out).not.toContain("evil");
    expect(out).not.toContain("<b>");
  });

  it("is ignored when the author locked the appearance, and the shell then shows no picker", async () => {
    const { app, s } = await setup();
    const open = await make(app, s, { theme: "ocean" });
    const locked = await make(app, s, { theme: "ocean", lockAppearance: true });

    const openShell = await (await app.request(`/s/${open.token}`)).text();
    expect(openShell).toContain('class="oa-pop oa-style"');
    expect(openShell).toContain("data-src=");
    const lockedShell = await (await app.request(`/s/${locked.token}`)).text();
    expect(lockedShell).not.toContain('class="oa-pop oa-style"');
    expect(lockedShell).toContain(`src="/embed/${locked.token}?v=1"`);

    const out = await embed(app, locked.token, "?theme=terminal&scheme=dark&width=full");
    expect(out).toContain(`--accent:${ACCENT.ocean}`);
    expect(out).not.toContain("--oa-main-w");
  });

  it("lockAppearance can be switched on and off later", async () => {
    const { app, s } = await setup();
    const { id, token } = await make(app, s);
    expect((await patchArtifact(app, s, id, { lockAppearance: true })).status).toBe(200);
    expect(await embed(app, token, "?theme=terminal")).not.toContain("#087034");
    expect((await patchArtifact(app, s, id, { lockAppearance: false })).status).toBe(200);
    expect(await embed(app, token, "?theme=terminal")).toContain("#087034");
  });

  it("offers no picker for hand-written html, but does for constructor pages", async () => {
    const { app, s } = await setup();
    const custom = await make(app, s, { kind: "html", content: "<h1>mine</h1>" });
    expect(await (await app.request(`/s/${custom.token}`)).text()).not.toContain('class="oa-pop oa-style"');
    const built = await make(app, s, {
      kind: "html",
      content: '<!doctype html><html><head><meta name="oa-generator" content="constructor"></head><body><main>x</main></body></html>',
    });
    expect(await (await app.request(`/s/${built.token}`)).text()).toContain('class="oa-pop oa-style"');
  });

  it("a re-render requested by the picker (r=1) is not counted as another view", async () => {
    const { app, s } = await setup();
    const { id, token } = await make(app, s);
    const views = async () => {
      const res = await app.request(`/api/v1/artifacts/${id}/shares`, { headers: { Cookie: `oa_session=${s.sessionCookie}` } });
      return ((await res.json()) as { shares: { viewCount: number }[] }).shares[0]!.viewCount;
    };
    await embed(app, token, "?v=1");
    await embed(app, token, "?v=1&theme=ocean&r=1");
    await embed(app, token, "?v=1&scheme=dark&r=1");
    await new Promise((r) => setTimeout(r, 150)); // counters are fire-and-forget
    expect(await views()).toBe(1);
  });
});
