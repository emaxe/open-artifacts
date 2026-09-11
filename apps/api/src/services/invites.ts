import { and, eq, gt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { OrgRole } from "@open-artifacts/shared";
import type { Database } from "../db/client.js";
import { invites, orgMembers, users } from "../db/schema.js";

export class InviteNotFoundError extends Error {
  constructor() {
    super("Invite not found");
  }
}

export class InviteNotPendingError extends Error {
  constructor(public status: string) {
    super(`Invite is already ${status}`);
  }
}

export class InviteExpiredError extends Error {
  constructor() {
    super("Invite has expired");
  }
}

export class InviteEmailMismatchError extends Error {
  constructor(public inviteEmail: string) {
    super("This invite was issued to a different email address");
  }
}

export class AlreadyMemberError extends Error {
  constructor() {
    super("This user is already a member of the org");
  }
}

export class AccountUnavailableError extends Error {
  constructor() {
    super("This account cannot be invited right now");
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isExpired(invite: { expiresAt: Date }): boolean {
  return invite.expiresAt.getTime() <= Date.now();
}

/** "ivan.petrov@example.com" -> "i***v@example.com" — enough to recognize the address, not enough to leak it. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

type InviteRow = typeof invites.$inferSelect;

export interface CreateInviteResult {
  invite: InviteRow;
  accountExists: boolean;
  reissued: boolean;
}

/**
 * Creates a pending invite, or — if one is already pending for this (org, email) — reissues it:
 * new token, new TTL, new role/inviter. This is the only write path for invite creation; there is
 * deliberately no separate "resend" endpoint, since a reissue already invalidates the old link.
 */
export async function createOrReissueInvite(
  db: Database,
  input: { orgId: string; email: string; role: OrgRole; invitedBy: string; ttlDays: number },
): Promise<CreateInviteResult> {
  const email = normalizeEmail(input.email);
  const expiresAt = new Date(Date.now() + input.ttlDays * 24 * 60 * 60 * 1000);

  const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existingUser) {
    if (existingUser.status !== "active") throw new AccountUnavailableError();
    const membership = await db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.userId, existingUser.id)),
    });
    if (membership) throw new AlreadyMemberError();
  }

  return db.transaction(async (tx) => {
    const existingPending = await tx.query.invites.findFirst({
      where: and(eq(invites.orgId, input.orgId), eq(invites.email, email), eq(invites.status, "pending")),
    });

    if (existingPending) {
      const [updated] = await tx
        .update(invites)
        .set({
          token: nanoid(32),
          role: input.role,
          invitedBy: input.invitedBy,
          invitedUserId: existingUser?.id ?? null,
          expiresAt,
        })
        .where(eq(invites.id, existingPending.id))
        .returning();
      return { invite: updated!, accountExists: !!existingUser, reissued: true };
    }

    const [created] = await tx
      .insert(invites)
      .values({
        orgId: input.orgId,
        email,
        role: input.role,
        token: nanoid(32),
        invitedBy: input.invitedBy,
        invitedUserId: existingUser?.id ?? null,
        expiresAt,
      })
      .returning();
    return { invite: created!, accountExists: !!existingUser, reissued: false };
  });
}

export interface InviteListItem extends InviteRow {
  inviterName: string | null;
  inviterEmail: string | null;
  expired: boolean;
}

export async function listOrgInvites(db: Database, orgId: string, opts: { status?: string } = {}): Promise<InviteListItem[]> {
  const where = opts.status
    ? and(eq(invites.orgId, orgId), eq(invites.status, opts.status as InviteRow["status"]))
    : eq(invites.orgId, orgId);
  const rows = await db.query.invites.findMany({
    where,
    orderBy: (i, { desc }) => [desc(i.createdAt)],
    with: { inviter: true },
  });
  return rows.map((r) => ({
    ...r,
    inviterName: r.inviter?.name ?? null,
    inviterEmail: r.inviter?.email ?? null,
    expired: isExpired(r),
  }));
}

/** Revoking an already-revoked invite is a no-op success (idempotent); any other non-pending status is an error. */
export async function revokeInvite(db: Database, orgId: string, inviteId: string): Promise<void> {
  const result = await db
    .update(invites)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(and(eq(invites.id, inviteId), eq(invites.orgId, orgId), eq(invites.status, "pending")))
    .returning({ id: invites.id });
  if (result.length === 0) {
    const existing = await db.query.invites.findFirst({ where: and(eq(invites.id, inviteId), eq(invites.orgId, orgId)) });
    if (!existing) throw new InviteNotFoundError();
    if (existing.status === "revoked") return;
    throw new InviteNotPendingError(existing.status);
  }
}

export interface InvitePreview {
  orgId: string;
  orgName: string;
  orgKind: "main" | "team";
  inviterName: string | null;
  role: OrgRole;
  emailMasked: string;
  status: InviteRow["status"];
  expired: boolean;
}

