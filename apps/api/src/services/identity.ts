import type { OwnerType } from "@open-artifacts/shared";
import type { Identity } from "../types.js";

/** True for a cookie-authenticated session — the only identity kind exempt from API-key scopes. */
export function isSessionUser(identity: Identity): identity is Extract<Identity, { kind: "user" }> {
  return identity.kind === "user";
}

/** The human behind this request, if any — null for agent identities (no user acts on their behalf). */
export function actingUserId(identity: Identity): string | null {
  return identity.kind === "user" || identity.kind === "user_key" ? identity.userId : null;
}

/** The API key backing this request, if any — null for cookie sessions. */
export function keyIdOf(identity: Identity): string | null {
  return identity.kind === "user_key" || identity.kind === "agent" ? identity.keyId : null;
}

/** Owner attribution for artifacts/versions created under this identity. */
export function actorRef(identity: Identity): { ownerType: OwnerType; ownerId: string } {
  return identity.kind === "agent"
    ? { ownerType: "agent", ownerId: identity.agentId }
    : { ownerType: "user", ownerId: identity.userId };
}
