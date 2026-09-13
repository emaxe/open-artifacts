import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { ShareViewer, ArtifactAccessResult } from "@open-artifacts/shared";
import type { AppBindings, Identity } from "../types.js";
import { SESSION_COOKIE_NAME, resolveIdentityFromRequest } from "../middleware/auth.js";
import { resolveShareViewer } from "./shares.js";
import { resolveAccessForIdentity } from "./artifacts.js";
import type { artifacts } from "../db/schema.js";

/**
 * `manager` = full write access (`resolveOrgArtifactAccess.write`) — the artifact's owner, an
 * owner/admin of its team, or a superadmin. `member` = logged in and a member (any role) of the
 * artifact's team without write access. `anon` = everyone else, including a logged-in user from an
 * unrelated team. A property of the VIEWER, not of the share's own mode: a team member gets the
 * `member` panel on a `public` share too, not only on a `team` share.
 */
export type ViewerAudience = "anon" | "member" | "manager";

export interface ViewerContext {
  identity: Identity | null;
  viewer: ShareViewer;
  access: ArtifactAccessResult;
  canManage: boolean;
  audience: ViewerAudience;
}

const ANON_VIEWER: ShareViewer = { authenticated: false, isOrgMember: false };
const DENY_ACCESS: ArtifactAccessResult = { read: false, write: false, delete: false };
const ANON_CONTEXT: ViewerContext = { identity: null, viewer: ANON_VIEWER, access: DENY_ACCESS, canManage: false, audience: "anon" };

/**
 * The one place `/s/:token` and `/embed/:token` resolve "who is looking at this". Calls
 * `resolveIdentityFromRequest` at most once per request (never as blanket middleware — most of
 * this route's traffic is fully anonymous) and derives both axes a viewer needs:
 *  - `viewer` / `checkShareAccess` decide whether they see the page AT ALL (share mode/password/
 *    team membership) — untouched by anything below;
 *  - `access` / `canManage` decide how much the panel tells them and whether `?v=` is honored —
 *    independent of the first axis. These never cross: e.g. the artifact's owner does NOT bypass
 *    a password-protected share just because they can manage the artifact.
 */
export async function resolveViewerContext(c: Context<AppBindings>, artifact: typeof artifacts.$inferSelect): Promise<ViewerContext> {
  // Cheap guard for the fully-anonymous case, which is most of this route's traffic: zero DB
  // round-trips when there's neither a session cookie nor a bearer token to resolve.
  const hasCreds = Boolean(getCookie(c, SESSION_COOKIE_NAME)) || (c.req.header("authorization")?.startsWith("Bearer ") ?? false);
  if (!hasCreds) return ANON_CONTEXT;

  const db = c.get("db");
  const { identity } = await resolveIdentityFromRequest(c);
  const viewer = await resolveShareViewer(db, identity, artifact.orgId);
  const access = identity ? await resolveAccessForIdentity(db, identity, artifact) : DENY_ACCESS;
  const canManage = access.write;
  const audience: ViewerAudience = canManage ? "manager" : viewer.isOrgMember ? "member" : "anon";
  return { identity, viewer, access, canManage, audience };
}
