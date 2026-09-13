import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createInviteSchema, defaultShareModeSchema, orgRoleSchema } from "@open-artifacts/shared";
import type { AppBindings } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { orgMembers, orgs } from "../db/schema.js";
import { getOrgRole } from "../services/users.js";
import { recordAudit } from "../services/audit.js";
import {
  addMember,
  changeMemberRole,
  removeMember,
  slugify,
  updateOrg,
  CannotLeaveMainOrgError,
  LastOwnerError,
  NotAMemberError,
  UserNotFoundError,
  listAllOrgs,
  listOrgsForUser,
  getOrgDetail,
} from "../services/orgs.js";
import { defaultInstanceSettings, getInstanceSettings } from "../services/settings.js";
import { clampArtifactExpirations } from "../services/lifetime.js";
import { resolveOrgSharePolicy } from "../services/share-policy.js";
import { countActivePublicShares, revokeActivePublicSharesForOrg } from "../services/shares.js";
import {
  createOrReissueInvite,
  listOrgInvites,
  revokeInvite,
  AccountUnavailableError,
  AlreadyMemberError,
  InviteNotFoundError,
  InviteNotPendingError,
} from "../services/invites.js";

export const orgRoutes = new Hono<AppBindings>();

orgRoutes.get("/orgs", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const search = c.req.query("search") || undefined;
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? "20")));
  const kindParam = c.req.query("kind");
  const kind = kindParam === "main" || kindParam === "team" || kindParam === "all" ? kindParam : undefined;

  const db = c.get("db");
  const result = identity.isSuperadmin
    ? await listAllOrgs(db, { search, page, pageSize, kind }, identity.userId)
    : await listOrgsForUser(db, identity.userId, { search, page, pageSize, kind });

  return c.json({ orgs: result.orgs, total: result.total, page, pageSize });
});

orgRoutes.get("/orgs/:id", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const orgId = c.req.param("id");
  const db = c.get("db");

  const instanceSettings = await getInstanceSettings(db, defaultInstanceSettings(c.get("env")));
  const detail = await getOrgDetail(db, orgId, {
    maxArtifactLifetimeMinutes: instanceSettings.maxArtifactLifetimeMinutes,
    allowPublicShares: instanceSettings.allowPublicShares,
    defaultShareMode: instanceSettings.defaultShareMode,
  });
  if (!detail) return c.json({ error: { code: "not_found" } }, 404);

  const myRole = await getOrgRole(db, orgId, identity.userId);
  if (!myRole && !identity.isSuperadmin) return c.json({ error: { code: "forbidden" } }, 403);

  return c.json({ ...detail, myRole });
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  storageQuotaBytes: z.number().int().positive().optional(),
  // A positive integer sets a team-local ceiling (must be within the instance max); `null` reverts
  // to inheriting the instance max. `0` is rejected — "explicitly unlimited" is meaningless once
  // a finite instance max exists, and would be indistinguishable from "inherit" in the UI.
  maxArtifactLifetimeMinutes: z.number().int().positive().nullable().optional(),
  // `null` reverts to inheriting the instance default. `"password"` is not a legal default mode.
  defaultShareMode: defaultShareModeSchema.nullable().optional(),
  allowPublicShares: z.boolean().optional(),
});

