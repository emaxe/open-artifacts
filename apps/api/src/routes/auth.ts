import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { and, eq } from "drizzle-orm";
import { loginSchema, registerSchema } from "@open-artifacts/shared";
import type { AppBindings } from "../types.js";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  AccountInactiveError,
  createSession,
  deleteSession,
  registerUser,
  verifyLogin,
  updateOwnAccount,
} from "../services/users.js";
import { invites, orgMembers, users } from "../db/schema.js";
import { getInstanceSettings, defaultInstanceSettings } from "../services/settings.js";
import { recordAudit } from "../services/audit.js";
import { SESSION_COOKIE_NAME, requireAuth } from "../middleware/auth.js";
import { acceptInvite, countPendingInvitesForEmail, normalizeEmail } from "../services/invites.js";
import { z } from "zod";

export const authRoutes = new Hono<AppBindings>();

const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "Lax" as const,
  path: "/",
  maxAge: 30 * 24 * 60 * 60,
};

// Used only when registering via an invite token: the public invite preview never reveals the
// real email (see services/invites.ts's maskEmail), so the web form can't prefill or submit it —
// the server derives it from the invite instead. `email` stays optional here only so a raw API
// caller can still assert it if they already know it; when they do, it's checked against the
// invite below rather than silently ignored.
const registerViaInviteSchema = z.object({
  name: z.string().min(1).max(200),
  password: z.string().min(8).max(200),
  email: z.string().email().optional(),
});

authRoutes.post("/auth/register", async (c) => {
  const db = c.get("db");
  const env = c.get("env");
  const rawBody = await c.req.json().catch(() => ({}));

  const inviteToken = c.req.query("invite");
  const settings = await getInstanceSettings(db, defaultInstanceSettings(env));

  let invite: typeof invites.$inferSelect | undefined;
  if (inviteToken) {
    invite = await db.query.invites.findFirst({
      where: and(eq(invites.token, inviteToken), eq(invites.status, "pending")),
    });
    if (!invite || invite.expiresAt.getTime() <= Date.now()) {
      return c.json({ error: { code: "invalid_invite", message: "Invite is invalid or expired" } }, 400);
    }
  } else if (settings.registrationMode === "closed") {
    return c.json({ error: { code: "registration_closed", message: "Registration is closed on this instance" } }, 403);
  } else if (settings.registrationMode === "invite_only") {
    return c.json({ error: { code: "invite_required", message: "An invite is required to register" } }, 403);
  }

  const body = invite ? registerViaInviteSchema.safeParse(rawBody) : registerSchema.safeParse(rawBody);
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  let effectiveEmail: string;
  if (invite) {
    // Reject a mismatched email loudly rather than silently substituting the invite's address —
    // only reachable by a raw API caller who chose to assert one; the web UI never sends this field.
    if ("email" in body.data && body.data.email && normalizeEmail(body.data.email) !== invite.email) {
      return c.json({ error: { code: "invite_email_mismatch", message: "This invite was issued to a different email address" } }, 400);
    }
    effectiveEmail = invite.email;
  } else {
    effectiveEmail = (body.data as { email: string }).email;
  }

  try {
    const result = await registerUser(db, { name: body.data.name, password: body.data.password, email: effectiveEmail });

    if (invite) {
      // Reuses the same acceptance path an already-registered user goes through — no duplicated
      // transaction logic between "register with an invite" and "accept an invite".
      await acceptInvite(db, invite.token, { id: result.userId, email: effectiveEmail });
    }

    const session = await createSession(db, result.userId, { ip: c.req.header("x-forwarded-for"), userAgent: c.req.header("user-agent") });
    setCookie(c, SESSION_COOKIE_NAME, session.id, SESSION_COOKIE_OPTS);
    await recordAudit(db, {
      orgId: invite?.orgId,
      identity: { kind: "user", userId: result.userId, isSuperadmin: false },
      action: "user.register",
      targetType: "user",
      targetId: result.userId,
    });
    return c.json({ userId: result.userId, mainOrgId: result.mainOrgId, orgId: invite?.orgId ?? null }, 201);
  } catch (err) {
    if (err instanceof EmailAlreadyRegisteredError) {
      // Surface the invite token so the web app can bounce to a login screen that returns
      // straight to /invite/:token instead of dead-ending on "email taken".
      return c.json({ error: { code: "email_taken", message: err.message }, inviteToken: invite?.token ?? null }, 409);
    }
    throw err;
  }
});

authRoutes.post("/auth/login", async (c) => {
  const db = c.get("db");
  const body = loginSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  try {
    const user = await verifyLogin(db, body.data.email, body.data.password);
    const session = await createSession(db, user.id, { ip: c.req.header("x-forwarded-for"), userAgent: c.req.header("user-agent") });
    setCookie(c, SESSION_COOKIE_NAME, session.id, SESSION_COOKIE_OPTS);
    return c.json({ userId: user.id });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      return c.json({ error: { code: "invalid_credentials", message: err.message } }, 401);
    }
    if (err instanceof AccountInactiveError) {
      return c.json({ error: { code: `account_${err.status}`, message: err.message } }, 403);
    }
    throw err;
  }
});

authRoutes.post("/auth/logout", async (c) => {
  const db = c.get("db");
  const identity = c.get("identity");
  const cookieValue = c.req.header("cookie");
  if (identity?.kind === "user" && cookieValue) {
    const match = /oa_session=([^;]+)/.exec(cookieValue);
    if (match) await deleteSession(db, match[1]!);
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});

const updateMeSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(200).optional(),
  newPassword: z.string().min(8).max(200).optional(),
  currentPassword: z.string().min(1),
});

authRoutes.patch("/auth/me", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const body = updateMeSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const db = c.get("db");
  try {
    const updated = await updateOwnAccount(db, identity.userId, body.data);
    return c.json({ id: updated.id, email: updated.email, name: updated.name });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) return c.json({ error: { code: "invalid_credentials", message: err.message } }, 401);
    if (err instanceof EmailAlreadyRegisteredError) return c.json({ error: { code: "email_taken", message: err.message } }, 409);
    throw err;
  }
});

authRoutes.get("/auth/me", async (c) => {
  const identity = c.get("identity");
  if (!identity || identity.kind !== "user") return c.json({ error: { code: "unauthorized" } }, 401);

  const db = c.get("db");
  const user = await db.query.users.findFirst({ where: eq(users.id, identity.userId) });
  if (!user) return c.json({ error: { code: "unauthorized" } }, 401);

  // Own memberships only — for everyone, including superadmins. Superadmins previously saw every
  // org in the instance here, which stops making sense once every user has their own auto-
  // provisioned "main" workspace: the list would be dominated by other people's personal orgs.
  // A superadmin reaches orgs they don't belong to through GET /orgs?search= on demand instead.
  const memberships = await db.query.orgMembers.findMany({
    where: eq(orgMembers.userId, identity.userId),
    with: { org: true },
  });
  const orgList = memberships
    .filter((m) => m.org)
    .map((m) => ({ orgId: m.orgId, name: m.org!.name, slug: m.org!.slug, kind: m.org!.kind, role: m.role }));
  const mainOrgId = memberships.find((m) => m.org?.kind === "main")?.orgId ?? null;
  const pendingInviteCount = await countPendingInvitesForEmail(db, user.email);

  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    isSuperadmin: user.isSuperadmin,
    orgs: orgList,
    mainOrgId,
    pendingInviteCount,
  });
});
