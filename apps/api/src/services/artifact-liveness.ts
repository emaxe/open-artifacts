import { and, gt, isNull, or } from "drizzle-orm";
import { artifacts } from "../db/schema.js";

/**
 * The single predicate for "an artifact a normal read (or a quota scan) should see": not
 * soft-deleted and not past its lifetime. Used by every list/read/quota path (REST, MCP, the
 * authed preview, the public embed, and storage-quota accounting) so lazy expiry never needs to
 * be re-implemented per call site. Split into its own module (rather than living in
 * services/artifacts.ts, which used to be its only home) so services/quota.ts can depend on it
 * without a circular import between the two.
 */
export function liveArtifactWhere(now: Date = new Date()) {
  return and(isNull(artifacts.deletedAt), or(isNull(artifacts.expiresAt), gt(artifacts.expiresAt, now)));
}