export async function getInviteByToken(db: Database, token: string): Promise<InvitePreview | null> {
  const invite = await db.query.invites.findFirst({
    where: eq(invites.token, token),
    with: { inviter: true, org: true },
  });
  if (!invite) return null;
  return {
    orgId: invite.orgId,
    orgName: invite.org.name,
    orgKind: invite.org.kind,
    inviterName: invite.inviter?.name ?? null,
    role: invite.role,
    emailMasked: maskEmail(invite.email),
    status: invite.status,
    expired: isExpired(invite),
  };
}

export interface AcceptInviteResult {
  orgId: string;
  orgName: string;
  role: OrgRole;
  alreadyMember: boolean;
}

/**
 * Accepts an invite on behalf of `user`. Authorization is always the live `invites.email ===
 * user.email` check — `invitedUserId` is a denormalized convenience only, never trusted here, so
 * this behaves correctly even if the invitee changed their email after being invited.
 */
export async function acceptInvite(db: Database, token: string, user: { id: string; email: string }): Promise<AcceptInviteResult> {
  return db.transaction(async (tx) => {
    const invite = await tx.query.invites.findFirst({ where: eq(invites.token, token), with: { org: true } });
    if (!invite) throw new InviteNotFoundError();
    if (normalizeEmail(user.email) !== invite.email) throw new InviteEmailMismatchError(invite.email);

    if (invite.status !== "pending") {
      // Idempotent: if it was already accepted by this same person (e.g. a double click,
      // or racing tabs), just confirm membership rather than erroring.
      if (invite.status === "accepted") {
        const membership = await tx.query.orgMembers.findFirst({
          where: and(eq(orgMembers.orgId, invite.orgId), eq(orgMembers.userId, user.id)),
        });
        if (membership) return { orgId: invite.orgId, orgName: invite.org.name, role: invite.role, alreadyMember: true };
      }
      throw new InviteNotPendingError(invite.status);
    }
    if (isExpired(invite)) throw new InviteExpiredError();

    const membership = await tx.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, invite.orgId), eq(orgMembers.userId, user.id)),
    });

    // Guarded UPDATE: only transitions a row that is still pending, so two racing accept calls
    // (two tabs, a retry) can't both succeed — the loser gets InviteNotPendingError above on retry.
    const [updated] = await tx
      .update(invites)
      .set({ status: "accepted", respondedAt: new Date(), invitedUserId: user.id })
      .where(and(eq(invites.id, invite.id), eq(invites.status, "pending")))
      .returning({ id: invites.id });
    if (!updated) throw new InviteNotPendingError("accepted");

    if (!membership) {
      await tx.insert(orgMembers).values({ orgId: invite.orgId, userId: user.id, role: invite.role });
    }

    return { orgId: invite.orgId, orgName: invite.org.name, role: invite.role, alreadyMember: !!membership };
  });
}

export async function declineInvite(db: Database, token: string, user: { id: string; email: string }): Promise<void> {
  const invite = await db.query.invites.findFirst({ where: eq(invites.token, token) });
  if (!invite) throw new InviteNotFoundError();
  if (normalizeEmail(user.email) !== invite.email) throw new InviteEmailMismatchError(invite.email);

  const result = await db
    .update(invites)
    .set({ status: "declined", respondedAt: new Date(), invitedUserId: user.id })
    .where(and(eq(invites.id, invite.id), eq(invites.status, "pending")))
    .returning({ id: invites.id });
  if (result.length === 0) throw new InviteNotPendingError(invite.status);
}

export interface PendingInviteForUser {
  id: string;
  token: string;
  orgId: string;
  orgName: string;
  orgKind: "main" | "team";
  role: OrgRole;
  inviterName: string | null;
  expiresAt: Date;
  expired: boolean;
}

export async function listPendingInvitesForEmail(db: Database, email: string): Promise<PendingInviteForUser[]> {
  const normalized = normalizeEmail(email);
  const rows = await db.query.invites.findMany({
    where: and(eq(invites.email, normalized), eq(invites.status, "pending")),
    orderBy: (i, { desc }) => [desc(i.createdAt)],
    with: { org: true, inviter: true },
  });
  return rows
    .filter((r) => !isExpired(r))
    .map((r) => ({
      id: r.id,
      token: r.token,
      orgId: r.orgId,
      orgName: r.org.name,
      orgKind: r.org.kind,
      role: r.role,
      inviterName: r.inviter?.name ?? null,
      expiresAt: r.expiresAt,
      expired: false,
    }));
}

export async function countPendingInvitesForEmail(db: Database, email: string): Promise<number> {
  const normalized = normalizeEmail(email);
  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(invites)
    .where(and(eq(invites.email, normalized), eq(invites.status, "pending"), gt(invites.expiresAt, new Date())));
  return Number(countRow?.n ?? 0);
}
