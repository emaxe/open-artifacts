import { describe, expect, it } from "vitest";
import {
  renderViewerShell,
  renderPasswordFormPage,
  renderRestrictedPage,
  renderErrorPage,
  type ViewerShellModel,
} from "../../views/viewer-shell.js";

type AnonVm = Extract<ViewerShellModel, { audience: "anon" }>;
type MemberVm = Extract<ViewerShellModel, { audience: "member" }>;
type ManagerVm = Extract<ViewerShellModel, { audience: "manager" }>;

const NONCE = "test-nonce-123";
const XSS = `</title><img src=x onerror=alert(1)>`;

interface BaseOverrides {
  title: string;
  kind: "html" | "markdown" | "svg" | "mermaid";
  versionNo: number;
  versionDate: Date;
  embedSrc: string;
  downloadHref: string;
  canonicalHref: string;
}

function baseFields(overrides: Partial<BaseOverrides> = {}): BaseOverrides {
  return {
    title: "My Artifact",
    kind: "html",
    versionNo: 2,
    versionDate: new Date("2026-01-01T00:00:00Z"),
    embedSrc: "/embed/tok123?v=2",
    downloadHref: "/s/tok123/download?v=2",
    canonicalHref: "/s/tok123",
    ...overrides,
  };
}

function anonVm(overrides: Partial<BaseOverrides> = {}): AnonVm {
  return { audience: "anon", ...baseFields(overrides) };
}

function memberVm(overrides: Partial<BaseOverrides & { authorName: string; orgName: string; cabinetHref: string | null }> = {}): MemberVm {
  const { authorName = "Jane Doe", orgName = "Acme Team", cabinetHref = "/t/org1/artifacts/art1", ...base } = overrides;
  return { audience: "member", ...baseFields(base), authorName, orgName, cabinetHref };
}

function managerVm(overrides: Partial<BaseOverrides & Omit<ManagerVm, "audience">> = {}): ManagerVm {
  const {
    authorName = "Jane Doe",
    orgName = "Acme Team",
    cabinetHref = "/t/org1/artifacts/art1",
    description = "A description",
    versionMessage = "Fixed the bug",
    sizeBytes = 2048,
    expiresAt = null,
    viewCount = 7,
    versions = [
      { versionNo: 2, createdAt: new Date("2026-01-01T00:00:00Z"), message: "Fixed the bug", isCurrent: true, isPinned: false, isActive: true, href: "/s/tok123?v=2" },
      { versionNo: 1, createdAt: new Date("2025-12-01T00:00:00Z"), message: null, isCurrent: false, isPinned: false, isActive: false, href: "/s/tok123?v=1" },
    ],
    versionsTruncated = false,
    nonDefaultNotice = null,
    shareId = "share1",
    shareMode = "team",
    allowedModes = ["team", "password", "public"],
    ...base
  } = overrides;
  return {
    audience: "manager",
    ...baseFields(base),
    authorName,
    orgName,
    cabinetHref,
    description,
    versionMessage,
    sizeBytes,
    expiresAt,
    viewCount,
    versions,
    versionsTruncated,
    nonDefaultNotice,
    shareId,
    shareMode,
    allowedModes,
  };
}

describe("renderViewerShell — anon audience", () => {
  const html = renderViewerShell(anonVm(), NONCE);

  it("renders title, kind badge, and version number", () => {
    expect(html).toContain("My Artifact");
    expect(html).toContain("HTML");
    expect(html).toContain("Version 2");
  });

  it("never structurally exposes manager/member-only data", () => {
    expect(html).not.toContain("/t/");
    expect(html).not.toContain("Open in workspace");
    expect(html).not.toContain('<details class="oa-pop oa-versions"');
    expect(html).not.toMatch(/By\s/);
  });

  it("shows a logo linking home, but no visibility control", () => {
    expect(html).toContain('<a class="oa-logo" href="/"');
    expect(html).not.toContain('<details class="oa-pop oa-share-mode"');
  });

  it("is a single fixed row: no details block or toggle, and one secondary action stays a plain button", () => {
    expect(html).not.toContain('id="oa-toggle"');
    expect(html).not.toContain('id="oa-panel-body"');
    expect(html).not.toContain("More actions");
    expect(html).toContain('<a class="oa-btn" href="/s/tok123/download?v=2">Download source</a>');
  });

  it("stamps every inline <style>/<script> with the given nonce", () => {
    const styleTags = [...html.matchAll(/<style nonce="([^"]*)"/g)];
    const scriptTags = [...html.matchAll(/<script nonce="([^"]*)"/g)];
    expect(styleTags.length).toBeGreaterThan(0);
    expect(scriptTags.length).toBeGreaterThan(0);
    for (const m of [...styleTags, ...scriptTags]) expect(m[1]).toBe(NONCE);
  });
});

