import { serve } from "@hono/node-server";
import { eq } from "drizzle-orm";
import { loadEnv } from "./env.js";
import { createDb } from "./db/client.js";
import { createApp } from "./app.js";
import { users } from "./db/schema.js";
import { registerUser } from "./services/users.js";

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
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
