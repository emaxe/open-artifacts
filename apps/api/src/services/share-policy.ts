import { eq } from "drizzle-orm";
import { resolveSharePolicy, type DefaultShareMode, type EffectiveSharePolicy } from "@open-artifacts/shared";
import type { Database } from "../db/client.js";
import { orgs } from "../db/schema.js";
import { defaultInstanceSettings, getInstanceSettings, type InstanceSettings } from "./settings.js";
import type { Env } from "../env.js";

/** The effective share policy for one org: the instance-wide flags intersected with that org's own. */
export async function resolveOrgSharePolicy(
  db: Database,
  orgId: string,
  instance: { allowPublicShares: boolean; defaultShareMode: DefaultShareMode },
): Promise<EffectiveSharePolicy> {
  const org = await db.query.orgs.findFirst({ where: eq(orgs.id, orgId) });
  return resolveSharePolicy({
    instance,
    org: {
      allowPublicShares: org?.allowPublicShares ?? true,
      defaultShareMode: (org?.defaultShareMode as DefaultShareMode | null) ?? null,
    },
  });
}

/** Convenience for routes that hold `env` but haven't already loaded instance settings. */
export async function resolveSharePolicyForRequest(db: Database, env: Env, orgId: string): Promise<EffectiveSharePolicy> {
  const settings: InstanceSettings = await getInstanceSettings(db, defaultInstanceSettings(env));
  return resolveOrgSharePolicy(db, orgId, { allowPublicShares: settings.allowPublicShares, defaultShareMode: settings.defaultShareMode });
}
