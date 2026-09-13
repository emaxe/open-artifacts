import { eq } from "drizzle-orm";
import { DEFAULT_CDN_ALLOWLIST, type DefaultShareMode } from "@open-artifacts/shared";
import type { Database } from "../db/client.js";
import { settings } from "../db/schema.js";

export interface InstanceSettings {
  registrationMode: "open" | "invite_only" | "closed";
  defaultKeyTtlDays: number;
  cdnAllowlist: string[];
  viewRetentionDays: number;
  maxArtifactSizeBytes: number;
  inviteTtlDays: number;
  /**
   * Maximum AND default artifact lifetime, in minutes. `0` = unlimited (the pre-existing
   * behavior, and the default after upgrade — no change until a superadmin sets this).
   * Teams may set their own stricter override (`orgs.maxArtifactLifetimeMinutes`), but never
   * looser than this. See `services/lifetime.ts`.
   */
  maxArtifactLifetimeMinutes: number;
  /** Instance-wide kill switch for `public` share links. A team may be stricter, never looser — see `services/share-policy.ts`. */
  allowPublicShares: boolean;
  /**
   * Link mode used when a caller creates a share without naming one. Teams may override this per
   * team (`orgs.defaultShareMode`); this is only the inherited value, NOT a floor — see
   * `packages/shared/src/share-policy.ts` for why the two knobs (this one and `allowPublicShares`)
   * play different roles.
   */
  defaultShareMode: DefaultShareMode;
}

export function defaultInstanceSettings(env: { DEFAULT_REGISTRATION_MODE: string; DEFAULT_KEY_TTL_DAYS: number }): InstanceSettings {
  return {
    registrationMode: env.DEFAULT_REGISTRATION_MODE as InstanceSettings["registrationMode"],
    defaultKeyTtlDays: env.DEFAULT_KEY_TTL_DAYS,
    cdnAllowlist: DEFAULT_CDN_ALLOWLIST,
    viewRetentionDays: 30,
    maxArtifactSizeBytes: 5 * 1024 * 1024,
    inviteTtlDays: 7,
    maxArtifactLifetimeMinutes: 0,
    allowPublicShares: true,
    defaultShareMode: "team",
  };
}

const SETTINGS_KEY = "instance";

export async function getInstanceSettings(db: Database, fallback: InstanceSettings): Promise<InstanceSettings> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, SETTINGS_KEY) });
  if (!row) return fallback;
  return { ...fallback, ...(row.value as Partial<InstanceSettings>) };
}

export async function updateInstanceSettings(db: Database, patch: Partial<InstanceSettings>, current: InstanceSettings) {
  const next = { ...current, ...patch };
  await db
    .insert(settings)
    .values({ key: SETTINGS_KEY, value: next })
    .onConflictDoUpdate({ target: settings.key, set: { value: next } });
  return next;
}
