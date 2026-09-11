import type { Context } from "hono";
import type { OrgRole } from "@open-artifacts/shared";
import type { Database } from "../db/client.js";
import type { AppBindings, Identity } from "../types.js";
import { getOrgRole } from "./users.js";
import { listOrgMembershipsForUser, type OrgMembershipRef } from "./orgs.js";

export type OrgChoice = OrgMembershipRef;

export type OrgScope =
  | { ok: true; orgId: string; role: OrgRole }
  | { ok: false; code: "org_required"; orgs: OrgChoice[] }
  | { ok: false; code: "forbidden" };

/** Blank / "null" / "undefined" (old CLI clients can literally send these) count as "not passed". */
function normalizeRequested(requested?: string | null): string | undefined {
  if (!requested) return undefined;
  const trimmed = requested.trim();
  return trimmed === "" || trimmed === "null" || trimmed === "undefined" ? undefined : trimmed;
}

/**
 * The single chokepoint for "which org is this request acting on" — used by GET/POST /artifacts
 * and the org-scoped MCP tools. Behavior by identity kind:
 *  - agent: locked to its own org (unchanged); an explicit orgId that doesn't match is forbidden.
 *  - user (cookie session): an explicit orgId is required (unchanged) and checked against role.
 *  - user_key (personal key): spans every org the holder is a member of. An explicit orgId is
 *    checked against live membership; with none given, the org is picked automatically only when
 *    the holder belongs to exactly one, otherwise the caller must choose — callers surface that
 *    as `org_required` with the candidate list, never guess.
 */
export async function resolveOrgScope(db: Database, identity: Identity, requested?: string | null): Promise<OrgScope> {
  const orgId = normalizeRequested(requested);

  if (identity.kind === "agent") {
    if (orgId && orgId !== identity.orgId) return { ok: false, code: "forbidden" };
    return { ok: true, orgId: identity.orgId, role: "member" };
  }

  if (identity.kind === "user") {
    if (!orgId) return { ok: false, code: "forbidden" };
    if (identity.isSuperadmin) return { ok: true, orgId, role: "owner" };
    const role = await getOrgRole(db, orgId, identity.userId);
    if (!role) return { ok: false, code: "forbidden" };
    return { ok: true, orgId, role };
  }

  // user_key — deliberately no superadmin bypass: a personal key never exceeds the holder's
  // actual membership, even when the holder is a superadmin.
  if (orgId) {
    const role = await getOrgRole(db, orgId, identity.userId);
    if (!role) return { ok: false, code: "forbidden" };
    return { ok: true, orgId, role };
  }

  const memberships = await listOrgMembershipsForUser(db, identity.userId);
  if (memberships.length === 1) {
    const only = memberships[0]!;
    return { ok: true, orgId: only.orgId, role: only.role };
  }
  return { ok: false, code: "org_required", orgs: memberships };
}

/** Renders a failed OrgScope as the route's JSON error response. */
export function orgScopeErrorResponse(c: Context<AppBindings>, result: Extract<OrgScope, { ok: false }>) {
  if (result.code === "org_required") {
    return c.json(
      { error: { code: "org_required", message: "You belong to multiple teams — specify orgId", orgs: result.orgs } },
      400,
    );
  }
  return c.json({ error: { code: "forbidden" } }, 403);
}