describe("renderViewerShell — member audience", () => {
  const html = renderViewerShell(memberVm(), NONCE);

  it("shows author and team but no manager-only controls", () => {
    expect(html).toContain("Jane Doe");
    expect(html).toContain("Acme Team");
    expect(html).toContain("Open in workspace");
    expect(html).not.toContain('<details class="oa-pop oa-versions"');
  });

  it("still offers copy-link and download to a member (available to every audience)", () => {
    expect(html).toContain("Copy link");
    expect(html).toContain(">Download source<");
  });

  it("omits the cabinet link entirely when cabinetHref is null (no read access)", () => {
    const out = renderViewerShell(memberVm({ cabinetHref: null }), NONCE);
    expect(out).not.toContain("Open in workspace");
    // ...which leaves a single secondary action, so it goes back to a plain button.
    expect(out).not.toContain("More actions");
  });

  it("groups download and workspace into one 'more' menu, without a details toggle", () => {
    expect(html).toContain('<details class="oa-pop oa-more">');
    expect(html).toContain('aria-label="More actions"');
    expect(html).not.toContain('id="oa-toggle"');
  });

  it("shows the logo but no visibility control (a member cannot change it)", () => {
    expect(html).toContain('<a class="oa-logo" href="/"');
    expect(html).not.toContain('<details class="oa-pop oa-share-mode"');
  });
});

