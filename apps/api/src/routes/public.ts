import { Hono, type Context } from "hono";
import { setCookie, getCookie } from "hono/cookie";
import { nanoid } from "nanoid";
import { buildEmbedCsp, buildViewerShellCsp } from "@open-artifacts/shared";
import type { AppBindings } from "../types.js";
import { getShareByToken, incrementShareViewCount, checkShareAccess } from "../services/shares.js";
import { verifySecret } from "../services/crypto.js";
import { getArtifactWithLiveness } from "../services/artifacts.js";
import { renderArtifactHtml } from "../services/render.js";
import { recordArtifactView } from "../services/analytics.js";
import { hashIp } from "../services/audit.js";
import { getInstanceSettings, defaultInstanceSettings } from "../services/settings.js";
import { resolveViewerContext } from "../services/viewer-context.js";
import { parseVersionParam, resolveDisplayVersion } from "../services/viewer-version.js";
import { buildViewerModel } from "../services/viewer-panel.js";
import { contentDispositionValue } from "../services/download-name.js";
import { renderViewerShell, renderPasswordFormPage, renderRestrictedPage, renderErrorPage } from "../views/viewer-shell.js";

export const publicRoutes = new Hono<AppBindings>();

// In-memory unlock-session store for password-protected shares: token -> { secret, expiresAtMs }.
// Deliberately ephemeral (not persisted) — losing it on restart just means re-entering the password.
// A `team`-mode share never sets or reads this — it has no password step at all — so nothing here
// needs to change to support it; keep it that way rather than wiring the two together.
const unlockSessions = new Map<string, { secret: string; expiresAtMs: number }>();
const UNLOCK_TTL_MS = 60 * 60 * 1000;

function unlockCookieName(token: string) {
  return `oa_unlock_${token}`;
}

function isUnlocked(token: string, cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const entry = unlockSessions.get(token);
  if (!entry) return false;
  if (entry.expiresAtMs <= Date.now()) {
    unlockSessions.delete(token);
    return false;
  }
  return entry.secret === cookieValue;
}

/** Minimal, dependency-free error page for `/embed/:token` — deliberately NOT the viewer-shell
 *  template: this response is served under `buildEmbedCsp`'s policy (meant for artifact content,
 *  not for the app's own chrome) and is only ever meant to be seen inside the `/s/:token` iframe. */
