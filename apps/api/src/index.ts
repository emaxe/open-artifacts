import { serve } from "@hono/node-server";
import { eq } from "drizzle-orm";
import { loadEnv } from "./env.js";
import { createDb } from "./db/client.js";
import { createApp } from "./app.js";
import { users } from "./db/schema.js";
import { registerUser } from "./services/users.js";
import { purgeExpiredArtifacts, startRetentionSweeper } from "./services/retention.js";

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

  const app = createApp(db, env);
  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.log(`open-artifacts API listening on http://localhost:${info.port}`);
  });

  // The repo's only background loop, deliberately started here rather than in app.ts (which
  // stays side-effect-free so it can be constructed repeatedly in tests without spinning up
  // background work). 0 disables it; lazy expiry on read still applies either way.
  if (env.ARTIFACT_PURGE_INTERVAL_MINUTES > 0) {
    purgeExpiredArtifacts(db).catch((err) => console.error("[retention] initial purge failed:", err));
    startRetentionSweeper(db, env.ARTIFACT_PURGE_INTERVAL_MINUTES * 60_000);
  }
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
