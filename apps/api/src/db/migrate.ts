import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "./client.js";
import { loadEnv } from "../env.js";

async function main() {
  const env = loadEnv();
  const db = createDb(env.DATABASE_URL);
  await migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
