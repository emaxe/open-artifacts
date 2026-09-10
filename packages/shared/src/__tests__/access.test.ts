import { describe, expect, it } from "vitest";
import { resolveOrgArtifactAccess, type ArtifactAccessSubject, type ArtifactAccessTarget } from "../access.js";

const target = (overrides: Partial<ArtifactAccessTarget> = {}): ArtifactAccessTarget => ({
  ownerType: "agent",
  ownerId: "agent-1",
  visibility: "private",
  ...overrides,
});

const subject = (overrides: Partial<ArtifactAccessSubject> = {}): ArtifactAccessSubject => ({
  actorType: "user",
  actorId: "user-1",
  role: "member",
  ...overrides,
});

describe("resolveOrgArtifactAccess", () => {
  it("denies everything to someone outside the org", () => {
    const result = resolveOrgArtifactAccess(subject({ role: null }), target({ visibility: "org" }));
    expect(result).toEqual({ read: false, write: false, delete: false });
  });

  it("owner and admin get full access to any artifact in the org", () => {
    for (const role of ["owner", "admin"] as const) {
      const result = resolveOrgArtifactAccess(subject({ role }), target({ visibility: "private" }));
      expect(result).toEqual({ read: true, write: true, delete: true });
    }
  });

  it("member has full access to their own artifact even if private", () => {
    const result = resolveOrgArtifactAccess(
      subject({ role: "member", actorType: "agent", actorId: "agent-1" }),
      target({ ownerType: "agent", ownerId: "agent-1", visibility: "private" }),
    );
    expect(result).toEqual({ read: true, write: true, delete: true });
  });

  it("member can read (not write/delete) another actor's org-visibility artifact", () => {
    const result = resolveOrgArtifactAccess(
      subject({ role: "member", actorId: "user-2" }),
      target({ ownerType: "user", ownerId: "someone-else", visibility: "org" }),
    );
    expect(result).toEqual({ read: true, write: false, delete: false });
  });

  it("member has no access to another actor's private artifact", () => {
    const result = resolveOrgArtifactAccess(
      subject({ role: "member" }),
      target({ ownerType: "agent", ownerId: "agent-1", visibility: "private" }),
    );
    expect(result).toEqual({ read: false, write: false, delete: false });
  });

  it("viewer can read org-visibility artifacts but never write or delete", () => {
    const result = resolveOrgArtifactAccess(
      subject({ role: "viewer" }),
      target({ visibility: "org" }),
    );
    expect(result).toEqual({ read: true, write: false, delete: false });
  });

  it("viewer has no access at all to someone else's private artifact", () => {
    const result = resolveOrgArtifactAccess(subject({ role: "viewer" }), target({ visibility: "private" }));
    expect(result).toEqual({ read: false, write: false, delete: false });
  });

  it("viewer can still read their own private artifact", () => {
    const result = resolveOrgArtifactAccess(
      subject({ role: "viewer", actorType: "user", actorId: "user-1" }),
      target({ ownerType: "user", ownerId: "user-1", visibility: "private" }),
    );
    expect(result).toEqual({ read: true, write: false, delete: false });
  });
});
