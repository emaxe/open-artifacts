import type { ApiKeyScope } from "@open-artifacts/shared";
import type { Database } from "./db/client.js";
import type { Env } from "./env.js";
import type { Storage } from "./services/storage.js";

export type Identity =
  | { kind: "user"; userId: string; isSuperadmin: boolean }
  | { kind: "user_key"; userId: string; keyId: string; scopes: ApiKeyScope[] }
  | { kind: "agent"; agentId: string; orgId: string; keyId: string; scopes: ApiKeyScope[] };

export interface AppVariables {
  db: Database;
  env: Env;
  storage: Storage;
  identity: Identity | null;
  /** Set by resolveIdentity when a Bearer token was present but invalid, so requireAuth can return a precise error. */
  apiKeyError?: "malformed" | "not_found" | "revoked" | "expired" | "bad_secret";
  /** Set by resolveOrgScope once an org has been picked for this request; read by usage metering. */
  resolvedOrgId?: string;
  requestStartedAt: number;
}

export interface AppBindings {
  Variables: AppVariables;
}