describe("renderViewerShell — manager audience", () => {
  it("shows the full metadata set and a version picker", () => {
    const html = renderViewerShell(managerVm(), NONCE);
    expect(html).toContain("2 KB");
    expect(html).toContain("7 views");
    expect(html).toContain("Never expires");
    expect(html).toContain('<details class="oa-pop oa-versions"');
    expect(html).toContain("Version 1");
    expect(html).toContain("Fixed the bug");
  });

  it("shows the non-default-version banner only when nonDefaultNotice is set", () => {
    const withNotice = renderViewerShell(managerVm({ nonDefaultNotice: { canonicalHref: "/s/tok123" } }), NONCE);
    expect(withNotice).toContain("older version");
    const without = renderViewerShell(managerVm(), NONCE);
    expect(without).not.toContain("older version");
  });

  it.each([
    ["title", (v: string) => managerVm({ title: v })],
    ["versionMessage", (v: string) => managerVm({ versionMessage: v })],
    ["authorName", (v: string) => managerVm({ authorName: v })],
    ["orgName", (v: string) => managerVm({ orgName: v })],
    ["description", (v: string) => managerVm({ description: v })],
  ] as const)("escapes an XSS payload injected via %s", (_field, build) => {
    const html = renderViewerShell(build(XSS), NONCE);
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;img");
  });

  it("truncates a long version message before escaping (no half-cut entities)", () => {
    const long = "&amp;".repeat(100);
    const html = renderViewerShell(managerVm({ versionMessage: long }), NONCE);
    expect(html).not.toMatch(/&amp[^;]/); // a mid-entity cut would leave a bare "&amp" with no ";"
  });

  it("shows the logo linking home", () => {
    const html = renderViewerShell(managerVm(), NONCE);
    expect(html).toContain('<a class="oa-logo" href="/"');
  });

  it("has a details toggle that starts collapsed and points at the details block", () => {
    const html = renderViewerShell(managerVm(), NONCE);
    expect(html).toContain('id="oa-toggle"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="oa-panel-body"');
    expect(html).toContain('id="oa-panel-body"');
  });

  it("puts the secondary meta and the description inside the collapsible details block", () => {
    const html = renderViewerShell(managerVm(), NONCE);
    const details = html.slice(html.indexOf('id="oa-panel-body"'), html.indexOf("</header>"));
    expect(details).toContain("2 KB");
    expect(details).toContain("7 views");
    expect(details).toContain("A description");
  });

  it("does not repeat the version in the inline meta (the picker chip already shows it)", () => {
    const html = renderViewerShell(managerVm(), NONCE);
    const inline = html.slice(html.indexOf('class="oa-meta oa-meta-inline"'), html.indexOf("</ul>", html.indexOf('class="oa-meta oa-meta-inline"')));
    expect(inline).not.toContain("Version");
  });

  describe("visibility control", () => {
    const row = (html: string, mode: string) => {
      const start = html.indexOf(`data-mode="${mode}"`);
      return html.slice(html.lastIndexOf("<button", start), html.indexOf("</button>", start));
    };

    it("carries the share id", () => {
      const html = renderViewerShell(managerVm({ shareId: "share-xyz" }), NONCE);
      expect(html).toContain('<details class="oa-pop oa-share-mode" data-share-id="share-xyz">');
    });

    it("marks only the current mode as checked and makes it the single tab stop", () => {
      const html = renderViewerShell(managerVm({ shareMode: "password" }), NONCE);
      expect(row(html, "password")).toContain('aria-checked="true"');
      expect(row(html, "password")).toContain('tabindex="0"');
      expect(row(html, "team")).toContain('aria-checked="false"');
      expect(row(html, "team")).toContain('tabindex="-1"');
      expect(row(html, "public")).toContain('aria-checked="false"');
    });

    it("shows the current mode on the trigger chip, with a screen-reader prefix", () => {
      const html = renderViewerShell(managerVm({ shareMode: "password" }), NONCE);
      expect(html).toContain('<span id="oa-mode-summary-label">Password protected</span>');
      expect(html).toContain('<span class="oa-sr-only">Visibility: </span>');
    });

    it("offers a hidden password field and a 'Set password' button", () => {
      const html = renderViewerShell(managerVm(), NONCE);
      expect(html).toMatch(/<div class="oa-mode-pw" hidden>/);
      expect(html).toContain('id="oa-mode-pw-apply"');
      expect(html).toContain(">Set password<");
    });

    it("no longer relies on a native <select> + Apply button", () => {
      const html = renderViewerShell(managerVm(), NONCE);
      expect(html).not.toContain("<select");
      expect(html).not.toContain('id="oa-mode-apply"');
    });

    it("renders 'public' as disabled with an explanation when the team's policy forbids it", () => {
      const html = renderViewerShell(managerVm({ allowedModes: ["team", "password"] }), NONCE);
      expect(row(html, "public")).toContain(" disabled");
      expect(row(html, "public")).toContain("Disabled for this team");
    });

    it("leaves 'public' enabled when the team's policy allows it", () => {
      const html = renderViewerShell(managerVm({ allowedModes: ["team", "password", "public"] }), NONCE);
      expect(row(html, "public")).not.toContain(" disabled");
      expect(row(html, "public")).not.toContain("Disabled for this team");
    });

    it("moves the tab stop to the first pickable row when the current mode is no longer allowed", () => {
      const html = renderViewerShell(managerVm({ shareMode: "public", allowedModes: ["team", "password"] }), NONCE);
      expect(row(html, "public")).toContain('aria-checked="true"');
      expect(row(html, "public")).toContain('tabindex="-1"');
      expect(row(html, "team")).toContain('tabindex="0"');
    });

    it("escapes a hostile share id instead of rendering it as markup", () => {
      const html = renderViewerShell(managerVm({ shareId: XSS }), NONCE);
      expect(html).not.toContain("<img src=x onerror=alert(1)>");
    });

    it("saves on selection: the panel script PATCHes the share and updates in place, without a reload", () => {
      const html = renderViewerShell(managerVm(), NONCE);
      expect(html).toContain("method:'PATCH'");
      expect(html).not.toContain("location.reload");
    });
  });
});

describe("standalone pages", () => {
  it("renderPasswordFormPage never mentions artifact metadata and carries the nonce", () => {
    const html = renderPasswordFormPage(NONCE);
    expect(html).toContain("Password required");
    expect(html).toContain(`nonce="${NONCE}"`);
    expect(html).not.toContain("My Artifact");
  });

  it("renderRestrictedPage escapes its login href and carries the nonce", () => {
    const html = renderRestrictedPage(`/login?next=%2Fs%2Ftok&x="><script>alert(1)</script>`, NONCE);
    expect(html).toContain(`nonce="${NONCE}"`);
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("renderErrorPage escapes its message", () => {
    const html = renderErrorPage(`<script>alert(1)</script>`, NONCE);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
