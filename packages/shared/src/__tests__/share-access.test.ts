import { describe, expect, it } from "vitest";
import { resolveShareAccess, type ShareRecord, type ShareViewer } from "../share-access.js";

const baseShare = (overrides: Partial<ShareRecord> = {}): ShareRecord => ({
  mode: "public",
  passwordHash: null,
  expiresAt: null,
  revokedAt: null,
  ...overrides,
});

const member: ShareViewer = { authenticated: true, isOrgMember: true };
const nonMember: ShareViewer = { authenticated: true, isOrgMember: false };
const anonymous: ShareViewer = { authenticated: false, isOrgMember: false };

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

  describe("password mode", () => {
    it("requires a password when none has been checked", () => {
      const share = baseShare({ mode: "password", passwordHash: "hash" });
      expect(resolveShareAccess(share)).toEqual({ allowed: false, reason: "password_required" });
      expect(resolveShareAccess(share, { passwordCheck: "absent" })).toEqual({ allowed: false, reason: "password_required" });
    });

    it("allows access once unlocked", () => {
      const share = baseShare({ mode: "password", passwordHash: "hash" });
      expect(resolveShareAccess(share, { passwordCheck: "unlocked" })).toEqual({ allowed: true });
    });

    it("denies a wrong password", () => {
      const share = baseShare({ mode: "password", passwordHash: "hash" });
      expect(resolveShareAccess(share, { passwordCheck: "wrong" })).toEqual({ allowed: false, reason: "password_incorrect" });
    });

    // Regression: a `password`-mode row with a NULL hash is a broken share, not a public one.
    it("treats a password share with a NULL hash as still requiring a password, never as public", () => {
      const share = baseShare({ mode: "password", passwordHash: null });
      expect(resolveShareAccess(share, { passwordCheck: "unlocked" })).toEqual({ allowed: false, reason: "password_required" });
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

  describe("team mode", () => {
    it("requires login for an anonymous viewer", () => {
      const share = baseShare({ mode: "team" });
      expect(resolveShareAccess(share)).toEqual({ allowed: false, reason: "login_required" });
      expect(resolveShareAccess(share, { viewer: anonymous })).toEqual({ allowed: false, reason: "login_required" });
    });

    it("denies an authenticated non-member", () => {
      const share = baseShare({ mode: "team" });
      expect(resolveShareAccess(share, { viewer: nonMember })).toEqual({ allowed: false, reason: "not_a_member" });
    });

    it("allows an authenticated org member", () => {
      const share = baseShare({ mode: "team" });
      expect(resolveShareAccess(share, { viewer: member })).toEqual({ allowed: true });
    });

    it("revocation and expiry take priority over the membership check", () => {
      const revoked = baseShare({ mode: "team", revokedAt: new Date() });
      expect(resolveShareAccess(revoked, { viewer: member })).toEqual({ allowed: false, reason: "revoked" });

      const now = new Date("2026-01-10T00:00:00.000Z");
      const expired = baseShare({ mode: "team", expiresAt: new Date("2026-01-01T00:00:00.000Z") });
      expect(resolveShareAccess(expired, { now, viewer: member })).toEqual({ allowed: false, reason: "expired" });
    });
  });
});
