export type OrgRole = "owner" | "admin" | "member" | "viewer";
export type ArtifactVisibility = "private" | "org";
export type OwnerType = "user" | "agent";

export interface ArtifactAccessSubject {
  /** "user:<id>" or "agent:<id>" — the identity making the request. */
  actorType: OwnerType;
  actorId: string;
  /** Org role, when the actor is a member of the artifact's org. `null` if not a member (cross-org). */
  role: OrgRole | null;
}

export interface ArtifactAccessTarget {
  ownerType: OwnerType;
  ownerId: string;
  visibility: ArtifactVisibility;
}

export interface ArtifactAccessResult {
  read: boolean;
  write: boolean;
  delete: boolean;
}

const DENY: ArtifactAccessResult = { read: false, write: false, delete: false };

/**
 * Role/visibility access matrix for an artifact accessed through the authenticated API
 * (Bearer key or session), scoped to a single org. Share-token access is evaluated
 * separately by `resolveShareAccess` — it is orthogonal to org membership.
 */
export function resolveOrgArtifactAccess(
  subject: ArtifactAccessSubject,
  target: ArtifactAccessTarget,
): ArtifactAccessResult {
  // Not a member of the artifact's org at all: no access regardless of visibility.
  if (subject.role === null) return DENY;

  const isOwner = subject.actorType === target.ownerType && subject.actorId === target.ownerId;

  if (subject.role === "owner" || subject.role === "admin") {
    return { read: true, write: true, delete: true };
  }

  if (subject.role === "member") {
    if (isOwner) return { read: true, write: true, delete: true };
    if (target.visibility === "org") return { read: true, write: false, delete: false };
    return DENY;
  }

  // viewer
  if (isOwner) return { read: true, write: false, delete: false };
  if (target.visibility === "org") return { read: true, write: false, delete: false };
  return DENY;
}
