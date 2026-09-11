import { Hono } from "hono";
import type { AppBindings } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { recordAudit } from "../services/audit.js";
import {
  acceptInvite,
  declineInvite,
  getInviteByToken,
  listPendingInvitesForEmail,
  AccountUnavailableError,
  InviteEmailMismatchError,
  InviteExpiredError,
  InviteNotFoundError,
  InviteNotPendingError,
} from "../services/invites.js";

export const inviteRoutes = new Hono<AppBindings>();

function mapInviteError(err: unknown): { status: 400 | 403 | 404 | 409 | 410; code: string; message: string } | null {
  if (err instanceof InviteNotFoundError) return { status: 404, code: "not_found", message: err.message };
  if (err instanceof InviteEmailMismatchError) return { status: 403, code: "invite_email_mismatch", message: err.message };
  if (err instanceof InviteExpiredError) return { status: 410, code: "invite_expired", message: err.message };
  if (err instanceof InviteNotPendingError) return { status: 409, code: "invite_not_pending", message: err.message };
  if (err instanceof AccountUnavailableError) return { status: 409, code: "account_unavailable", message: err.message };
  return null;
}

// The only discovery channel for an existing user's pending invites — there is no email delivery
// in this project, so the web app polls this to render the "Приглашения" sidebar badge and list.
// Registered before the "/invites/:token" catch-all below: Hono matches routes in registration
// order, so a static "/invites/me" must come first or ":token" would swallow "me" as a literal token.
inviteRoutes.get("/invites/me", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const db = c.get("db");
  const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, identity.userId) });
  if (!user) return c.json({ error: { code: "unauthorized" } }, 401);

  const pending = await listPendingInvitesForEmail(db, user.email);
  return c.json({ invites: pending });
});

// Unauthenticated: this is the public landing page for a link the recipient was personally
// handed. It deliberately never returns the invite's full email (masked only) or whether an
// account already exists for it — either would turn the endpoint into an enumeration oracle.
inviteRoutes.get("/invites/:token", async (c) => {
  const db = c.get("db");
  const preview = await getInviteByToken(db, c.req.param("token"));
  if (!preview) return c.json({ error: { code: "not_found", message: "Invite not found" } }, 404);
  c.header("Cache-Control", "no-store");
  return c.json(preview);
});

inviteRoutes.post("/invites/:token/accept", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const db = c.get("db");
  const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, identity.userId) });
  if (!user) return c.json({ error: { code: "unauthorized" } }, 401);

  try {
    const result = await acceptInvite(db, c.req.param("token"), { id: user.id, email: user.email });
    await recordAudit(db, {
      orgId: result.orgId,
      identity,
      action: "org.invite_accept",
      targetType: "org",
      targetId: result.orgId,
    });
    return c.json(result);
  } catch (err) {
    const mapped = mapInviteError(err);
    if (mapped) return c.json({ error: { code: mapped.code, message: mapped.message } }, mapped.status);
    throw err;
  }
});

inviteRoutes.post("/invites/:token/decline", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const db = c.get("db");
  const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, identity.userId) });
  if (!user) return c.json({ error: { code: "unauthorized" } }, 401);

  try {
    await declineInvite(db, c.req.param("token"), { id: user.id, email: user.email });
    await recordAudit(db, { identity, action: "org.invite_decline", targetType: "invite" });
    return c.json({ ok: true });
  } catch (err) {
    const mapped = mapInviteError(err);
    if (mapped) return c.json({ error: { code: mapped.code, message: mapped.message } }, mapped.status);
    throw err;
  }
});
