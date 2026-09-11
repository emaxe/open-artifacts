import { describe, expect, it } from "vitest";
import {
  effectiveLifetimeLimit,
  expiresAtFromMinutes,
  lifetimeExceedsLimit,
  parseLifetimeMinutes,
  toLifetimeLimit,
} from "../lifetime.js";

describe("toLifetimeLimit", () => {
  it("treats 0, null and undefined as unlimited", () => {
    expect(toLifetimeLimit(0)).toBeNull();
    expect(toLifetimeLimit(null)).toBeNull();
    expect(toLifetimeLimit(undefined)).toBeNull();
  });

  it("passes through a positive number of minutes", () => {
    expect(toLifetimeLimit(60)).toBe(60);
  });
});

describe("parseLifetimeMinutes", () => {
  it("treats a bare number as MINUTES (unlike parseDurationMs, where a bare number is days)", () => {
    expect(parseLifetimeMinutes(30)).toBe(30);
    expect(parseLifetimeMinutes("30")).toBe(30);
  });

  it("parses explicit units via parseDurationMs and converts to minutes", () => {
    expect(parseLifetimeMinutes("2h")).toBe(120);
    expect(parseLifetimeMinutes("7d")).toBe(7 * 24 * 60);
    expect(parseLifetimeMinutes("15m")).toBe(15);
  });

  it("returns null for 0, '0', null or undefined (never expires)", () => {
    expect(parseLifetimeMinutes(0)).toBeNull();
    expect(parseLifetimeMinutes("0")).toBeNull();
    expect(parseLifetimeMinutes(null)).toBeNull();
    expect(parseLifetimeMinutes(undefined)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(() => parseLifetimeMinutes("banana")).toThrow();
    expect(() => parseLifetimeMinutes("7x")).toThrow();
  });

  it("rejects a sub-minute duration that rounds to zero", () => {
    expect(() => parseLifetimeMinutes("30s")).toThrow();
  });
});

describe("effectiveLifetimeLimit", () => {
  it("is unlimited when both are unlimited", () => {
    expect(effectiveLifetimeLimit(null, null)).toBeNull();
  });

  it("is the finite side when only one is limited", () => {
    expect(effectiveLifetimeLimit(1440, null)).toBe(1440);
    expect(effectiveLifetimeLimit(null, 60)).toBe(60);
  });

  it("is the stricter (smaller) of two finite limits", () => {
    expect(effectiveLifetimeLimit(1440, 60)).toBe(60);
    expect(effectiveLifetimeLimit(60, 1440)).toBe(60);
  });
});

describe("lifetimeExceedsLimit", () => {
  it("never exceeds an unlimited limit", () => {
    expect(lifetimeExceedsLimit(60, null)).toBe(false);
    expect(lifetimeExceedsLimit(null, null)).toBe(false);
  });

  it("an unlimited request exceeds any finite limit", () => {
    expect(lifetimeExceedsLimit(null, 60)).toBe(true);
  });

  it("compares two finite values", () => {
    expect(lifetimeExceedsLimit(30, 60)).toBe(false);
    expect(lifetimeExceedsLimit(60, 60)).toBe(false);
    expect(lifetimeExceedsLimit(90, 60)).toBe(true);
  });
});

describe("expiresAtFromMinutes", () => {
  it("returns null for an unlimited lifetime", () => {
    expect(expiresAtFromMinutes(null, new Date("2026-01-01T00:00:00.000Z"))).toBeNull();
  });

  it("adds the minutes to the reference date", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    expect(expiresAtFromMinutes(60, from)?.toISOString()).toBe("2026-01-01T01:00:00.000Z");
  });
});
