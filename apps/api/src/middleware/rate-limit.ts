import { createMiddleware } from "hono/factory";
import type { AppBindings } from "../types.js";
import { keyIdOf } from "../services/identity.js";

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const buckets = new Map<string, Bucket>();

export function clearRateLimitBucketsForTests() {
  buckets.clear();
}

export interface RateLimitOptions {
  /** Max requests per window. */
  limit: number;
  windowMs: number;
}

/** In-memory token-bucket limiter keyed by API key id (falls back to IP for unauthenticated/session requests). */
export function rateLimit(opts: RateLimitOptions) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const identity = c.get("identity");
    const keyId = identity ? keyIdOf(identity) : null;
    const key = keyId ? `key:${keyId}` : `ip:${c.req.header("x-forwarded-for") ?? "unknown"}`;

    const now = Date.now();
    const bucket = buckets.get(key) ?? { tokens: opts.limit, lastRefillMs: now };
    const elapsed = now - bucket.lastRefillMs;
    const refill = (elapsed / opts.windowMs) * opts.limit;
    bucket.tokens = Math.min(opts.limit, bucket.tokens + refill);
    bucket.lastRefillMs = now;

    if (bucket.tokens < 1) {
      buckets.set(key, bucket);
      return c.json({ error: { code: "rate_limited", message: "Too many requests" } }, 429);
    }

    bucket.tokens -= 1;
    buckets.set(key, bucket);
    return next();
  });
}
