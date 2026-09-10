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
