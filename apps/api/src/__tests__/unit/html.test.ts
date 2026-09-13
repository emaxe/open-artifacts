import { describe, expect, it } from "vitest";
import { escapeHtml, truncate } from "../../services/html.js";

describe("escapeHtml", () => {
  it("escapes all five HTML-significant characters", () => {
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeHtml("hello world 123")).toBe("hello world 123");
  });

  it("neutralizes a script-tag breakout attempt", () => {
    const input = `</title><img src=x onerror=alert(1)>`;
    const out = escapeHtml(input);
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
  });
});

describe("truncate", () => {
  it("passes short strings through unchanged", () => {
    expect(truncate("short", 10)).toBe("short");
  });

  it("cuts long strings and appends an ellipsis", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcde…");
  });

  it("truncates BEFORE escaping is the caller's responsibility — verify it never mangles ASCII mid-cut", () => {
    // truncate itself has no notion of HTML entities; this just documents the ordering contract
    // (truncate, then escapeHtml) that callers in viewer-shell.ts must follow.
    expect(truncate("&amp;", 3)).toBe("&am…");
  });
});
