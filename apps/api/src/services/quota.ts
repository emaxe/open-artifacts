import { and, eq, sql } from "drizzle-orm";
import { effectiveQuotaLimit, quotaRemaining, toQuotaLimit } from "@open-artifacts/shared";
import type { Database, DbOrTx } from "../db/client.js";
import type { Env } from "../env.js";
import { artifacts, orgs } from "../db/schema.js";
import { liveArtifactWhere } from "./artifact-liveness.js";
import { defaultInstanceSettings, getInstanceSettings, type InstanceSettings } from "./settings.js";
import { resolveOrgLifetimeLimit } from "./lifetime.js";
import { INLINE_CONTENT_TYPES } from "./file-types.js";

export class QuotaExceededError extends Error {
  constructor(
    public readonly scope: "org" | "artifact",
    public readonly limitBytes: number,
    public readonly usedBytes: number,
  ) {
    super(scope === "org" ? "Team storage quota exceeded" : "Artifact storage quota exceeded");
  }
}

export interface EffectiveQuota {
  /** `null` = unlimited. The stricter (smaller) of the instance setting and the team's own override always wins. */
  orgLimitBytes: number | null;
  artifactLimitBytes: number | null;
}

/** Resolves the two effective byte ceilings for one org: instance-wide setting intersected with that org's own override (never looser). */
export async function resolveQuotaForOrg(db: DbOrTx, orgId: string, instance: InstanceSettings): Promise<EffectiveQuota> {
  const org = await db.query.orgs.findFirst({ where: eq(orgs.id, orgId) });
  return {
    orgLimitBytes: effectiveQuotaLimit(toQuotaLimit(instance.orgQuotaBytes), toQuotaLimit(org?.storageQuotaBytes)),
    artifactLimitBytes: effectiveQuotaLimit(toQuotaLimit(instance.artifactQuotaBytes), toQuotaLimit(org?.artifactQuotaBytes)),
  };
}

/** Convenience for routes/tools that hold `env` but haven't already loaded instance settings. */
export async function resolveQuotaForRequest(db: Database, env: Env, orgId: string): Promise<EffectiveQuota> {
  const instance = await getInstanceSettings(db, defaultInstanceSettings(env));
  return resolveQuotaForOrg(db, orgId, instance);
}

export interface ArtifactCeilings {
  maxLifetimeMinutes: number | null;
  maxArtifactSizeBytes: number;
  quota: EffectiveQuota;
}

/**
 * Everything `createArtifact`/`updateArtifact`/`restoreVersion` need resolved from policy, in one
 * settings read — the one-stop call every artifact-writing route/MCP-tool makes so none of them
 * can skip a ceiling the way the old bare `MAX_ARTIFACT_SIZE_BYTES` constant did.
 */
export async function resolveArtifactCeilings(db: Database, env: Env, orgId: string): Promise<ArtifactCeilings> {
  const instance = await getInstanceSettings(db, defaultInstanceSettings(env));
  const [quota, maxLifetimeMinutes] = await Promise.all([
    resolveQuotaForOrg(db, orgId, instance),
    resolveOrgLifetimeLimit(db, orgId, instance.maxArtifactLifetimeMinutes),
  ]);
  return { maxLifetimeMinutes, maxArtifactSizeBytes: instance.maxArtifactSizeBytes, quota };
}

