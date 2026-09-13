import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  APP_ORIGIN: z.string().url().default("http://localhost:3000"),
  ARTIFACT_ORIGIN: z.string().url().optional(),
  SESSION_SECRET: z.string().min(16),
  IP_HASH_SALT: z.string().min(8).default("dev-salt-change-me"),
  SUPERADMIN_EMAIL: z.string().email().optional(),
  SUPERADMIN_PASSWORD: z.string().min(8).optional(),
  DEFAULT_KEY_TTL_DAYS: z.coerce.number().int().nonnegative().default(90),
  DEFAULT_REGISTRATION_MODE: z.enum(["open", "invite_only", "closed"]).default("invite_only"),
  /** How often the retention sweeper checks for expired artifacts to hard-delete. 0 disables it — the instance still enforces lifetimes lazily on read, it just never reclaims storage on its own. */
  ARTIFACT_PURGE_INTERVAL_MINUTES: z.coerce.number().int().nonnegative().default(5),

  // S3-compatible object storage for artifact files (images/attachments). Infrastructure only —
  // per-team/per-artifact BYTE LIMITS are a runtime admin setting, not env, per this file's own
  // convention (see .env.example). Leaving S3_BUCKET unset disables the feature entirely: upload
  // routes answer 501 and existing instances keep working with zero configuration.
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // MinIO and most self-hosted S3-compatibles need path-style URLs (http://host/bucket/key);
  // real AWS S3 wants the default virtual-hosted style, so this defaults to off.
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  /** Hard per-file cap enforced before anything is written to S3, independent of any org/artifact quota. */
  STORAGE_MAX_FILE_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  /** How often the storage GC sweeper drains queued object deletions. 0 disables it — queued rows just pile up until it's turned back on. */
  STORAGE_GC_INTERVAL_MINUTES: z.coerce.number().int().nonnegative().default(5),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${parsed.error.toString()}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test-only: clears the cached env so a fresh loadEnv() call re-reads process.env. */
export function resetEnvCacheForTests(): void {
  cached = undefined;
}
