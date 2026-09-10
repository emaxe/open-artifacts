import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { AppBindings } from "../types.js";

export const healthRoutes = new Hono<AppBindings>();

healthRoutes.get("/health", async (c) => {
  try {
    await c.get("db").execute(sql`select 1`);
    return c.json({ status: "ok" });
  } catch {
    return c.json({ status: "degraded", error: "database unreachable" }, 503);
  }
});
