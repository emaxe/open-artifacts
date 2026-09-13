import { describe, expect, it } from "vitest";
import { downloadFileName, contentDispositionValue } from "../../services/download-name.js";

describe("downloadFileName", () => {
  it("slugifies a plain title", () => {
    const { asciiName } = downloadFileName("My Cool Report", "html", 3);
    expect(asciiName).toBe("my-cool-report-v3.html");
  });

  it("maps every artifact kind to its own extension", () => {
    expect(downloadFileName("t", "html", 1).asciiName).toMatch(/\.html$/);
    expect(downloadFileName("t", "markdown", 1).asciiName).toMatch(/\.md$/);
    expect(downloadFileName("t", "svg", 1).asciiName).toMatch(/\.svg$/);
    expect(downloadFileName("t", "mermaid", 1).asciiName).toMatch(/\.mmd$/);
  });

  it("falls back to 'artifact' when the title has no ASCII-alnum content", () => {
    expect(downloadFileName("😀😀😀", "html", 1).asciiName).toBe("artifact-v1.html");
    expect(downloadFileName("", "html", 1).asciiName).toBe("artifact-v1.html");
    expect(downloadFileName("   ", "html", 1).asciiName).toBe("artifact-v1.html");
  });

  it("collapses quotes, slashes, and path traversal into dashes — never passes them through", () => {
    const { asciiName } = downloadFileName(`a"b/c..d`, "html", 1);
    expect(asciiName).toMatch(/^[a-z0-9-]+\.html$/);
    expect(asciiName).not.toContain('"');
    expect(asciiName).not.toContain("/");
    expect(asciiName).not.toContain("..");
  });

  it("strips CR/LF from the ASCII name entirely (header-injection attempt)", () => {
    const { asciiName } = downloadFileName("a\r\nX-Evil: 1", "html", 1);
    expect(asciiName).toMatch(/^[a-z0-9-]+\.html$/);
    expect(asciiName).not.toMatch(/[\r\n]/);
  });

  it("caps the ascii slug length and never ends up with a trailing dash", () => {
    const { asciiName } = downloadFileName("a".repeat(300), "html", 1);
    expect(asciiName.length).toBeLessThan(80);
    expect(asciiName).not.toMatch(/-\.html$/);
  });

  it("transliterates accented Latin via NFKD before slugifying", () => {
    expect(downloadFileName("café", "html", 1).asciiName).toBe("cafe-v1.html");
  });

  it("keeps non-Latin scripts in the Unicode display name but drops them from the ASCII name", () => {
    const { asciiName, displayName } = downloadFileName("Отчёт", "html", 2);
    expect(asciiName).toBe("artifact-v2.html");
    expect(displayName).toBe("Отчёт-v2.html");
  });
});

describe("contentDispositionValue", () => {
  it("produces a well-formed attachment header with both filename forms", () => {
    const value = contentDispositionValue("Report", "html", 1);
    expect(value).toMatch(/^attachment; filename="report-v1\.html"; filename\*=UTF-8''/);
  });

  it("never contains a raw CR, LF, or double quote from a hostile title", () => {
    const hostile = `a"b\r\nSet-Cookie: evil=1`;
    const value = contentDispositionValue(hostile, "html", 1);
    expect(value).not.toMatch(/[\r\n]/);
    // the only double quotes allowed are the two that quote the ascii filename itself
    expect(value.match(/"/g)?.length).toBe(2);
  });

  it("percent-encodes the RFC 5987 attr-chars that encodeURIComponent leaves untouched (* ' ( ))", () => {
    const value = contentDispositionValue(`a*b'c(d)e`, "html", 1);
    const extValue = value.split("filename*=UTF-8''")[1]!;
    expect(extValue).not.toMatch(/[*'()]/);
  });

  it("round-trips a Cyrillic title through the Unicode filename*= form", () => {
    const value = contentDispositionValue("Отчёт", "markdown", 5);
    const extValue = value.split("filename*=UTF-8''")[1]!;
    expect(decodeURIComponent(extValue)).toBe("Отчёт-v5.md");
  });
});
