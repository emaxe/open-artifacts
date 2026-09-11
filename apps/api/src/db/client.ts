import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDb>;

/** The type of the `tx` callback parameter inside `db.transaction(async (tx) => ...)`. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Accepts either a top-level `Database` or a `tx` from inside `db.transaction(...)` — for helpers
 *  (like `recordAudit`) that need to run either standalone or as part of a larger transaction. */
export type DbOrTx = Database | Transaction;

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  return drizzle(pool, { schema });
}
