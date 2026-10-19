/**
 * Colour themes for rendered artifacts. A theme is a set of values for the CSS custom properties
 * every artifact stylesheet is already written against (`--bg`, `--fg`, `--accent`, `--c1`…), once
 * for light and once for dark. The server injects the resolved theme into the document at serve
 * time (`apps/api/src/services/render.ts`), so changing a service- or team-level theme re-colours
 * every artifact that inherits it, with no republish.
 *
 * Theme choice is hierarchical: artifact → team → service. `null`/unknown at a level means "ask
 * the next level up"; the service level always holds a valid theme. See `resolveArtifactTheme`.
 *
 * `sand` is the original palette and must stay byte-identical to the token block in
 * `skills/open-artifacts/constructor/themes/default.css`; `__tests__/artifact-themes.test.ts`
 * enforces that.
 */

export const ARTIFACT_THEME_IDS = ["sand", "graphite", "ocean", "editorial", "terminal"] as const;
export type ArtifactThemeId = (typeof ARTIFACT_THEME_IDS)[number];
export const DEFAULT_ARTIFACT_THEME: ArtifactThemeId = "sand";

/** Colour scheme a viewer may force; absent = follow the OS (`prefers-color-scheme`). */
export const ARTIFACT_SCHEMES = ["light", "dark"] as const;
export type ArtifactScheme = (typeof ARTIFACT_SCHEMES)[number];

export function isArtifactScheme(v: unknown): v is ArtifactScheme {
  return typeof v === "string" && (ARTIFACT_SCHEMES as readonly string[]).includes(v);
}

export function isArtifactThemeId(v: unknown): v is ArtifactThemeId {
  return typeof v === "string" && (ARTIFACT_THEME_IDS as readonly string[]).includes(v);
}

/** Colour tokens that differ between light and dark. Names are CSS custom properties minus `--`. */
export const THEME_COLOR_TOKENS = [
  "bg", "surface", "surface-2", "border", "fg", "fg-muted",
  "accent", "accent-fg", "accent-soft", "field", "field-fg", "ring", "scrim",
  "pos", "neg", "warn", "c1", "c2", "c3", "c4", "c5", "c6",
] as const;
export type ThemeColorToken = (typeof THEME_COLOR_TOKENS)[number];
export type ThemeColors = Record<ThemeColorToken, string>;

/** Tokens shared by both colour schemes: type and shape. */
export interface ThemeShape {
  "font-sans": string;
  "font-mono": string;
  radius: string;
  "radius-sm": string;
  shadow: string;
}

export interface ArtifactTheme {
  id: ArtifactThemeId;
  name: string;
  description: string;
  /** Google Fonts stylesheet; the embed CSP allows fonts.googleapis.com / fonts.gstatic.com. */
  fontsUrl?: string;
  shape: ThemeShape;
  light: ThemeColors;
  dark: ThemeColors;
}

