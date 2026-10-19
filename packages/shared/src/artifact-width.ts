/**
 * Content width of a rendered artifact. Set per artifact only (no team/service level); `null`
 * means "the kind's own default" — markdown stays `narrow`, constructor pages keep whatever width
 * their spec asked for.
 *
 * `--oa-measure` caps the line length of running text so wide and full-width pages stay readable,
 * while tables, charts, grids and cards use the whole width.
 */
export const ARTIFACT_WIDTHS = ["narrow", "normal", "wide", "full"] as const;
export type ArtifactWidth = (typeof ARTIFACT_WIDTHS)[number];

export function isArtifactWidth(v: unknown): v is ArtifactWidth {
  return typeof v === "string" && (ARTIFACT_WIDTHS as readonly string[]).includes(v);
}

const WIDTH_VALUES: Record<ArtifactWidth, { main: string; measure: string }> = {
  narrow: { main: "720px", measure: "none" },
  normal: { main: "920px", measure: "none" },
  wide: { main: "1200px", measure: "80ch" },
  full: { main: "100%", measure: "80ch" },
};

/**
 * Overrides for `main` (constructor pages) and `body` (server-rendered kinds). `!important` is
 * deliberate: the constructor writes `--oa-main-w` inline on `<main>` and layout presets set a
 * fixed `max-width`; an explicit per-artifact choice has to beat both.
 */
export function buildWidthCss(width: ArtifactWidth): string {
  const w = WIDTH_VALUES[width];
  return (
    `main{--oa-main-w:${w.main} !important;max-width:${w.main} !important;--oa-measure:${w.measure}}` +
    `body{--oa-measure:${w.measure}}` +
    `body.oa-doc{max-width:${w.main} !important}`
  );
}
