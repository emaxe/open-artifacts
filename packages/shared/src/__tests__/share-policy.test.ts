import { describe, expect, it } from "vitest";
import { resolveRequestedShareMode, resolveSharePolicy, type SharePolicySource } from "../share-policy.js";

const src = (overrides: Partial<SharePolicySource> = {}): SharePolicySource => ({
  instance: { allowPublicShares: true, defaultShareMode: "team" },
  org: { allowPublicShares: true, defaultShareMode: null },
  ...overrides,
});

describe("resolveSharePolicy", () => {
  it("allows public shares when both instance and org allow them", () => {
    expect(resolveSharePolicy(src()).allowPublicShares).toBe(true);
  });

  it("forbids public shares when the instance forbids them, even if the org allows them", () => {
    const policy = resolveSharePolicy(src({ instance: { allowPublicShares: false, defaultShareMode: "team" } }));
    expect(policy.allowPublicShares).toBe(false);
  });

  it("forbids public shares when the org forbids them, even if the instance allows them", () => {
    const policy = resolveSharePolicy(src({ org: { allowPublicShares: false, defaultShareMode: null } }));
    expect(policy.allowPublicShares).toBe(false);
  });

  it("a team's own default overrides the instance default", () => {
    const policy = resolveSharePolicy(src({ org: { allowPublicShares: true, defaultShareMode: "public" } }));
    expect(policy.defaultShareMode).toBe("public");
  });

  it("a null team default inherits the instance default", () => {
    const policy = resolveSharePolicy(src({ instance: { allowPublicShares: true, defaultShareMode: "public" }, org: { allowPublicShares: true, defaultShareMode: null } }));
    expect(policy.defaultShareMode).toBe("public");
  });

  it("degrades a public default to team when public links are forbidden", () => {
    const policy = resolveSharePolicy(
      src({ instance: { allowPublicShares: false, defaultShareMode: "team" }, org: { allowPublicShares: true, defaultShareMode: "public" } }),
    );
    expect(policy.allowPublicShares).toBe(false);
    expect(policy.defaultShareMode).toBe("team");
  });

  it("allowedModes includes public only when allowed", () => {
    expect(resolveSharePolicy(src()).allowedModes).toEqual(["team", "password", "public"]);
    expect(resolveSharePolicy(src({ org: { allowPublicShares: false, defaultShareMode: null } })).allowedModes).toEqual(["team", "password"]);
  });
});

describe("resolveRequestedShareMode", () => {
  it("falls back to the policy default when no mode is requested", () => {
    const policy = resolveSharePolicy(src({ org: { allowPublicShares: true, defaultShareMode: "public" } }));
    expect(resolveRequestedShareMode(undefined, policy)).toEqual({ ok: true, mode: "public" });
  });

  it("refuses an explicit public request when public links are forbidden", () => {
    const policy = resolveSharePolicy(src({ org: { allowPublicShares: false, defaultShareMode: null } }));
    expect(resolveRequestedShareMode("public", policy)).toEqual({ ok: false, reason: "public_forbidden" });
  });

  it("allows an explicit team request regardless of the public policy", () => {
    const policy = resolveSharePolicy(src({ org: { allowPublicShares: false, defaultShareMode: null } }));
    expect(resolveRequestedShareMode("team", policy)).toEqual({ ok: true, mode: "team" });
  });

  it("allows an explicit password request regardless of the public policy", () => {
    const policy = resolveSharePolicy(src({ org: { allowPublicShares: false, defaultShareMode: null } }));
    expect(resolveRequestedShareMode("password", policy)).toEqual({ ok: true, mode: "password" });
  });
});
