import { hasScope, type ApiKeyScope } from "@open-artifacts/shared";
import type { Identity } from "../types.js";
import { isSessionUser } from "./identity.js";

/**
 * Session-authenticated (cookie) users act with their org role, unconstrained by API-key scopes.
 * Both agent and personal (user_key) API keys are bound by the scopes issued on the key.
 */
export function requiresScope(identity: Identity, scope: ApiKeyScope): boolean {
  return isSessionUser(identity) || hasScope(identity.scopes, scope);
}
