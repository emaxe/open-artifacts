/**
 * Server-side stylesheets for artifact kinds the API renders itself: `markdown`, `mermaid`
 * (both via `ARTIFACT_BASE_CSS`), and `svg` (via `ARTIFACT_SVG_CSS`). Used by
 * `services/render.ts`'s `wrapDocument()`.
 *
 * The token block at the top of `ARTIFACT_BASE_CSS` is the server-side twin of the core token
 * block in `skills/open-artifacts/references/design/DESIGN-core.md` — the same names, the same
 * hex values, in both places on purpose, so a hand-written `html` artifact and a server-rendered
 * `markdown` artifact look like they came from the same product. Change one, change the other;
 * `packages/shared/src/__tests__/skill-docs.test.ts` fails the build if the canonical hex values
 * ever drift apart.
 */

export const ARTIFACT_BASE_CSS = /* css */ `
:root {
  color-scheme: light dark;
  --bg: #e6e0d2;
  --surface: #efeade;
  --surface-2: #d9d2c1;
  --border: #c4bba6;
  --fg: #2a2a26;
  --fg-muted: #59574e;
  --accent: #4f6238;
  --accent-soft: #d3dbc0;
  --ring: #4f6238;
  --pos: #3f6b2a;
  --neg: #a8321f;
  --warn: #8a5a00;
  --font-sans: "Onest Variable", "Onest", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #171913;
    --surface: #20231b;
    --surface-2: #2a2e24;
    --border: #3b4032;
    --fg: #e8e9e1;
    --fg-muted: #a9ab9c;
    --accent: #a9c47f;
    --accent-soft: #2f3a22;
    --ring: #a9c47f;
    --pos: #8fc46a;
    --neg: #f0877f;
    --warn: #e0b04a;
  }
}

*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 1rem/1.65 var(--font-sans);
  padding: clamp(20px, 4vw, 40px);
  max-width: 72ch;
  margin-inline: auto;
}
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: .001ms !important; transition-duration: .001ms !important; }
}

h1, h2, h3, h4, h5, h6 { line-height: 1.25; text-wrap: pretty; }
h1 { font-size: 2.2rem; letter-spacing: -0.03em; margin: 0 0 .5rem; }
h2 { font-size: 1.5rem; margin: 2rem 0 .6rem; }
h3 { font-size: 1.2rem; margin: 1.6rem 0 .5rem; }
h4, h5, h6 { font-size: 1rem; margin: 1.3rem 0 .4rem; }
h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }

p, ul, ol, dl { margin: 0 0 1rem; }
ul, ol { padding-left: 1.4rem; }
li + li { margin-top: .25rem; }
li > ul, li > ol { margin-top: .25rem; margin-bottom: 0; }

a { color: var(--accent); text-underline-offset: 2px; }

blockquote {
  margin: 1rem 0;
  padding: .6rem 1rem;
  background: var(--accent-soft);
  border-radius: 2px;
}
blockquote > :last-child { margin-bottom: 0; }

hr { border: none; height: 6px; background: var(--surface-2); margin: 2rem 0; }

img { max-width: 100%; height: auto; border-radius: 2px; }

code {
  font-family: var(--font-mono);
  font-size: .9em;
  background: var(--surface-2);
  border-radius: 2px;
  padding: .1em .35em;
}
pre {
  background: var(--surface-2);
  border-radius: 2px;
  padding: 14px 16px;
  overflow-x: auto;
}
pre code { background: none; border: 0; padding: 0; font-size: .875em; }

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: .95em;
}
th, td { padding: .5rem .7rem; border-bottom: 1px solid var(--border); text-align: left; }
th { background: var(--surface-2); font-weight: 600; }
td { font-variant-numeric: tabular-nums; }
tbody tr:nth-child(even) { background: var(--surface); }
@media (max-width: 640px) {
  /* markdown-it emits a bare <table> with no scroll wrapper of its own; this is the only lever
     available to keep a wide table from forcing the whole page to scroll horizontally. */
  table { display: block; overflow-x: auto; white-space: nowrap; }
}

kbd {
  font-family: var(--font-mono);
  font-size: .85em;
  border-radius: 2px;
  padding: .05em .4em;
  background: var(--surface-2);
}
mark { background: var(--warn); color: var(--bg); padding: 0 .15em; border-radius: 2px; }
del, s { color: var(--fg-muted); }
sup, sub { font-size: .75em; }
dt { font-weight: 600; }
dd { margin: 0 0 .6rem; color: var(--fg-muted); }

/* mermaid's <pre class="mermaid"> ends up holding a rendered SVG, not code — undo the code-block
   chrome above and center it instead. */
pre.mermaid {
  background: none;
  border: none;
  padding: 0;
  display: flex;
  justify-content: center;
}
pre.mermaid svg { max-width: 100%; height: auto; }

@media print {
  body { background: #fff; color: #000; max-width: none; padding: 0; }
  a { color: #000; text-decoration: underline; }
  pre, table, blockquote, figure { break-inside: avoid; }
  h1, h2, h3 { break-after: avoid; }
}
`;

/**
 * Wrapper for `kind: "svg"`. Deliberately keeps the SVG itself on a fixed light "paper" card
 * rather than letting it inherit the page's dark-mode background: most hand-authored SVGs stroke
 * in hardcoded black with no fill, and would simply disappear against a dark page. The page
 * background around the card still follows the viewer's theme.
 */
export const ARTIFACT_SVG_CSS = /* css */ `
:root { color-scheme: light dark; }
body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(20px, 4vw, 40px);
  background: #e6e0d2;
}
@media (prefers-color-scheme: dark) {
  body { background: #171913; }
}
.oa-svg-card {
  background: #ffffff;
  border-radius: 2px;
  padding: 24px;
  max-width: 100%;
}
.oa-svg-card svg { max-width: 100%; height: auto; display: block; }
@media print {
  body { background: #fff; }
  .oa-svg-card { box-shadow: none; border: none; padding: 0; }
}
`;
