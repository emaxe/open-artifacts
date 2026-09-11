import type { Credentials } from "./config.js";
import { findProjectConfig } from "./project-config.js";

export type OrgSource = "flag" | "env" | "project" | "credentials" | "none";

export interface OrgResolution {
  orgId?: string;
  source: OrgSource;
  configPath?: string;
}

export interface ResolveOrgOpts {
  flag?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  creds?: Credentials;
}

/**
 * Priority: --org flag > OA_ORG env > .oa.json found by walking up from cwd > a pre-0.3.0
 * (agent-only) credentials file's locked org. Resolving to nothing isn't an error — the server
 * auto-picks when a personal key's holder belongs to exactly one team, or returns `org_required`
 * with the candidate list otherwise (see services/org-scope.ts on the server).
 */
export function resolveOrg(opts: ResolveOrgOpts): OrgResolution {
  if (opts.flag) return { orgId: opts.flag, source: "flag" };

  const env = opts.env ?? process.env;
  if (env.OA_ORG) return { orgId: env.OA_ORG, source: "env" };

  const project = findProjectConfig(opts.cwd);
  if (project?.config.orgId) {
    // An orgId only makes sense on the server it was written for. A mismatch would otherwise
    // surface as an opaque "forbidden" from the API instead of a clear "wrong server" warning.
    if (project.config.server && opts.creds?.server && project.config.server !== opts.creds.server) {
      console.error(`Warning: ${project.path} was written for ${project.config.server}, not ${opts.creds.server} — ignoring its orgId.`);
    } else {
      return { orgId: project.config.orgId, source: "project", configPath: project.path };
    }
  }

  // A pre-0.3.0 credentials file has no `kind` and always carries the single org its agent key
  // was locked to. A personal (kind: "user") key has no such single org to fall back to.
  if (!opts.creds?.kind && opts.creds?.orgId) return { orgId: opts.creds.orgId, source: "credentials" };

  return { source: "none" };
}
