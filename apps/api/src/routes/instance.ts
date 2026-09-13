import { Hono } from "hono";
import type { AppBindings } from "../types.js";
import { getInstanceSettings, defaultInstanceSettings } from "../services/settings.js";

export const instanceRoutes = new Hono<AppBindings>();

/**
 * Public and unauthenticated — the only fact the signed-out landing page needs in order to render
 * honestly (whether to offer a registration tab at all). Deliberately one field: `POST
 * /auth/register` already answers `registration_closed` / `invite_required` before it inspects any
 * credential (see routes/auth.ts), so this discloses nothing new — it just lets the page ask
 * *before* it advertises a form that can only 403. Never widen this to the rest of
 * InstanceSettings (cdnAllowlist, quotas, TTLs) — that stays admin-only, see routes/admin.ts.
 */
instanceRoutes.get("/instance/config", async (c) => {
  const settings = await getInstanceSettings(c.get("db"), defaultInstanceSettings(c.get("env")));
  c.header("Cache-Control", "public, max-age=60");
  return c.json({ registrationMode: settings.registrationMode });
});
