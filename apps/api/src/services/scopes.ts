import { hasScope, type ApiKeyScope } from "@open-artifacts/shared";
import type { Identity } from "../types.js";

/** Session-authenticated users act with their org role, unconstrained by API-key scopes. */
export function requiresScope(identity: Identity, scope: ApiKeyScope): boolean {
  return identity.kind === "user" || hasScope(identity.scopes, scope);
}
