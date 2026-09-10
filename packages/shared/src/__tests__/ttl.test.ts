import { describe, expect, it } from "vitest";
import { isExpired, parseDurationMs, resolveExpiresAt } from "../ttl.js";

describe("parseDurationMs", () => {
  it("parses days by default for bare numeric strings", () => {
    expect(parseDurationMs("7")).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("parses explicit units", () => {
    expect(parseDurationMs("15m")).toBe(15 * 60 * 1000);
    expect(parseDurationMs("12h")).toBe(12 * 60 * 60 * 1000);
    expect(parseDurationMs("90d")).toBe(90 * 24 * 60 * 60 * 1000);
    expect(parseDurationMs("2w")).toBe(2 * 7 * 24 * 60 * 60 * 1000);
    expect(parseDurationMs("30s")).toBe(30 * 1000);
  });

  it("treats a number input as days", () => {
    expect(parseDurationMs(90)).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("returns null for '0' or non-positive numbers (never expires)", () => {
    expect(parseDurationMs("0")).toBeNull();
    expect(parseDurationMs(0)).toBeNull();
    expect(parseDurationMs(-5)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(() => parseDurationMs("banana")).toThrow();
    expect(() => parseDurationMs("7x")).toThrow();
  });
});

describe("resolveExpiresAt", () => {
  it("adds the duration to `now`", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const result = resolveExpiresAt("1d", now);
    expect(result?.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });

  it("returns null when the duration means never-expire", () => {
    expect(resolveExpiresAt("0")).toBeNull();
  });
});

describe("isExpired", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("is never expired when expiresAt is null", () => {
    expect(isExpired(null, now)).toBe(false);
  });

  it("is expired once the deadline has passed", () => {
    expect(isExpired(new Date("2025-12-31T00:00:00.000Z"), now)).toBe(true);
  });

  it("treats the exact boundary as expired", () => {
    expect(isExpired(now, now)).toBe(true);
  });

  it("is not expired before the deadline", () => {
    expect(isExpired(new Date("2026-01-02T00:00:00.000Z"), now)).toBe(false);
  });
});