const SYSTEM_SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SYSTEM_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export const ARTIFACT_THEMES: Record<ArtifactThemeId, ArtifactTheme> = {
  sand: {
    id: "sand",
    name: "Sand & Moss",
    description: "Тёплый песок и мох, плоские поверхности. Тема по умолчанию.",
    shape: {
      "font-sans": `"Onest Variable", "Onest", ${SYSTEM_SANS}`,
      "font-mono": SYSTEM_MONO,
      radius: "2px",
      "radius-sm": "2px",
      shadow: "none",
    },
    light: {
      bg: "#e6e0d2", surface: "#efeade", "surface-2": "#d9d2c1", border: "#c4bba6",
      fg: "#2a2a26", "fg-muted": "#59574e",
      accent: "#4f6238", "accent-fg": "#ffffff", "accent-soft": "#d3dbc0",
      field: "#3f5a2a", "field-fg": "#ffffff", ring: "#4f6238", scrim: "rgba(42, 42, 38, 0.72)",
      pos: "#3f6b2a", neg: "#a8321f", warn: "#8a5a00",
      c1: "#4f6238", c2: "#b0741a", c3: "#3d6a8a", c4: "#a24a4a", c5: "#2f7a76", c6: "#7a6a4f",
    },
    dark: {
      bg: "#171913", surface: "#20231b", "surface-2": "#2a2e24", border: "#3b4032",
      fg: "#e8e9e1", "fg-muted": "#a9ab9c",
      accent: "#a9c47f", "accent-fg": "#171913", "accent-soft": "#2f3a22",
      field: "#2c3d1c", "field-fg": "#e8e9e1", ring: "#a9c47f", scrim: "rgba(0, 0, 0, 0.8)",
      pos: "#8fc46a", neg: "#f0877f", warn: "#e0b04a",
      c1: "#a9c47f", c2: "#e0a548", c3: "#7fb0d4", c4: "#e08a8a", c5: "#6cc4bd", c6: "#b9a98a",
    },
  },

  graphite: {
    id: "graphite",
    name: "Graphite",
    description: "Нейтральная серая палитра со стальным синим акцентом, мягкие углы.",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
    shape: {
      "font-sans": `"Inter", ${SYSTEM_SANS}`,
      "font-mono": SYSTEM_MONO,
      radius: "6px",
      "radius-sm": "4px",
      shadow: "none",
    },
    light: {
      bg: "#e9ebee", surface: "#f4f5f7", "surface-2": "#dde0e5", border: "#c3c8d0",
      fg: "#1f2430", "fg-muted": "#505968",
      accent: "#3b5b8c", "accent-fg": "#ffffff", "accent-soft": "#d5e0f1",
      field: "#2f4a73", "field-fg": "#ffffff", ring: "#3b5b8c", scrim: "rgba(31, 36, 48, 0.72)",
      pos: "#2f6f3e", neg: "#b3261e", warn: "#8a5a00",
      c1: "#3b5b8c", c2: "#b5651a", c3: "#2f7a76", c4: "#a24a6a", c5: "#6a5aa8", c6: "#6b7280",
    },
    dark: {
      bg: "#14161a", surface: "#1c1f25", "surface-2": "#262a32", border: "#363b46",
      fg: "#e6e8ec", "fg-muted": "#a3a9b5",
      accent: "#8fb0e6", "accent-fg": "#14161a", "accent-soft": "#25344d",
      field: "#22314a", "field-fg": "#e6e8ec", ring: "#8fb0e6", scrim: "rgba(0, 0, 0, 0.8)",
      pos: "#7fcf8f", neg: "#f0877f", warn: "#e0b04a",
      c1: "#8fb0e6", c2: "#e0a548", c3: "#6cc4bd", c4: "#e08aa8", c5: "#b3a6ee", c6: "#9aa1ad",
    },
  },

  ocean: {
    id: "ocean",
    name: "Ocean",
    description: "Холодные сине-бирюзовые тона, крупные скругления.",
    fontsUrl: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
    shape: {
      "font-sans": `"IBM Plex Sans", ${SYSTEM_SANS}`,
      "font-mono": SYSTEM_MONO,
      radius: "10px",
      "radius-sm": "6px",
      shadow: "none",
    },
    light: {
      bg: "#dfeaee", surface: "#eaf2f5", "surface-2": "#cbdde4", border: "#a9c4cf",
      fg: "#12303b", "fg-muted": "#42606b",
      accent: "#0b6e8a", "accent-fg": "#ffffff", "accent-soft": "#c4e3ec",
      field: "#0b5a73", "field-fg": "#ffffff", ring: "#0b6e8a", scrim: "rgba(18, 48, 59, 0.72)",
      pos: "#1f7a4d", neg: "#b3321f", warn: "#8a5a00",
      c1: "#0b6e8a", c2: "#c4701a", c3: "#2f8f6b", c4: "#a24a6a", c5: "#5a63b0", c6: "#5f7580",
    },
    dark: {
      bg: "#0c1a21", surface: "#12252e", "surface-2": "#1a3440", border: "#2a4a58",
      fg: "#e1eef2", "fg-muted": "#9ab5bf",
      accent: "#5fc3e0", "accent-fg": "#0c1a21", "accent-soft": "#153a49",
      field: "#124a5e", "field-fg": "#e1eef2", ring: "#5fc3e0", scrim: "rgba(0, 0, 0, 0.8)",
      pos: "#6fd49f", neg: "#f0877f", warn: "#e0b04a",
      c1: "#5fc3e0", c2: "#e8a85a", c3: "#6fd49f", c4: "#e08aa8", c5: "#a0a8ee", c6: "#9ab5bf",
    },
  },

  editorial: {
    id: "editorial",
    name: "Editorial",
    description: "Тёплая бумага, терракотовый акцент и шрифт с засечками для текста.",
    fontsUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&display=swap",
    shape: {
      "font-sans": `"Source Serif 4", Georgia, "Times New Roman", serif`,
      "font-mono": SYSTEM_MONO,
      radius: "3px",
      "radius-sm": "2px",
      shadow: "none",
    },
    light: {
      bg: "#efe6d8", surface: "#f7f0e4", "surface-2": "#e3d7c3", border: "#cdbfa6",
      fg: "#2b2118", "fg-muted": "#65553f",
      accent: "#a9411f", "accent-fg": "#ffffff", "accent-soft": "#f0d5c8",
      field: "#8f3720", "field-fg": "#ffffff", ring: "#a9411f", scrim: "rgba(43, 33, 24, 0.72)",
      pos: "#3f6b2a", neg: "#a8321f", warn: "#8a5a00",
      c1: "#a9411f", c2: "#2f6f86", c3: "#5b7a2f", c4: "#8a5a9a", c5: "#a0700a", c6: "#65553f",
    },
    dark: {
      bg: "#1d1812", surface: "#27211a", "surface-2": "#332b22", border: "#4a4034",
      fg: "#f0e8da", "fg-muted": "#b5a892",
      accent: "#e8876a", "accent-fg": "#1d1812", "accent-soft": "#4a2a1e",
      field: "#5a2a1a", "field-fg": "#f0e8da", ring: "#e8876a", scrim: "rgba(0, 0, 0, 0.8)",
      pos: "#9ccf7a", neg: "#f0877f", warn: "#e0b04a",
      c1: "#e8876a", c2: "#6fb6d0", c3: "#9ccf7a", c4: "#c79ad8", c5: "#e0b04a", c6: "#b5a892",
    },
  },

  terminal: {
    id: "terminal",
    name: "Terminal",
    description: "Моноширинный шрифт, острые углы, зелёный и янтарный акценты.",
    fontsUrl: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap",
    shape: {
      "font-sans": `"JetBrains Mono", ${SYSTEM_MONO}`,
      "font-mono": `"JetBrains Mono", ${SYSTEM_MONO}`,
      radius: "0px",
      "radius-sm": "0px",
      shadow: "none",
    },
    light: {
      bg: "#e4e6e1", surface: "#eef0eb", "surface-2": "#d2d6cd", border: "#aeb5a6",
      fg: "#14201a", "fg-muted": "#425048",
      accent: "#087034", "accent-fg": "#ffffff", "accent-soft": "#c8e6d2",
      field: "#0a5a2c", "field-fg": "#ffffff", ring: "#087034", scrim: "rgba(20, 32, 26, 0.72)",
      pos: "#087034", neg: "#b3261e", warn: "#8a5000",
      c1: "#087034", c2: "#a86400", c3: "#1f6f9a", c4: "#a8325a", c5: "#6a3fa8", c6: "#425048",
    },
    dark: {
      bg: "#0a0e0b", surface: "#111712", "surface-2": "#1a221c", border: "#2a382d",
      fg: "#d6f5df", "fg-muted": "#8fb09a",
      accent: "#3ddc84", "accent-fg": "#0a0e0b", "accent-soft": "#123a22",
      field: "#0f3a20", "field-fg": "#d6f5df", ring: "#3ddc84", scrim: "rgba(0, 0, 0, 0.85)",
      pos: "#3ddc84", neg: "#ff7b72", warn: "#ffb454",
      c1: "#3ddc84", c2: "#ffb454", c3: "#5cc8ff", c4: "#ff7bb0", c5: "#c49bff", c6: "#8fb09a",
    },
  },
};

