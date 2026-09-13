import { defineConfig } from "vitest/config";

// Requires a running Postgres — see docker-compose.dev.yml (`docker compose -f docker-compose.dev.yml up -d`)
// and push the schema once with `DATABASE_URL=... pnpm exec drizzle-kit push`.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/open_artifacts_dev";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/integration/**/*.test.ts"],
    testTimeout: 15000,
    // Integration tests share one Postgres instance; running them serially avoids cross-test
    // interference from truncation-based cleanup racing with parallel workers.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      APP_ORIGIN: "http://localhost:3999",
      SESSION_SECRET: "test-session-secret-please-ignore-0123456789",
      IP_HASH_SALT: "test-salt",
      DEFAULT_KEY_TTL_DAYS: "90",
      // Most integration tests exercise post-registration flows and don't care about gating;
      // registration-mode enforcement itself is covered by a dedicated test.
      DEFAULT_REGISTRATION_MODE: "open",
      // Points at docker-compose.dev.yml's `minio` service so artifact-files tests exercise a
      // real object store, not just the "disabled" (501) path. Override via TEST_S3_* env vars to
      // point elsewhere; storage.ts falls back to disabled if S3_BUCKET ends up unset regardless.
      S3_ENDPOINT: process.env.TEST_S3_ENDPOINT ?? "http://localhost:9000",
      S3_BUCKET: process.env.TEST_S3_BUCKET ?? "open-artifacts-test",
      S3_ACCESS_KEY_ID: process.env.TEST_S3_ACCESS_KEY_ID ?? "minioadmin",
      S3_SECRET_ACCESS_KEY: process.env.TEST_S3_SECRET_ACCESS_KEY ?? "minioadmin",
      S3_FORCE_PATH_STYLE: "true",
    },
  },
});
