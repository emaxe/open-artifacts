import { eq } from "drizzle-orm";
import { isArtifactFontId, isArtifactWidth, resolveArtifactTheme, type ArtifactFontId, type ArtifactThemeId, type ArtifactWidth } from "@open-artifacts/shared";
import type { Database } from "../db/client.js";
import { orgs } from "../db/schema.js";
import type { InstanceSettings } from "./settings.js";

export interface ArtifactAppearance {
  theme: ArtifactThemeId;
  width: ArtifactWidth | null;
  /** `null` = the theme's own font. */
  font: ArtifactFontId | null;
}

/**
 * Resolves how an artifact is drawn: theme from artifact → team → instance, width from the
 * artifact alone (`null` = the kind's own default). One cheap lookup of the team's theme.
 */
export async function resolveArtifactAppearance(
  db: Database,
  artifact: { orgId: string; theme: string | null; width: string | null; font: string | null },
  instance: Pick<InstanceSettings, "artifactTheme">,
): Promise<ArtifactAppearance> {
  const org = await db.query.orgs.findFirst({ where: eq(orgs.id, artifact.orgId), columns: { theme: true } });
  return {
    theme: resolveArtifactTheme(artifact.theme, org?.theme, instance.artifactTheme),
    width: isArtifactWidth(artifact.width) ? artifact.width : null,
    font: isArtifactFontId(artifact.font) ? artifact.font : null,
  };
}
