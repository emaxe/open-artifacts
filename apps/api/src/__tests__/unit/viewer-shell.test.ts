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
    expect(html).not.toContain('<details class="oa-versions"');
    expect(html).not.toMatch(/By\s/);
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
    expect(html).not.toContain('<details class="oa-versions"');
  });

  it("still offers copy-link and download to a member (available to every audience)", () => {
    expect(html).toContain("Copy link");
    expect(html).toContain(">Download source<");
  });

  it("omits the cabinet link entirely when cabinetHref is null (no read access)", () => {
    const out = renderViewerShell(memberVm({ cabinetHref: null }), NONCE);
    expect(out).not.toContain("Open in workspace");
  });
});

describe("renderViewerShell — manager audience", () => {
  it("shows the full metadata set and a version picker", () => {
    const html = renderViewerShell(managerVm(), NONCE);
    expect(html).toContain("2 KB");
    expect(html).toContain("7 views");
    expect(html).toContain("Never expires");
    expect(html).toContain('<details class="oa-versions"');
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
