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
  --bg: #fafafa;
  --surface: #ffffff;
  --surface-2: #f4f4f5;
  --border: #e4e4e7;
  --fg: #18181b;
  --fg-muted: #71717a;
  --accent: #2563eb;
  --ring: #2563eb;
  --pos: #16a34a;
  --neg: #dc2626;
  --warn: #b45309;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0a0a0b;
    --surface: #18181b;
    --surface-2: #232326;
    --border: #2c2c31;
    --fg: #f4f4f5;
    --fg-muted: #a1a1aa;
    --accent: #60a5fa;
    --ring: #60a5fa;
    --pos: #4ade80;
    --neg: #f87171;
    --warn: #fbbf24;
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
h1 { font-size: 1.9rem; margin: 0 0 .5rem; }
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
  padding: .2rem 1rem;
  border-left: 3px solid var(--border);
  color: var(--fg-muted);
}

hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }

img { max-width: 100%; height: auto; border-radius: 6px; border: 1px solid var(--border); }

code {
  font-family: var(--font-mono);
  font-size: .9em;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: .1em .35em;
}
pre {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
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
tbody tr:nth-child(even) { background: var(--surface-2); }
@media (max-width: 640px) {
  /* markdown-it emits a bare <table> with no scroll wrapper of its own; this is the only lever
     available to keep a wide table from forcing the whole page to scroll horizontally. */
  table { display: block; overflow-x: auto; white-space: nowrap; }
}

kbd {
  font-family: var(--font-mono);
  font-size: .85em;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 4px;
  padding: .05em .4em;
  background: var(--surface-2);
}
mark { background: var(--warn); color: #1a1200; padding: 0 .15em; border-radius: 2px; }
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
  background: #fafafa;
}
@media (prefers-color-scheme: dark) {
  body { background: #0a0a0b; }
}
.oa-svg-card {
  background: #ffffff;
  border: 1px solid #e4e4e7;
  border-radius: 10px;
  padding: 24px;
  max-width: 100%;
  box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06);
}
.oa-svg-card svg { max-width: 100%; height: auto; display: block; }
@media print {
  body { background: #fff; }
  .oa-svg-card { box-shadow: none; border: none; padding: 0; }
}
`;
