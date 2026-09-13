import { serve } from "@hono/node-server";
import { eq } from "drizzle-orm";
import { loadEnv } from "./env.js";
import { createDb } from "./db/client.js";
import { createApp } from "./app.js";
import { users } from "./db/schema.js";
import { registerUser } from "./services/users.js";
import { purgeExpiredArtifacts, startRetentionSweeper } from "./services/retention.js";
import { createStorage } from "./services/storage.js";
import { drainStorageGcQueue, startStorageGcSweeper } from "./services/storage-gc.js";

async function seedSuperadmin(db: ReturnType<typeof createDb>, env: ReturnType<typeof loadEnv>) {
  if (!env.SUPERADMIN_EMAIL || !env.SUPERADMIN_PASSWORD) return;
  const existing = await db.query.users.findFirst({ where: eq(users.email, env.SUPERADMIN_EMAIL.toLowerCase()) });
  if (existing) return;

  await registerUser(db, {
    email: env.SUPERADMIN_EMAIL,
    password: env.SUPERADMIN_PASSWORD,
    name: "Superadmin",
    isSuperadmin: true,
  });
  console.log(`Seeded superadmin account: ${env.SUPERADMIN_EMAIL}`);
}

async function main() {
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  await seedSuperadmin(db, env);

  const storage = createStorage(env);
  if (storage.enabled) await storage.ensureBucket();

  const app = createApp(db, env, storage);
  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.log(`open-artifacts API listening on http://localhost:${info.port}`);
  });

  // The repo's only background loops, deliberately started here rather than in app.ts (which
  // stays side-effect-free so it can be constructed repeatedly in tests without spinning up
  // background work). 0 disables either; lazy expiry/serving still applies either way.
  if (env.ARTIFACT_PURGE_INTERVAL_MINUTES > 0) {
    purgeExpiredArtifacts(db).catch((err) => console.error("[retention] initial purge failed:", err));
    startRetentionSweeper(db, env.ARTIFACT_PURGE_INTERVAL_MINUTES * 60_000);
  }
  if (storage.enabled && env.STORAGE_GC_INTERVAL_MINUTES > 0) {
    drainStorageGcQueue(db, storage).catch((err) => console.error("[storage-gc] initial drain failed:", err));
    startStorageGcSweeper(db, storage, env.STORAGE_GC_INTERVAL_MINUTES * 60_000);
  }
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
