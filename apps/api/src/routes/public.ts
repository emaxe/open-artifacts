import { Hono } from "hono";
import { setCookie, getCookie } from "hono/cookie";
import { nanoid } from "nanoid";
import { buildEmbedCsp } from "@open-artifacts/shared";
import type { AppBindings } from "../types.js";
import { getShareByToken, incrementShareViewCount, checkShareAccess, resolveShareViewer } from "../services/shares.js";
import { resolveIdentityFromRequest } from "../middleware/auth.js";
import { verifySecret } from "../services/crypto.js";
import { getArtifactWithLiveness, getCurrentVersion } from "../services/artifacts.js";
import { renderArtifactHtml } from "../services/render.js";
import { recordArtifactView } from "../services/analytics.js";
import { hashIp } from "../services/audit.js";
import { getInstanceSettings, defaultInstanceSettings } from "../services/settings.js";

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

function errorPage(message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Unavailable</title></head><body style="font-family:sans-serif;padding:2rem;color:#444;">${message}</body></html>`;
}

publicRoutes.get("/s/:token", async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");
  const share = await getShareByToken(db, token);
  if (!share) return c.html(errorPage("This link does not exist."), 404);

  // The shell page below only renders an iframe pointed at /embed/:token — without this check it
  // would render fine even for an expired artifact, and only the inner frame would 410.
  const { artifact, liveness } = await getArtifactWithLiveness(db, share.artifactId);
  if (liveness === "missing" || !artifact) return c.html(errorPage("This link does not exist."), 404);
  if (liveness !== "live") return c.html(errorPage("This link is no longer available."), 410);

  const unlocked = share.mode === "password" ? isUnlocked(share.token, getCookie(c, unlockCookieName(share.token))) : false;
  const viewer =
    share.mode === "team" ? await resolveShareViewer(db, (await resolveIdentityFromRequest(c)).identity, artifact.orgId) : undefined;
  const access = await checkShareAccess(share, { unlocked, viewer });

  if (!access.allowed) {
    switch (access.reason) {
      case "revoked":
      case "expired":
        return c.html(errorPage("This link is no longer available."), 410);
      case "password_required":
      case "password_incorrect":
        return c.html(passwordFormPage(share.token));
      case "login_required": {
        const wantsHtml = (c.req.header("accept") ?? "").includes("text/html");
        if (!wantsHtml) return c.json({ error: { code: "login_required" } }, 401);
        return c.redirect(`/login?next=${encodeURIComponent(`/s/${token}`)}`, 302);
      }
      case "not_a_member":
        return c.html(restrictedPage(token), 403);
    }
  }

  return c.html(viewerShellPage(share.token));
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

publicRoutes.get("/embed/:token", async (c) => {
  const db = c.get("db");
  const env = c.get("env");
  const token = c.req.param("token");
  const share = await getShareByToken(db, token);

  const settings = await getInstanceSettings(db, defaultInstanceSettings(env));
  // A cross-origin embed of a `team` share fails closed twice over regardless of the checks
  // below: `frame-ancestors` here only ever allows APP_ORIGIN, and even if it didn't, the
  // `oa_session`/unlock cookies are SameSite=Lax so they never ride along on a cross-site load.
  c.header("Content-Security-Policy", buildEmbedCsp({ scriptAllowlist: settings.cdnAllowlist, frameAncestor: env.APP_ORIGIN }));
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");

  if (!share) return c.html(errorPage("Not found."), 404);

  const { artifact, liveness } = await getArtifactWithLiveness(db, share.artifactId);
  if (liveness === "missing" || !artifact) return c.html(errorPage("Not found."), 404);
  if (liveness !== "live") return c.html(errorPage("This link is no longer available."), 410);

  const unlocked = share.mode === "password" ? isUnlocked(token, getCookie(c, unlockCookieName(token))) : false;
  const viewer =
    share.mode === "team" ? await resolveShareViewer(db, (await resolveIdentityFromRequest(c)).identity, artifact.orgId) : undefined;
  const access = await checkShareAccess(share, { unlocked, viewer });

  if (!access.allowed) {
    if (access.reason === "revoked" || access.reason === "expired") return c.html(errorPage("This link is no longer available."), 410);
    // /embed/:token is only ever loaded inside the /s/:token iframe, never navigated to directly —
    // there is no sensible redirect target here for `login_required`, so it's a flat 403 too.
    return c.html(errorPage("Access denied."), 403);
  }

  const version = share.pinnedVersionId
    ? await db.query.artifactVersions.findFirst({ where: (v, { eq }) => eq(v.id, share.pinnedVersionId!) })
    : await getCurrentVersion(db, artifact);
  if (!version) return c.html(errorPage("No content available."), 404);

  const ip = c.req.header("x-forwarded-for");
  recordArtifactView(db, {
    artifactId: artifact.id,
    shareId: share.id,
    ipHash: ip ? hashIp(ip, env.IP_HASH_SALT) : undefined,
    uaHash: c.req.header("user-agent") ? hashIp(c.req.header("user-agent")!, env.IP_HASH_SALT) : undefined,
    referer: c.req.header("referer"),
  }).catch((err) => console.error("failed to record view:", err));
  incrementShareViewCount(db, share.id).catch((err) => console.error("failed to bump view count:", err));

  return c.html(renderArtifactHtml(artifact.kind, version.content));
});

function viewerShellPage(token: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shared artifact</title>
<style>html,body{margin:0;height:100%;} iframe{border:0;width:100%;height:100%;display:block;}</style>
</head><body>
<iframe src="/embed/${token}" sandbox="allow-scripts allow-forms allow-popups allow-modals"></iframe>
</body></html>`;
}

function passwordFormPage(token: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Password required</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa;}
form{background:#fff;padding:2rem;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.1);width:280px;}
input{width:100%;padding:.5rem;margin:.5rem 0;box-sizing:border-box;border:1px solid #ddd;border-radius:6px;}
button{width:100%;padding:.5rem;background:#111;color:#fff;border:0;border-radius:6px;cursor:pointer;}
p.err{color:#c00;font-size:.85rem;display:none;}</style>
</head><body>
<form id="f"><h3>This artifact is password-protected</h3>
<input type="password" id="pw" placeholder="Password" autofocus />
<button type="submit">Unlock</button>
<p class="err" id="err">Incorrect password.</p>
</form>
<script>
document.getElementById('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('pw').value;
  const res = await fetch(window.location.pathname + '/unlock', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
  });
  if (res.ok) { window.location.reload(); } else { document.getElementById('err').style.display = 'block'; }
});
</script>
</body></html>`;
}

function restrictedPage(token: string): string {
  const loginUrl = `/login?next=${encodeURIComponent(`/s/${token}`)}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Restricted</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa;color:#444;text-align:center;padding:1rem;}
a{color:#111;}</style>
</head><body>
<div>
  <h3>This link is only available to members of that team</h3>
  <p>Ask the person who shared it to invite you, <a href="${loginUrl}">log in with a different account</a>,
  or <a href="/">go to your dashboard</a>.</p>
</div>
</body></html>`;
}
