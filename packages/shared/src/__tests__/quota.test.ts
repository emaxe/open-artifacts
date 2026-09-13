import { describe, expect, it } from "vitest";
import { effectiveQuotaLimit, quotaExceeds, quotaRemaining, toQuotaLimit } from "../quota.js";

describe("toQuotaLimit", () => {
  it("treats 0, null and undefined as unlimited", () => {
    expect(toQuotaLimit(0)).toBeNull();
    expect(toQuotaLimit(null)).toBeNull();
    expect(toQuotaLimit(undefined)).toBeNull();
  });

  it("treats a negative value as unlimited", () => {
    expect(toQuotaLimit(-1)).toBeNull();
  });

  it("passes through a positive number of bytes", () => {
    expect(toQuotaLimit(1024)).toBe(1024);
  });
});

describe("effectiveQuotaLimit", () => {
  it("is unlimited when both are unlimited", () => {
    expect(effectiveQuotaLimit(null, null)).toBeNull();
  });

  it("is the finite side when only one is limited", () => {
    expect(effectiveQuotaLimit(1_000_000, null)).toBe(1_000_000);
    expect(effectiveQuotaLimit(null, 500)).toBe(500);
  });

  it("is the stricter (smaller) of two finite limits", () => {
    expect(effectiveQuotaLimit(1_000_000, 500)).toBe(500);
    expect(effectiveQuotaLimit(500, 1_000_000)).toBe(500);
  });
});

describe("quotaExceeds", () => {
  it("never exceeds an unlimited limit", () => {
    expect(quotaExceeds(1_000_000_000, null)).toBe(false);
  });

  it("compares a total against a finite limit", () => {
    expect(quotaExceeds(100, 100)).toBe(false);
    expect(quotaExceeds(101, 100)).toBe(true);
    expect(quotaExceeds(99, 100)).toBe(false);
  });
});

describe("quotaRemaining", () => {
  it("is null (unlimited) when the limit is unlimited", () => {
    expect(quotaRemaining(500, null)).toBeNull();
  });

  it("is the difference when under the limit", () => {
    expect(quotaRemaining(300, 1000)).toBe(700);
  });

  it("never goes negative when already over the limit", () => {
    expect(quotaRemaining(1200, 1000)).toBe(0);
  });
});
