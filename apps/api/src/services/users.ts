import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { apiKeys, orgMembers, orgs, sessions, users } from "../db/schema.js";
import { hashSecret, verifySecret } from "./crypto.js";
import { createMainOrg } from "./orgs.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with this email already exists");
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
  }
}

export interface RegisterResult {
  userId: string;
  mainOrgId: string;
}

/**
 * Registers a user and, in the same transaction, provisions their "main" workspace — every user
 * gets exactly one, and it's where they land immediately after signing up, invite or not.
 */
export async function registerUser(
  db: Database,
  input: { email: string; password: string; name: string; isSuperadmin?: boolean },
): Promise<RegisterResult> {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email.toLowerCase()) });
  if (existing) throw new EmailAlreadyRegisteredError();

  const passwordHash = await hashSecret(input.password);
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        isSuperadmin: input.isSuperadmin ?? false,
      })
      .returning();
    const mainOrg = await createMainOrg(tx as unknown as Database, user!.id, "Основное пространство");
    return { userId: user!.id, mainOrgId: mainOrg.id };
  });
}

export class AccountInactiveError extends Error {
  constructor(public status: "blocked" | "deleted") {
    super(status === "blocked" ? "This account has been blocked" : "This account no longer exists");
  }
}

export class CannotModifySuperadminError extends Error {
  constructor() {
    super("Cannot change status of the superadmin account");
  }
}

export async function verifyLogin(db: Database, email: string, password: string) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
  if (!user) throw new InvalidCredentialsError();
  const ok = await verifySecret(password, user.passwordHash);
  if (!ok) throw new InvalidCredentialsError();
  if (user.status !== "active") throw new AccountInactiveError(user.status);
  return user;
}

export async function createSession(
  db: Database,
  userId: string,
  meta: { ip?: string; userAgent?: string } = {},
) {
  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    .returning();
  return session!;
}

export async function getSessionWithUser(db: Database, sessionId: string) {
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) return null;
  return { session, user };
}

export async function deleteSession(db: Database, sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function getOrgRole(db: Database, orgId: string, userId: string) {
  const membership = await db.query.orgMembers.findFirst({
    where: (m, { and, eq }) => and(eq(m.orgId, orgId), eq(m.userId, userId)),
  });
  return membership?.role ?? null;
}

export async function setUserStatus(db: Database, userId: string, status: "active" | "blocked" | "deleted") {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error("User not found");
  if (user.isSuperadmin) throw new CannotModifySuperadminError();

  await db.transaction(async (tx) => {
    await tx.update(users).set({ status }).where(eq(users.id, userId));
    if (status !== "active") {
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      // Personal API keys act as the user across every org they're in — block/delete must kill
      // that access immediately, the same way it kills the session. (verifyApiKeyToken also
      // re-checks user.status on every request, but that's within the 60s positive-result cache.)
      await tx.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
    }
    // Deliberately NOT deleting org_members here (changed from the original behavior). With every
    // user owning an auto-provisioned "main" workspace, wiping memberships on delete would orphan
    // that org's artifacts under zero owners. A deleted account can't authenticate — verifyLogin
    // rejects it and its sessions are purged above — so the rows are already inert; keeping them
    // preserves ownership and keeps the org's member list auditable. Member-listing queries
    // exclude deleted users instead (see listOrgMembers / countMembers in services/orgs.ts).
  });
}

export async function updateOwnAccount(
  db: Database,
  userId: string,
  input: { currentPassword: string; email?: string; name?: string; newPassword?: string },
) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new InvalidCredentialsError();
  const ok = await verifySecret(input.currentPassword, user.passwordHash);
  if (!ok) throw new InvalidCredentialsError();

  if (input.email && input.email.toLowerCase() !== user.email) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, input.email.toLowerCase()) });
    if (existing) throw new EmailAlreadyRegisteredError();
  }

  const patch: Partial<typeof users.$inferInsert> = {};
  if (input.email) patch.email = input.email.toLowerCase();
  if (input.name) patch.name = input.name;
  if (input.newPassword) patch.passwordHash = await hashSecret(input.newPassword);

  const [updated] = await db.update(users).set(patch).where(eq(users.id, userId)).returning();
  return updated!;
}
