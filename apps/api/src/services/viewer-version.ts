import type { Database } from "../db/client.js";
import { getCurrentVersion, getVersionByNumber } from "./artifacts.js";
import type { artifacts, artifactVersions, shares } from "../db/schema.js";

/**
 * Parses the `?v=` query param on the public viewer routes into a strict positive integer, or
 * `null` for anything else. A plain `Number(raw)` would accept `"1e3"` (1000), `" 2 "` (2, via
 * implicit trim+coercion), `""` (0), and `"1.5"` (1.5) — all surprising version numbers to land on
 * from a query string nobody meant to type that way. Capped at 7 digits; no artifact will ever
 * have anywhere near that many versions, and it keeps the value comfortably inside `number`.
 */
export function parseVersionParam(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  if (!/^[1-9]\d{0,6}$/.test(raw)) return null;
  return Number(raw);
}

export interface ResolvedDisplayVersion {
  version: typeof artifactVersions.$inferSelect;
  /** The version this share falls back to when nobody asked for a specific one (pinned, or current). */
  defaultVersionNo: number;
  /** True only when `requested` was honored — i.e. the caller could manage the artifact AND the
   *  requested version actually exists. False for every anonymous/member request regardless of
   *  what `?v=` said: they always get the share's default, silently. */
  requestedApplied: boolean;
}

/**
 * Resolves which version a `/s/:token` or `/embed/:token` request should render. `canManage`
 * gates whether `requested` is honored at all — everyone else gets the share's own default
 * (its pinned version, or the artifact's current one) no matter what `?v=` says.
 *
 * Silent fallback rather than a 403 is deliberate: a manager who has been browsing old versions
 * ends up with `?v=3` sitting in their address bar, and people copy links from the address bar,
 * not from a dedicated "copy" affordance. Rejecting that link with an error would break sharing
 * for the one audience this feature exists to help. It costs nothing on the confidentiality side —
 * a 200-with-fallback and a 403 both tell an anonymous caller nothing beyond "you don't get to
 * pick", and the fallback tells them strictly less (no confirmation the requested version even
 * exists). The panel always shows the version actually rendered, so there's no risk of the UI
 * claiming one version while the iframe shows another.
 */
export async function resolveDisplayVersion(
  db: Database,
  artifact: typeof artifacts.$inferSelect,
  share: typeof shares.$inferSelect,
  requested: number | null,
  canManage: boolean,
): Promise<ResolvedDisplayVersion | null> {
  const defaultVersion = share.pinnedVersionId
    ? await db.query.artifactVersions.findFirst({ where: (v, { eq }) => eq(v.id, share.pinnedVersionId!) })
    : await getCurrentVersion(db, artifact);
  if (!defaultVersion) return null;

  if (!canManage || requested === null) {
    return { version: defaultVersion, defaultVersionNo: defaultVersion.versionNo, requestedApplied: false };
  }

  const requestedVersion = await getVersionByNumber(db, artifact.id, requested);
  if (!requestedVersion) {
    return { version: defaultVersion, defaultVersionNo: defaultVersion.versionNo, requestedApplied: false };
  }
  return { version: requestedVersion, defaultVersionNo: defaultVersion.versionNo, requestedApplied: requestedVersion.versionNo !== defaultVersion.versionNo };
}