/** Public summary for pickers: name, description and the swatch colours for both schemes. */
export interface ArtifactThemeSummary {
  id: ArtifactThemeId;
  name: string;
  description: string;
  fontFamily: string;
  fontsUrl?: string;
  light: Pick<ThemeColors, "bg" | "surface" | "fg" | "accent" | "c1" | "c2" | "c3" | "c4">;
  dark: Pick<ThemeColors, "bg" | "surface" | "fg" | "accent" | "c1" | "c2" | "c3" | "c4">;
}

const SWATCH = ["bg", "surface", "fg", "accent", "c1", "c2", "c3", "c4"] as const;
function swatch(c: ThemeColors): ArtifactThemeSummary["light"] {
  return Object.fromEntries(SWATCH.map((k) => [k, c[k]])) as ArtifactThemeSummary["light"];
}

export function listArtifactThemes(): ArtifactThemeSummary[] {
  return ARTIFACT_THEME_IDS.map((id) => {
    const t = ARTIFACT_THEMES[id];
    return {
      id, name: t.name, description: t.description,
      fontFamily: t.shape["font-sans"], fontsUrl: t.fontsUrl,
      light: swatch(t.light), dark: swatch(t.dark),
    };
  });
}

/**
 * artifact → team → service. A level that is `null`, `undefined` or not a known id defers to the
 * next one, so an id retired in a later release degrades to the inherited theme instead of
 * breaking rendering. The service level is the floor: it falls back to `DEFAULT_ARTIFACT_THEME`
 * if even it is garbage, so this never fails.
 */
export function resolveArtifactTheme(
  artifact: string | null | undefined,
  team: string | null | undefined,
  service: string | null | undefined,
): ArtifactThemeId {
  for (const v of [artifact, team, service]) if (isArtifactThemeId(v)) return v;
  return DEFAULT_ARTIFACT_THEME;
}

function decls(obj: object): string {
  return Object.entries(obj as Record<string, string>).map(([k, v]) => `--${k}:${v};`).join("");
}

/**
 * Stylesheet that defines the theme's tokens for the current colour scheme. Meant to be injected
 * AFTER the artifact's own stylesheet so its `:root` wins at equal specificity. The scheme follows
 * `prefers-color-scheme`, the only signal the sandboxed iframe has.
 */
export function buildThemeCss(id: ArtifactThemeId, scheme?: ArtifactScheme | null): string {
  const t = ARTIFACT_THEMES[id];
  const imp = t.fontsUrl ? `@import url("${t.fontsUrl}");` : "";
  // A forced scheme writes that scheme's tokens straight into `:root` (after the page's own
  // `@media (prefers-color-scheme: dark)` block, so it wins whatever the OS says).
  if (scheme) return `${imp}:root{color-scheme:${scheme};${decls(t.shape)}${decls(t[scheme])}}`;
  return (
    `${imp}:root{color-scheme:light dark;${decls(t.shape)}${decls(t.light)}}` +
    `@media (prefers-color-scheme:dark){:root{${decls(t.dark)}}}`
  );
}
