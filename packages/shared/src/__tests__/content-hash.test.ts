import { describe, expect, it } from "vitest";
import { computeContentHash } from "../content-hash.js";

describe("computeContentHash", () => {
  it("is deterministic for the same content", () => {
    const a = computeContentHash("<h1>hello</h1>");
    const b = computeContentHash("<h1>hello</h1>");
    expect(a).toBe(b);
  });

  it("differs for different content", () => {
    expect(computeContentHash("a")).not.toBe(computeContentHash("b"));
  });

  it("produces a 64-char lowercase hex sha256 digest", () => {
    const hash = computeContentHash("test");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // known sha256("test")
    expect(hash).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
  });
});