orgRoutes.patch("/orgs/:id", requireAuth, async (c) => {
  const orgId = c.req.param("id");
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const body = updateOrgSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  // Renaming requires owner/admin; changing the storage quota is a superadmin-only knob.
  if (body.data.storageQuotaBytes !== undefined && !identity.isSuperadmin) {
    return c.json({ error: { code: "forbidden", message: "Only a superadmin can change the storage quota" } }, 403);
  }
  const role = await requireOrgRole(c, orgId, ["owner", "admin"]);
  if (!role) return c.json({ error: { code: "forbidden" } }, 403);

  const db = c.get("db");

  // Unlike storageQuotaBytes, a team owner/admin MAY set this themselves — but never looser than
  // the instance-wide maximum.
  let globalMaxMinutes: number | undefined;
  if (body.data.maxArtifactLifetimeMinutes !== undefined && body.data.maxArtifactLifetimeMinutes !== null) {
    const instanceSettings = await getInstanceSettings(db, defaultInstanceSettings(c.get("env")));
    globalMaxMinutes = instanceSettings.maxArtifactLifetimeMinutes;
    if (globalMaxMinutes > 0 && body.data.maxArtifactLifetimeMinutes > globalMaxMinutes) {
      return c.json(
        { error: { code: "lifetime_exceeds_max", message: "Team lifetime cannot exceed the instance maximum", maxLifetimeMinutes: globalMaxMinutes } },
        400,
      );
    }
  }

  // Same "team may only be equal-or-stricter" rule for the share policy: a team can never
  // re-enable public links the instance forbade, nor default to public while public is forbidden.
  if (body.data.allowPublicShares === true || body.data.defaultShareMode === "public") {
    const instanceSettings = await getInstanceSettings(db, defaultInstanceSettings(c.get("env")));
    if (body.data.allowPublicShares === true && !instanceSettings.allowPublicShares) {
      return c.json(
        { error: { code: "public_shares_forbidden_by_instance", message: "Public links are disabled instance-wide; a team cannot re-enable them" } },
        400,
      );
    }
    if (body.data.defaultShareMode === "public") {
      const effectiveAllowPublic = body.data.allowPublicShares ?? (await resolveOrgSharePolicy(db, orgId, instanceSettings)).allowPublicShares;
      if (!effectiveAllowPublic) {
        return c.json(
          { error: { code: "default_share_mode_forbidden", message: "Cannot default to public links while public links are disabled" } },
          400,
        );
      }
    }
  }

  const updated = await updateOrg(db, orgId, body.data);
  if (!updated) return c.json({ error: { code: "not_found" } }, 404);
  await recordAudit(db, { orgId, identity, action: "org.update", targetType: "org", targetId: orgId, meta: body.data });

  if (body.data.maxArtifactLifetimeMinutes !== undefined) {
    if (globalMaxMinutes === undefined) {
      const instanceSettings = await getInstanceSettings(db, defaultInstanceSettings(c.get("env")));
      globalMaxMinutes = instanceSettings.maxArtifactLifetimeMinutes;
    }
    await clampArtifactExpirations(db, { globalMaxMinutes, orgId });
  }

  return c.json({
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    storageQuotaBytes: updated.storageQuotaBytes,
    maxArtifactLifetimeMinutes: updated.maxArtifactLifetimeMinutes,
    defaultShareMode: updated.defaultShareMode,
    allowPublicShares: updated.allowPublicShares,
  });
});

orgRoutes.get("/orgs/:id/share-policy", requireAuth, async (c) => {
  const orgId = c.req.param("id");
  const role = await requireOrgRole(c, orgId, ["owner", "admin"]);
  if (!role) return c.json({ error: { code: "forbidden" } }, 403);

  const db = c.get("db");
  const instanceSettings = await getInstanceSettings(db, defaultInstanceSettings(c.get("env")));
  const org = await db.query.orgs.findFirst({ where: eq(orgs.id, orgId) });
  if (!org) return c.json({ error: { code: "not_found" } }, 404);

  const effective = await resolveOrgSharePolicy(db, orgId, {
    allowPublicShares: instanceSettings.allowPublicShares,
    defaultShareMode: instanceSettings.defaultShareMode,
  });
  const activePublicShares = await countActivePublicShares(db, orgId);

  return c.json({
    instance: { allowPublicShares: instanceSettings.allowPublicShares, defaultShareMode: instanceSettings.defaultShareMode },
    org: { allowPublicShares: org.allowPublicShares, defaultShareMode: org.defaultShareMode },
    effective,
    activePublicShares,
  });
});