/** Total live bytes (source + files) for one org — the number every quota check and every usage display is built from. */
export async function getOrgUsageBytes(db: DbOrTx, orgId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${artifacts.sizeBytes} + ${artifacts.filesBytes}), 0)` })
    .from(artifacts)
    .where(and(eq(artifacts.orgId, orgId), liveArtifactWhere()));
  return Number(rows[0]!.total);
}

/** Total live bytes (source + files) for one artifact. */
export async function getArtifactUsageBytes(db: DbOrTx, artifactId: string): Promise<{ sourceBytes: number; fileBytes: number }> {
  const row = await db.query.artifacts.findFirst({
    where: eq(artifacts.id, artifactId),
    columns: { sizeBytes: true, filesBytes: true },
  });
  return { sourceBytes: row?.sizeBytes ?? 0, fileBytes: Number(row?.filesBytes ?? 0) };
}

/**
 * The single quota gate for both artifact source text and uploaded files. `orgUsedBytesExcluding`
 * lets a caller updating an existing artifact pass "org total minus this artifact's OLD size" so
 * growing one artifact isn't double-counted against itself; `artifactUsedBytesExcluding` does the
 * same at the per-artifact level. Checks the artifact-level ceiling first — it's almost always the
 * tighter one and gives the caller a more specific error to act on.
 */
export async function assertWithinQuota(
  db: DbOrTx,
  opts: {
    orgId: string;
    artifactId?: string;
    quota: EffectiveQuota;
    additionalBytes: number;
    orgUsedBytesExcluding?: number;
    artifactUsedBytesExcluding?: number;
  },
): Promise<void> {
  if (opts.quota.artifactLimitBytes !== null) {
    let currentArtifactBytes = opts.artifactUsedBytesExcluding;
    if (currentArtifactBytes === undefined) {
      currentArtifactBytes = 0;
      if (opts.artifactId) {
        const usage = await getArtifactUsageBytes(db, opts.artifactId);
        currentArtifactBytes = usage.sourceBytes + usage.fileBytes;
      }
    }
    const projected = currentArtifactBytes + opts.additionalBytes;
    if (projected > opts.quota.artifactLimitBytes) {
      throw new QuotaExceededError("artifact", opts.quota.artifactLimitBytes, currentArtifactBytes);
    }
  }

  if (opts.quota.orgLimitBytes !== null) {
    const currentOrgBytes = opts.orgUsedBytesExcluding ?? (await getOrgUsageBytes(db, opts.orgId));
    const projected = currentOrgBytes + opts.additionalBytes;
    if (projected > opts.quota.orgLimitBytes) {
      throw new QuotaExceededError("org", opts.quota.orgLimitBytes, currentOrgBytes);
    }
  }
}

/**
 * Keeps stored team quota overrides truthful after the instance-wide quota is lowered — the same
 * job `clampOrgLifetimeOverrides` (services/lifetime.ts) does for artifact lifetimes. Only ever
 * tightens an override that's now looser than the new instance ceiling; a `NULL` override
 * ("inherit") is untouched because inheriting already reflects the new instance value.
 */
export async function clampOrgQuotaOverrides(db: Database, globalOrgLimitBytes: number, globalArtifactLimitBytes: number): Promise<void> {
  if (globalOrgLimitBytes > 0) {
    await db.execute(sql`UPDATE "orgs" SET "storage_quota_bytes" = ${globalOrgLimitBytes} WHERE "storage_quota_bytes" IS NOT NULL AND "storage_quota_bytes" > ${globalOrgLimitBytes}`);
  }
  if (globalArtifactLimitBytes > 0) {
    await db.execute(sql`UPDATE "orgs" SET "artifact_quota_bytes" = ${globalArtifactLimitBytes} WHERE "artifact_quota_bytes" IS NOT NULL AND "artifact_quota_bytes" > ${globalArtifactLimitBytes}`);
  }
}

export interface QuotaSnapshot {
  storageEnabled: boolean;
  maxFileBytes: number;
  /** Content types `GET /af/:token` serves as `Content-Disposition: inline` — everything else downloads instead of rendering in place. */
  inlineTypes: string[];
  org: { id: string; limitBytes: number | null; usedBytes: number; availableBytes: number | null };
  artifact?: { id: string; limitBytes: number | null; usedBytes: number; availableBytes: number | null };
}

/**
 * The one payload behind both `GET /api/v1/quota` and the `get_storage_quota` MCP tool — this is
 * what answers "can I upload this file, and how much room do I have?" for an agent deciding
 * whether to attach something to an artifact it's about to publish, per this feature's own ask.
 */
export async function buildQuotaSnapshot(
  db: Database,
  env: Env,
  orgId: string,
  storageEnabled: boolean,
  artifactId?: string,
): Promise<QuotaSnapshot> {
  const quota = await resolveQuotaForRequest(db, env, orgId);
  const orgUsedBytes = await getOrgUsageBytes(db, orgId);
  const snapshot: QuotaSnapshot = {
    storageEnabled,
    maxFileBytes: env.STORAGE_MAX_FILE_BYTES,
    inlineTypes: [...INLINE_CONTENT_TYPES],
    org: {
      id: orgId,
      limitBytes: quota.orgLimitBytes,
      usedBytes: orgUsedBytes,
      availableBytes: quotaRemaining(orgUsedBytes, quota.orgLimitBytes),
    },
  };
  if (artifactId) {
    const usage = await getArtifactUsageBytes(db, artifactId);
    const usedBytes = usage.sourceBytes + usage.fileBytes;
    snapshot.artifact = {
      id: artifactId,
      limitBytes: quota.artifactLimitBytes,
      usedBytes,
      availableBytes: quotaRemaining(usedBytes, quota.artifactLimitBytes),
    };
  }
  return snapshot;
}
