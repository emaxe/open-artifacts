import { eq, sql } from "drizzle-orm";
import { effectiveLifetimeLimit, toLifetimeLimit } from "@open-artifacts/shared";
import type { Database } from "../db/client.js";
import { orgs } from "../db/schema.js";
import { defaultInstanceSettings, getInstanceSettings, type InstanceSettings } from "./settings.js";
import type { Env } from "../env.js";

/** The effective ceiling for one org: the stricter of the instance max and that org's own override. */
export async function resolveOrgLifetimeLimit(db: Database, orgId: string, globalMaxMinutes: number): Promise<number | null> {
  const org = await db.query.orgs.findFirst({ where: eq(orgs.id, orgId) });
  return effectiveLifetimeLimit(toLifetimeLimit(globalMaxMinutes), toLifetimeLimit(org?.maxArtifactLifetimeMinutes));
}

/** Convenience for routes that hold `env` but haven't already loaded instance settings. */
export async function resolveLifetimeLimitForRequest(db: Database, env: Env, orgId: string): Promise<number | null> {
  const settings: InstanceSettings = await getInstanceSettings(db, defaultInstanceSettings(env));
  return resolveOrgLifetimeLimit(db, orgId, settings.maxArtifactLifetimeMinutes);
}

/**
 * Re-clamps `expires_at` FROM `created_at` for every live artifact whose current deadline
 * exceeds its org's effective maximum. Postgres `LEAST()` ignores NULLs, which matches the
 * "NULL = unlimited" convention: `LEAST(NULL, created_at + max)` picks the finite side, so an
 * unlimited artifact is capped; an org whose effective max is still unlimited is filtered out
 * entirely by `eff.max_minutes IS NOT NULL`. The trailing comparison against the *current*
 * `expires_at` makes this idempotent and guarantees a RAISED maximum never extends anything —
 * the row is simply not touched when the new deadline would be later than the existing one.
 */
export async function clampArtifactExpirations(
  db: Database,
  opts: { globalMaxMinutes: number; orgId?: string },
): Promise<number> {
  const result = await db.execute<{ id: string }>(sql`
    UPDATE "artifacts" a
    SET "expires_at" = LEAST(a."expires_at", a."created_at" + make_interval(mins => eff.max_minutes))
    FROM (
      SELECT o."id",
             LEAST(NULLIF(${opts.globalMaxMinutes}::int, 0), NULLIF(o."max_artifact_lifetime_minutes", 0)) AS max_minutes
      FROM "orgs" o
      ${opts.orgId ? sql`WHERE o."id" = ${opts.orgId}` : sql``}
    ) eff
    WHERE a."org_id" = eff."id"
      AND eff.max_minutes IS NOT NULL
      AND a."purged_at" IS NULL
      AND (a."expires_at" IS NULL OR a."expires_at" > a."created_at" + make_interval(mins => eff.max_minutes))
    RETURNING a."id"
  `);
  return result.rowCount ?? result.rows.length;
}

/** Keeps stored team overrides truthful after the instance maximum is lowered — otherwise a team's stored override could claim a value looser than what actually applies. */
export async function clampOrgLifetimeOverrides(db: Database, globalMaxMinutes: number): Promise<void> {
  if (globalMaxMinutes <= 0) return; // unlimited global bounds nothing
  await db.execute(sql`
    UPDATE "orgs"
    SET "max_artifact_lifetime_minutes" = ${globalMaxMinutes}
    WHERE "max_artifact_lifetime_minutes" IS NOT NULL AND "max_artifact_lifetime_minutes" > ${globalMaxMinutes}
  `);
}
