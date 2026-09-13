import { eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { orgs, type artifacts, type shares } from "../db/schema.js";
import { listVersionSummaries } from "./artifacts.js";
import { getActorDisplayName } from "./identity.js";
import type { ResolvedDisplayVersion } from "./viewer-version.js";
import type { ViewerContext } from "./viewer-context.js";
import type { ViewerShellModel, ViewerVersionEntry } from "../views/viewer-shell.js";

const VERSION_LIST_LIMIT = 50;

export interface BuildViewerModelInput {
  token: string;
  share: typeof shares.$inferSelect;
  artifact: typeof artifacts.$inferSelect;
  resolved: ResolvedDisplayVersion;
  ctx: ViewerContext;
}

function urls(token: string, versionNo: number) {
  const t = encodeURIComponent(token);
  return {
    canonicalHref: `/s/${t}`,
    embedSrc: `/embed/${t}?v=${versionNo}`,
    downloadHref: `/s/${t}/download?v=${versionNo}`,
  };
}

/**
 * Assembles the `ViewerShellModel` the panel is rendered from. Which fields get populated is
 * gated purely by `ctx.audience`: an `anon` viewer's branch never even queries the author/team/
 * version-list data, both as an efficiency measure and as a second guarantee (on top of the
 * `ViewerShellModel` union's typing) that nothing extra ends up in memory to leak by mistake.
 */
export async function buildViewerModel(db: Database, input: BuildViewerModelInput): Promise<ViewerShellModel> {
  const { token, share, artifact, resolved, ctx } = input;
  const version = resolved.version;
  const { canonicalHref, embedSrc, downloadHref } = urls(token, version.versionNo);

  const base = {
    title: artifact.title,
    kind: artifact.kind,
    versionNo: version.versionNo,
    versionDate: version.createdAt,
    embedSrc,
    downloadHref,
    canonicalHref,
  };

  if (ctx.audience === "anon") {
    return { audience: "anon", ...base };
  }

  const [authorName, org] = await Promise.all([
    getActorDisplayName(db, artifact.ownerType, artifact.ownerId),
    db.query.orgs.findFirst({ where: eq(orgs.id, artifact.orgId), columns: { name: true } }),
  ]);
  const memberFields = {
    authorName: authorName ?? "Deleted user",
    orgName: org?.name ?? "Unknown team",
    // Possible on a `team` share: membership grants access independent of the visibility matrix,
    // so a non-owner member can land here with `access.read === false` on a `private` artifact —
    // a cabinet link would just 403 for them. Omit it rather than ship a dead link.
    cabinetHref: ctx.access.read ? `/t/${artifact.orgId}/artifacts/${artifact.id}` : null,
  };

  if (ctx.audience === "member") {
    return { audience: "member", ...base, ...memberFields };
  }

  // audience === "manager": write access always implies read access (resolveOrgArtifactAccess
  // never grants write without read), so cabinetHref is never null here.
  const summaries = await listVersionSummaries(db, artifact.id, VERSION_LIST_LIMIT + 1);
  const versionsTruncated = summaries.length > VERSION_LIST_LIMIT;
  const versions: ViewerVersionEntry[] = summaries.slice(0, VERSION_LIST_LIMIT).map((v) => ({
    versionNo: v.versionNo,
    createdAt: v.createdAt,
    message: v.message,
    isCurrent: v.id === artifact.currentVersionId,
    isPinned: v.id === share.pinnedVersionId,
    isActive: v.versionNo === version.versionNo,
    href: `/s/${encodeURIComponent(token)}?v=${v.versionNo}`,
  }));

  return {
    audience: "manager",
    ...base,
    ...memberFields,
    cabinetHref: memberFields.cabinetHref ?? `/t/${artifact.orgId}/artifacts/${artifact.id}`,
    description: artifact.description ?? null,
    versionMessage: version.message,
    sizeBytes: version.sizeBytes,
    expiresAt: artifact.expiresAt,
    viewCount: share.viewCount,
    versions,
    versionsTruncated,
    nonDefaultNotice: resolved.requestedApplied ? { canonicalHref } : null,
  };
}