function embedErrorPage(message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Unavailable</title></head><body style="font-family:sans-serif;padding:2rem;color:#444;">${message}</body></html>`;
}

/**
 * Bundles the two checks every `/s/:token` route needs before it can decide what to show: does
 * this viewer pass the share's own access matrix (mode/password/team-membership — independent of
 * anything below), and separately, how much can they manage (gates the viewer panel's detail level
 * and whether `?v=` is honored). Kept together only because every route below needs both; they
 * never influence each other — see `services/viewer-context.ts`.
 */
async function resolveShareAndAccess(c: Context<AppBindings>, token: string) {
  const db = c.get("db");
  const share = await getShareByToken(db, token);
  if (!share) return { share: null };

  const { artifact, liveness } = await getArtifactWithLiveness(db, share.artifactId);
  if (liveness === "missing" || !artifact) return { share, artifact: null, liveness };
  if (liveness !== "live") return { share, artifact, liveness };

  const ctx = await resolveViewerContext(c, artifact);
  const unlocked = share.mode === "password" ? isUnlocked(share.token, getCookie(c, unlockCookieName(share.token))) : false;
  const access = await checkShareAccess(share, { unlocked, viewer: ctx.viewer });
  return { share, artifact, liveness, ctx, access };
}

publicRoutes.get("/s/:token", async (c) => {
  const token = c.req.param("token");
  const nonce = nanoid(16);
  c.header("Cache-Control", "private, no-store");
  c.header("Vary", "Cookie");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");

  const result = await resolveShareAndAccess(c, token);
  if (!result.share) {
    c.header("Content-Security-Policy", buildViewerShellCsp({ nonce }));
    return c.html(renderErrorPage("This link does not exist.", nonce), 404);
  }
  if (!result.artifact) {
    c.header("Content-Security-Policy", buildViewerShellCsp({ nonce }));
    return c.html(renderErrorPage("This link does not exist.", nonce), 404);
  }
  if (result.liveness !== "live") {
    c.header("Content-Security-Policy", buildViewerShellCsp({ nonce }));
    return c.html(renderErrorPage("This link is no longer available.", nonce), 410);
  }
  const { share, artifact, ctx, access } = result;

  if (!access.allowed) {
    switch (access.reason) {
      case "revoked":
      case "expired":
        c.header("Content-Security-Policy", buildViewerShellCsp({ nonce }));
        return c.html(renderErrorPage("This link is no longer available.", nonce), 410);
      case "password_required":
      case "password_incorrect":
        c.header("Content-Security-Policy", buildViewerShellCsp({ nonce, allowConnectSelf: true }));
        return c.html(renderPasswordFormPage(nonce));
      case "login_required": {
        const wantsHtml = (c.req.header("accept") ?? "").includes("text/html");
        if (!wantsHtml) return c.json({ error: { code: "login_required" } }, 401);
        return c.redirect(`/login?next=${encodeURIComponent(`/s/${token}`)}`, 302);
      }
      case "not_a_member": {
        c.header("Content-Security-Policy", buildViewerShellCsp({ nonce }));
        const loginUrl = `/login?next=${encodeURIComponent(`/s/${token}`)}`;
        return c.html(renderRestrictedPage(loginUrl, nonce), 403);
      }
    }
  }

  const db = c.get("db");
  const requested = parseVersionParam(c.req.query("v"));
  const resolved = await resolveDisplayVersion(db, artifact, share, requested, ctx.canManage);
  c.header("Content-Security-Policy", buildViewerShellCsp({ nonce }));
  if (!resolved) return c.html(renderErrorPage("No content available.", nonce), 404);

  const vm = await buildViewerModel(db, { token, share, artifact, resolved, ctx });
  return c.html(renderViewerShell(vm, nonce));
});

publicRoutes.post("/s/:token/unlock", async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");
  const share = await getShareByToken(db, token);
  if (!share) return c.json({ error: { code: "not_found" } }, 404);
  if (share.revokedAt !== null || (share.expiresAt !== null && share.expiresAt.getTime() <= Date.now())) {
    return c.json({ error: { code: "gone" } }, 410);
  }
  // A team/public share has no password step at all — unlocking one is meaningless, not a no-op
  // "success" (the old behavior here silently returned `{ ok: true }` for any non-password mode).
  if (share.mode !== "password") return c.json({ error: { code: "not_password_mode" } }, 400);
  if (!share.passwordHash) return c.json({ error: { code: "gone" } }, 410);

  const body = await c.req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  const ok = await verifySecret(password, share.passwordHash);
  if (!ok) return c.json({ error: { code: "invalid_password" } }, 401);

  const secret = nanoid(32);
  const expiresAtMs = Math.min(Date.now() + UNLOCK_TTL_MS, share.expiresAt ? share.expiresAt.getTime() : Infinity);
  unlockSessions.set(token, { secret, expiresAtMs });
  setCookie(c, unlockCookieName(token), secret, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: Math.max(1, Math.floor((expiresAtMs - Date.now()) / 1000)),
  });
  return c.json({ ok: true });
});

publicRoutes.get("/embed/:token", async (c) => {
  const db = c.get("db");
  const env = c.get("env");
  const token = c.req.param("token");

  const settings = await getInstanceSettings(db, defaultInstanceSettings(env));
  // A cross-origin embed of a `team` share fails closed twice over regardless of the checks
  // below: `frame-ancestors` here only ever allows APP_ORIGIN, and even if it didn't, the
  // `oa_session`/unlock cookies are SameSite=Lax so they never ride along on a cross-site load.
  c.header("Content-Security-Policy", buildEmbedCsp({ scriptAllowlist: settings.cdnAllowlist, frameAncestor: env.APP_ORIGIN }));
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Cache-Control", "private, no-store");
  c.header("Vary", "Cookie");

  const result = await resolveShareAndAccess(c, token);
  if (!result.share) return c.html(embedErrorPage("Not found."), 404);
  if (!result.artifact) return c.html(embedErrorPage("Not found."), 404);
  if (result.liveness !== "live") return c.html(embedErrorPage("This link is no longer available."), 410);
  const { share, artifact, ctx, access } = result;

  if (!access.allowed) {
    if (access.reason === "revoked" || access.reason === "expired") return c.html(embedErrorPage("This link is no longer available."), 410);
    // /embed/:token is only ever loaded inside the /s/:token iframe, never navigated to directly —
    // there is no sensible redirect target here for `login_required`, so it's a flat 403 too.
    return c.html(embedErrorPage("Access denied."), 403);
  }

  const requested = parseVersionParam(c.req.query("v"));
  const resolved = await resolveDisplayVersion(db, artifact, share, requested, ctx.canManage);
  if (!resolved) return c.html(embedErrorPage("No content available."), 404);

  // A manager (owner/team admin/superadmin) browsing their own versions shouldn't inflate the
  // view count they're the one reading — see the "Changed" note in CHANGELOG.
  if (!ctx.canManage) {
    const ip = c.req.header("x-forwarded-for");
    recordArtifactView(db, {
      artifactId: artifact.id,
      shareId: share.id,
      ipHash: ip ? hashIp(ip, env.IP_HASH_SALT) : undefined,
      uaHash: c.req.header("user-agent") ? hashIp(c.req.header("user-agent")!, env.IP_HASH_SALT) : undefined,
      referer: c.req.header("referer"),
    }).catch((err) => console.error("failed to record view:", err));
    incrementShareViewCount(db, share.id).catch((err) => console.error("failed to bump view count:", err));
  }

  return c.html(renderArtifactHtml(artifact.kind, resolved.version.content));
});

/**
 * "Download source" — deliberately available to every audience, including anonymous visitors: for
 * `html`/`svg` this is exactly the bytes already visible via "view source" on the rendered
 * `/embed/:token` frame, so restricting it would be theater, not a real barrier.
 *
 * Every `kind` is served as `text/plain`, never as `text/html` or `image/svg+xml` — an artifact's
 * `kind: "html"` content is arbitrary author-supplied script; serving it back as `text/html` from
 * this app's own origin would execute it there, with access to `oa_session` via
 * `fetch(..., {credentials:'include'})`. That's exactly what the sandboxed `/embed` iframe and its
 * CSP exist to prevent (see `apps/api/e2e/sandbox-security.spec.ts`) — this route must not
 * reintroduce the same hole through a different door.
 */
publicRoutes.get("/s/:token/download", async (c) => {
  const token = c.req.param("token");
  const result = await resolveShareAndAccess(c, token);
  if (!result.share) return c.text("Not found.", 404);
  if (!result.artifact) return c.text("Not found.", 404);
  if (result.liveness !== "live") return c.text("This link is no longer available.", 410);
  const { share, artifact, ctx, access } = result;

  if (!access.allowed) {
    if (access.reason === "revoked" || access.reason === "expired") return c.text("This link is no longer available.", 410);
    if (access.reason === "password_required" || access.reason === "password_incorrect") return c.text("Password required.", 403);
    if (access.reason === "login_required") return c.text("Login required.", 401);
    return c.text("Access denied.", 403);
  }

  const db = c.get("db");
  const requested = parseVersionParam(c.req.query("v"));
  const resolved = await resolveDisplayVersion(db, artifact, share, requested, ctx.canManage);
  if (!resolved) return c.text("No content available.", 404);

  return c.body(resolved.version.content, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Disposition": contentDispositionValue(artifact.title, artifact.kind, resolved.version.versionNo),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "private, no-store",
    Vary: "Cookie",
  });
});
