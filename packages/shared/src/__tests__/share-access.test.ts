import { describe, expect, it } from "vitest";
import { resolveShareAccess, type ShareRecord } from "../share-access.js";

const baseShare = (overrides: Partial<ShareRecord> = {}): ShareRecord => ({
  mode: "public",
  passwordHash: null,
  expiresAt: null,
  revokedAt: null,
  ...overrides,
});

describe("resolveShareAccess", () => {
  it("allows a public share with no expiry", () => {
    expect(resolveShareAccess(baseShare())).toEqual({ allowed: true });
  });

  it("denies a revoked share regardless of mode", () => {
    const result = resolveShareAccess(baseShare({ revokedAt: new Date() }));
    expect(result).toEqual({ allowed: false, reason: "revoked" });
  });

  it("denies an expired share", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const share = baseShare({ expiresAt: new Date("2026-01-01T00:00:00.000Z") });
    expect(resolveShareAccess(share, { now })).toEqual({ allowed: false, reason: "expired" });
  });

  it("allows a not-yet-expired share", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const share = baseShare({ expiresAt: new Date("2026-01-10T00:00:00.000Z") });
    expect(resolveShareAccess(share, { now })).toEqual({ allowed: true });
  });

  it("requires a password for a password-mode share when none is provided", () => {
    const share = baseShare({ mode: "password", passwordHash: "hash" });
    expect(resolveShareAccess(share)).toEqual({ allowed: false, reason: "password_required" });
  });

  it("verifies the provided password against the stored hash", () => {
    const share = baseShare({ mode: "password", passwordHash: "correct-hash" });
    const verifyPassword = (plaintext: string, hash: string) => plaintext === "secret" && hash === "correct-hash";

    expect(resolveShareAccess(share, { providedPassword: "secret", verifyPassword })).toEqual({ allowed: true });
    expect(resolveShareAccess(share, { providedPassword: "wrong", verifyPassword })).toEqual({
      allowed: false,
      reason: "password_incorrect",
    });
  });

  it("throws if a password check is needed but no verifier was injected", () => {
    const share = baseShare({ mode: "password", passwordHash: "hash" });
    expect(() => resolveShareAccess(share, { providedPassword: "x" })).toThrow();
  });

  it("revocation takes priority over expiry and password checks", () => {
    const share = baseShare({
      mode: "password",
      passwordHash: "hash",
      revokedAt: new Date(),
      expiresAt: new Date("2020-01-01"),
    });
    expect(resolveShareAccess(share)).toEqual({ allowed: false, reason: "revoked" });
  });
});