orgRoutes.post("/orgs/:id/shares/revoke-public", requireAuth, async (c) => {
  const orgId = c.req.param("id");
  const identity = c.get("identity")!;
  const role = await requireOrgRole(c, orgId, ["owner", "admin"]);
  if (!role) return c.json({ error: { code: "forbidden" } }, 403);

  const db = c.get("db");
  const revoked = await revokeActivePublicSharesForOrg(db, orgId);
  await recordAudit(db, { orgId, identity, action: "share.bulk_revoke_public", targetType: "org", targetId: orgId, meta: { revoked } });
  return c.json({ revoked });
});

orgRoutes.post("/orgs", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);
  const body = z.object({ name: z.string().min(1).max(200) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input" } }, 400);

  const db = c.get("db");
  const [org] = await db.insert(orgs).values({ name: body.data.name, slug: slugify(body.data.name) }).returning();
  await db.insert(orgMembers).values({ orgId: org!.id, userId: identity.userId, role: "owner" });
  await recordAudit(db, { orgId: org!.id, identity, action: "org.create", targetType: "org", targetId: org!.id });
  return c.json({ id: org!.id, name: org!.name, slug: org!.slug, role: "owner" }, 201);
});

async function requireOrgRole(c: Context<AppBindings>, orgId: string, allowed: string[]) {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return null;
  if (identity.isSuperadmin) return "owner";
  const role = await getOrgRole(c.get("db"), orgId, identity.userId);
  if (!role || !allowed.includes(role)) return null;
  return role;
}

orgRoutes.get("/orgs/:id/members", requireAuth, async (c) => {
  const orgId = c.req.param("id");
  const role = await requireOrgRole(c, orgId, ["owner", "admin", "member", "viewer"]);
  if (!role) return c.json({ error: { code: "forbidden" } }, 403);

  const db = c.get("db");
  // Uses the orgMembers.user relation (schema.ts) instead of an N+1 loop of per-member user lookups.
  const memberships = await db.query.orgMembers.findMany({ where: eq(orgMembers.orgId, orgId), with: { user: true } });
  const members = memberships
    .filter((m) => m.user && m.user.status !== "deleted")
    .map((m) => ({ userId: m.userId, email: m.user!.email, name: m.user!.name, role: m.role }));
  return c.json({ members });
});

const addMemberSchema = z.object({ userId: z.string().uuid(), role: orgRoleSchema.default("member") });

// A superadmin/owner/admin shortcut to add an already-registered user directly, bypassing the
// invite round-trip — used by the admin "Добавить в команду" action.
orgRoutes.post("/orgs/:id/members", requireAuth, async (c) => {
  const orgId = c.req.param("id");
  const role = await requireOrgRole(c, orgId, ["owner", "admin"]);
  if (!role) return c.json({ error: { code: "forbidden" } }, 403);

  const body = addMemberSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const db = c.get("db");
  try {
    const result = await addMember(db, orgId, body.data.userId, body.data.role);
    await recordAudit(db, {
      orgId,
      identity: c.get("identity")!,
      action: "org.add_member",
      targetType: "user",
      targetId: body.data.userId,
      meta: { role: body.data.role, alreadyMember: result.alreadyMember },
    });
    return c.json(result, result.alreadyMember ? 200 : 201);
  } catch (err) {
    if (err instanceof UserNotFoundError) return c.json({ error: { code: "not_found", message: err.message } }, 404);
    throw err;
  }
});

orgRoutes.post("/orgs/:id/invites", requireAuth, async (c) => {
  const orgId = c.req.param("id");
  const identity = c.get("identity")!;
  const role = await requireOrgRole(c, orgId, ["owner", "admin"]);
  if (!role) return c.json({ error: { code: "forbidden" } }, 403);
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const body = createInviteSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const db = c.get("db");
  const settings = await getInstanceSettings(db, defaultInstanceSettings(c.get("env")));

  try {
    const { invite, accountExists, reissued } = await createOrReissueInvite(db, {
      orgId,
      email: body.data.email,
      role: body.data.role,
      invitedBy: identity.userId,
      ttlDays: settings.inviteTtlDays,
    });
    await recordAudit(db, {
      orgId,
      identity,
      action: "org.invite",
      targetType: "invite",
      targetId: invite.id,
      meta: { reissued },
    });
    return c.json(
      {
        id: invite.id,
        token: invite.token,
        acceptUrl: `${c.get("env").APP_ORIGIN}/invite/${invite.token}`,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt,
        accountExists,
        reissued,
      },
      201,
    );
  } catch (err) {
    if (err instanceof AlreadyMemberError) return c.json({ error: { code: "already_member", message: err.message } }, 409);
    if (err instanceof AccountUnavailableError) return c.json({ error: { code: "account_unavailable", message: err.message } }, 409);
    throw err;
  }
});

