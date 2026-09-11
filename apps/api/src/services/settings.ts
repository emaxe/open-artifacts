import { eq } from "drizzle-orm";
import { DEFAULT_CDN_ALLOWLIST } from "@open-artifacts/shared";
import type { Database } from "../db/client.js";
import { settings } from "../db/schema.js";

export interface InstanceSettings {
  registrationMode: "open" | "invite_only" | "closed";
  defaultKeyTtlDays: number;
  cdnAllowlist: string[];
  viewRetentionDays: number;
  maxArtifactSizeBytes: number;
  inviteTtlDays: number;
}

export function defaultInstanceSettings(env: { DEFAULT_REGISTRATION_MODE: string; DEFAULT_KEY_TTL_DAYS: number }): InstanceSettings {
  return {
    registrationMode: env.DEFAULT_REGISTRATION_MODE as InstanceSettings["registrationMode"],
    defaultKeyTtlDays: env.DEFAULT_KEY_TTL_DAYS,
    cdnAllowlist: DEFAULT_CDN_ALLOWLIST,
    viewRetentionDays: 30,
    maxArtifactSizeBytes: 5 * 1024 * 1024,
    inviteTtlDays: 7,
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
