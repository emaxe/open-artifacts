import { describe, expect, it } from "vitest";
import { buildEmbedCsp, DEFAULT_CDN_ALLOWLIST } from "../csp.js";

describe("buildEmbedCsp", () => {
  it("blocks everything by default and only opens what's needed", () => {
    const csp = buildEmbedCsp({ scriptAllowlist: DEFAULT_CDN_ALLOWLIST, frameAncestor: "https://app.example.com" });
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'none'");
  });

  it("always blocks connect-src regardless of allowlist, so embedded scripts cannot call the API", () => {
    const csp = buildEmbedCsp({ scriptAllowlist: ["https://evil.example.com"], frameAncestor: "*" });
    expect(csp).toContain("connect-src 'none'");
  });

  it("includes the CDN allowlist in script-src", () => {
    const csp = buildEmbedCsp({ scriptAllowlist: ["https://cdnjs.cloudflare.com"], frameAncestor: "https://app.example.com" });
    expect(csp).toContain("script-src 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com");
  });

  it("scopes frame-ancestors to the app origin, preventing clickjacking via foreign iframes", () => {
    const csp = buildEmbedCsp({ scriptAllowlist: [], frameAncestor: "https://app.example.com" });
    expect(csp).toContain("frame-ancestors https://app.example.com");
  });

  it("omits media-src and leaves img-src/font-src untouched when no asset origin is given", () => {
    const csp = buildEmbedCsp({ scriptAllowlist: [], frameAncestor: "https://app.example.com" });
    expect(csp).not.toContain("media-src");
    expect(csp).toContain("img-src data: blob: https:;");
    expect(csp).toContain("font-src https://fonts.gstatic.com data:;");
  });

  it("adds the asset origin to img-src/font-src and opens media-src when storage is enabled", () => {
    const csp = buildEmbedCsp({ scriptAllowlist: [], frameAncestor: "https://app.example.com", assetOrigin: "https://app.example.com" });
    expect(csp).toContain("img-src data: blob: https: https://app.example.com;");
    expect(csp).toContain("font-src https://fonts.gstatic.com data: https://app.example.com;");
    expect(csp).toContain("media-src https://app.example.com;");
  });
});