orgRoutes.get("/orgs/:id/invites", requireAuth, async (c) => {
  const orgId = c.req.param("id");
  const role = await requireOrgRole(c, orgId, ["owner", "admin"]);
  if (!role) return c.json({ error: { code: "forbidden" } }, 403);

  const status = c.req.query("status") ?? "pending";
  const db = c.get("db");
  const invites = await listOrgInvites(db, orgId, { status: status === "all" ? undefined : status });
  return c.json({ invites });
});

orgRoutes.delete("/orgs/:id/invites/:inviteId", requireAuth, async (c) => {
  const orgId = c.req.param("id");
  const inviteId = c.req.param("inviteId");
  const role = await requireOrgRole(c, orgId, ["owner", "admin"]);
  if (!role) return c.json({ error: { code: "forbidden" } }, 403);

  const db = c.get("db");
  try {
    await revokeInvite(db, orgId, inviteId);
  } catch (err) {
    if (err instanceof InviteNotFoundError) return c.json({ error: { code: "not_found", message: err.message } }, 404);
    if (err instanceof InviteNotPendingError) return c.json({ error: { code: "invite_not_pending", message: err.message } }, 409);
    throw err;
  }
  await recordAudit(db, { orgId, identity: c.get("identity")!, action: "org.invite_revoke", targetType: "invite", targetId: inviteId });
  return c.json({ ok: true });
});

orgRoutes.delete("/orgs/:id/members/:userId", requireAuth, async (c) => {
  const orgId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  const identity = c.get("identity")!;

  // Self-removal ("leave team") is allowed at any role; removing someone else still requires owner/admin.
  const isSelfLeave = identity.kind === "user" && identity.userId === targetUserId;
  if (!isSelfLeave) {
    const role = await requireOrgRole(c, orgId, ["owner", "admin"]);
    if (!role) return c.json({ error: { code: "forbidden" } }, 403);
  }

  const db = c.get("db");
  try {
    await removeMember(db, orgId, targetUserId);
  } catch (err) {
    if (err instanceof LastOwnerError) return c.json({ error: { code: "last_owner", message: err.message } }, 409);
    if (err instanceof NotAMemberError) return c.json({ error: { code: "not_found", message: err.message } }, 404);
    if (err instanceof CannotLeaveMainOrgError) return c.json({ error: { code: "cannot_leave_main_org", message: err.message } }, 409);
    throw err;
  }
  await recordAudit(db, {
    orgId,
    identity,
    action: isSelfLeave ? "org.leave" : "org.remove_member",
    targetType: "user",
    targetId: targetUserId,
  });
  return c.json({ ok: true });
});

const changeRoleSchema = z.object({ role: orgRoleSchema });

orgRoutes.patch("/orgs/:id/members/:userId", requireAuth, async (c) => {
  const orgId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  const role = await requireOrgRole(c, orgId, ["owner", "admin"]);
  if (!role) return c.json({ error: { code: "forbidden" } }, 403);

  const body = changeRoleSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const db = c.get("db");
  try {
    await changeMemberRole(db, orgId, targetUserId, body.data.role);
  } catch (err) {
    if (err instanceof LastOwnerError) return c.json({ error: { code: "last_owner", message: err.message } }, 409);
    if (err instanceof NotAMemberError) return c.json({ error: { code: "not_found", message: err.message } }, 404);
    throw err;
  }
  await recordAudit(db, { orgId, identity: c.get("identity")!, action: "org.change_role", targetType: "user", targetId: targetUserId, meta: { role: body.data.role } });
  return c.json({ ok: true });
});
