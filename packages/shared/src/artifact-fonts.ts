/**
 * Body typeface of a rendered artifact, chosen per artifact. `null` means "the theme's own font".
 * A font only replaces `--font-sans` (running text and headings); code keeps `--font-mono`.
 *
 * Web fonts come from Google Fonts, which the embed CSP already allows for styles and font files
 * (see `csp.ts`). Every entry carries a system fallback stack so the page is readable before the
 * font arrives or when it is blocked.
 */
export const ARTIFACT_FONT_IDS = ["system", "inter", "onest", "plex-sans", "source-serif", "jetbrains-mono"] as const;
export type ArtifactFontId = (typeof ARTIFACT_FONT_IDS)[number];

export interface ArtifactFont {
  id: ArtifactFontId;
  name: string;
  /** For the picker preview: which family of faces this is. */
  style: "sans" | "serif" | "mono";
  stack: string;
  fontsUrl?: string;
}

const SANS_FALLBACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const ARTIFACT_FONTS: Record<ArtifactFontId, ArtifactFont> = {
  system: { id: "system", name: "Системный", style: "sans", stack: SANS_FALLBACK },
  inter: {
    id: "inter", name: "Inter", style: "sans", stack: `"Inter", ${SANS_FALLBACK}`,
    fontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  },
  onest: {
    id: "onest", name: "Onest", style: "sans", stack: `"Onest", ${SANS_FALLBACK}`,
    fontsUrl: "https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&display=swap",
  },
  "plex-sans": {
    id: "plex-sans", name: "IBM Plex Sans", style: "sans", stack: `"IBM Plex Sans", ${SANS_FALLBACK}`,
    fontsUrl: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
  },
  "source-serif": {
    id: "source-serif", name: "Source Serif 4", style: "serif", stack: `"Source Serif 4", Georgia, "Times New Roman", serif`,
    fontsUrl:
      "https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&display=swap",
  },
  "jetbrains-mono": {
    id: "jetbrains-mono", name: "JetBrains Mono", style: "mono",
    stack: `"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace`,
    fontsUrl: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap",
  },
};

export function isArtifactFontId(v: unknown): v is ArtifactFontId {
  return typeof v === "string" && (ARTIFACT_FONT_IDS as readonly string[]).includes(v);
}

export function listArtifactFonts(): ArtifactFont[] {
  return ARTIFACT_FONT_IDS.map((id) => ARTIFACT_FONTS[id]);
}

/**
 * The `@import` (must precede every rule in its stylesheet, so callers place it first) and the rule
 * that applies the font. Split because the theme's own `@import` has to sit next to it.
 */
export function buildFontCss(id: ArtifactFontId): { imports: string; rules: string } {
  const f = ARTIFACT_FONTS[id];
  return {
    imports: f.fontsUrl ? `@import url("${f.fontsUrl}");` : "",
    rules: `:root{--font-sans:${f.stack};}`,
  };
}
