import { createHash } from "node:crypto";

/** Deterministic content hash used for `content_hash` columns and `If-Match` optimistic locking. */
export function computeContentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
