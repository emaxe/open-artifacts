import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { and, eq, isNull } from "drizzle-orm";
import { loginSchema, registerSchema } from "@open-artifacts/shared";
import type { AppBindings } from "../types.js";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  createSession,
  deleteSession,
  registerUser,
  verifyLogin,
} from "../services/users.js";
import { invites, orgMembers, users } from "../db/schema.js";
import { getInstanceSettings, defaultInstanceSettings } from "../services/settings.js";
import { recordAudit } from "../services/audit.js";
import { SESSION_COOKIE_NAME } from "../middleware/auth.js";

export const authRoutes = new Hono<AppBindings>();

const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "Lax" as const,
  path: "/",
  maxAge: 30 * 24 * 60 * 60,
};

authRoutes.post("/auth/register", async (c) => {
  const db = c.get("db");
  const env = c.get("env");
  const body = registerSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const inviteToken = c.req.query("invite");
  const settings = await getInstanceSettings(db, defaultInstanceSettings(env));

  let invite: typeof invites.$inferSelect | undefined;
  if (inviteToken) {
    invite = await db.query.invites.findFirst({
      where: and(eq(invites.token, inviteToken), isNull(invites.acceptedAt)),
    });
    if (!invite || invite.expiresAt.getTime() <= Date.now()) {
      return c.json({ error: { code: "invalid_invite", message: "Invite is invalid or expired" } }, 400);
    }
  } else if (settings.registrationMode === "closed") {
    return c.json({ error: { code: "registration_closed", message: "Registration is closed on this instance" } }, 403);
  } else if (settings.registrationMode === "invite_only") {
    return c.json({ error: { code: "invite_required", message: "An invite is required to register" } }, 403);
  }

  try {
    const result = await registerUser(db, body.data);

    if (invite) {
      await db.transaction(async (tx) => {
        await tx.insert(orgMembers).values({ orgId: invite!.orgId, userId: result.userId, role: invite!.role });
        await tx.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite!.id));
      });
    }

    const session = await createSession(db, result.userId, { ip: c.req.header("x-forwarded-for"), userAgent: c.req.header("user-agent") });
    setCookie(c, SESSION_COOKIE_NAME, session.id, SESSION_COOKIE_OPTS);
    await recordAudit(db, {
      orgId: invite?.orgId ?? result.orgId,
      identity: { kind: "user", userId: result.userId, isSuperadmin: false },
      action: "user.register",
      targetType: "user",
      targetId: result.userId,
    });
    return c.json({ userId: result.userId, orgId: invite?.orgId ?? result.orgId }, 201);
  } catch (err) {
    if (err instanceof EmailAlreadyRegisteredError) {
      return c.json({ error: { code: "email_taken", message: err.message } }, 409);
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

authRoutes.get("/auth/me", async (c) => {
  const identity = c.get("identity");
  if (!identity || identity.kind !== "user") return c.json({ error: { code: "unauthorized" } }, 401);

  const db = c.get("db");
  const user = await db.query.users.findFirst({ where: eq(users.id, identity.userId) });
  if (!user) return c.json({ error: { code: "unauthorized" } }, 401);

  const memberships = await db.query.orgMembers.findMany({ where: eq(orgMembers.userId, identity.userId) });
  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    isSuperadmin: user.isSuperadmin,
    orgs: memberships.map((m) => ({ orgId: m.orgId, role: m.role })),
  });
});
