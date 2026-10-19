// Kept in sync by hand with packages/shared/src/scopes.ts. Duplicated (rather than depended on
// via a workspace package) so this CLI can be published to npm as a fully standalone package —
// npm has no notion of pnpm's `workspace:*` protocol.

export const API_KEY_SCOPES = [
  "artifacts:read",
  "artifacts:write",
  "artifacts:delete",
  "shares:write",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export function isValidScope(value: string): value is ApiKeyScope {
  return (API_KEY_SCOPES as readonly string[]).includes(value);
}

export type ArtifactKind = "html" | "markdown" | "mermaid" | "svg";

// Kept in sync by hand with packages/shared/src/artifact-themes.ts and artifact-width.ts (a parity
// test in packages/shared guards it). Only used to fail fast on a typo; the server validates too.
export const ARTIFACT_THEME_IDS = ["sand", "graphite", "ocean", "editorial", "terminal"] as const;
export const ARTIFACT_FONT_IDS = ["system", "inter", "onest", "plex-sans", "source-serif", "jetbrains-mono"] as const;
export const ARTIFACT_WIDTHS = ["narrow", "normal", "wide", "full"] as const;
