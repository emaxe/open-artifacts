import type { ApiKeyScope } from "@open-artifacts/shared";
import type { Database } from "./db/client.js";
import type { Env } from "./env.js";

export type Identity =
  | { kind: "user"; userId: string; isSuperadmin: boolean }
  | { kind: "agent"; agentId: string; orgId: string; keyId: string; scopes: ApiKeyScope[] };

export interface AppVariables {
  db: Database;
  env: Env;
  identity: Identity | null;
  /** Set by resolveIdentity when a Bearer token was present but invalid, so requireAuth can return a precise error. */
  apiKeyError?: "malformed" | "not_found" | "revoked" | "expired" | "bad_secret";
  requestStartedAt: number;
}

export interface AppBindings {
  Variables: AppVariables;
}
