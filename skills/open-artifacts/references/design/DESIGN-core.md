# Design foundation for `html` artifacts

Read this file before writing any `html` artifact. Read exactly one of `DESIGN-data.md`,
`DESIGN-document.md`, `DESIGN-promo.md`, `DESIGN-diagram.md` after it — see the table in
`SKILL.md`. This file covers what every artifact shares: tokens, theming, type, layout, print,
accessibility, and a pre-publish checklist. It does not repeat what may load from a CDN or reach
the network — that's `SKILL.md § What can run inside an html artifact (CSP)`, the only place those
rules live.

## How to use this

1. Copy the CSS block below into a single `<style>` tag in `<head>`, verbatim.
2. Append the "delta tokens" block from your chosen theme file after it — it only *adds to or
   overrides* these variables, never renames them.
3. Never rename a token (`--accent`, `--c1`, …). Other authors and the server-rendered
   `markdown`/`mermaid`/`svg` artifacts use the same names; renaming breaks nothing today but
   throws away the one reason all of this looks like one product.
4. Change a value only for a real reason (a brand color the human gave you), and re-check contrast
   if you touch `--fg-muted`, `--accent`, or anything paired with `--bg`/`--surface` (see
   Accessibility below — these are pre-checked at the values shipped here).

## The page skeleton

An `html` artifact is **one self-contained file** — there will never be a sibling CSS, JS, image,
or font file. Inline everything (fonts as system stacks or a `fonts.googleapis.com` `@import`/
`<link>`, scripts as pinned CDN `<script>` tags or inline blocks, data as literal JSON in the page).
Start every artifact from this shell:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Q3 Revenue Review</title>
<style>
/* core block (below) + your theme file's delta block, in that order */
</style>
</head>
<body>
  <!-- content -->
</body>
</html>
```

`<title>` is not decoration — it is what the browser tab and a printed page's header show. Always
set a real one. `<meta name="color-scheme">` is what tells the browser to paint its own UI
(scrollbars, form controls, the page's initial background before your CSS loads) in the right
theme; omit it and you get a white flash in a dark shell.

## The core token block

```css
:root {
  color-scheme: light dark;

  /* surfaces */
  --bg: #fafafa;
  --surface: #ffffff;
  --surface-2: #f4f4f5;
  --border: #e4e4e7;

  /* text */
  --fg: #18181b;
  --fg-muted: #71717a;

  /* interactive accent — deliberately not the near-black used for host chrome elsewhere in
     Open Artifacts; content needs a real hue for links, focus rings, and series 1 */
  --accent: #2563eb;
  --accent-fg: #ffffff;
  --ring: #2563eb;

  /* semantic */
  --pos: #16a34a;
  --neg: #dc2626;
  --warn: #b45309;

  /* categorical data series — shared by charts (DESIGN-data.md) and diagrams
     (DESIGN-diagram.md) so the two never clash inside one artifact */
  --c1: #2563eb;
  --c2: #d97706;
  --c3: #16a34a;
  --c4: #db2777;
  --c5: #7c3aed;
  --c6: #0891b2;

  /* type */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --t-xs: clamp(0.72rem, 0.70rem + 0.10vw, 0.78rem);
  --t-sm: clamp(0.82rem, 0.79rem + 0.12vw, 0.88rem);
  --t-base: clamp(0.95rem, 0.92rem + 0.15vw, 1rem);
  --t-lg: clamp(1.1rem, 1.03rem + 0.30vw, 1.25rem);
  --t-xl: clamp(1.35rem, 1.20rem + 0.60vw, 1.7rem);
  --t-2xl: clamp(1.7rem, 1.35rem + 1.30vw, 2.4rem);
  --t-3xl: clamp(2.1rem, 1.50rem + 2.40vw, 3.2rem);

  /* spacing, 4/8 scale */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
  --sp-5: 24px; --sp-6: 32px; --sp-7: 48px; --sp-8: 64px;

  --radius: 10px;
  --radius-sm: 6px;
  --shadow: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06);
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
    --accent-fg: #0a0a0b;
    --ring: #60a5fa;
    --pos: #4ade80;
    --neg: #f87171;
    --warn: #fbbf24;
    --c1: #60a5fa; --c2: #fbbf24; --c3: #4ade80;
    --c4: #f472b6; --c5: #a78bfa; --c6: #22d3ee;
    /* a light shadow is invisible on a dark surface — a border carries the separation instead */
    --shadow: none;
  }
}

* , *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: var(--t-base)/1.6 var(--font-sans);
  text-rendering: optimizeLegibility;
}
a { color: var(--accent); }
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important; scroll-behavior: auto !important; }
}
@media print {
  body { background: #fff; color: #000; }
  .oa-shadow, [class*="card"] { box-shadow: none !important; }
  table, figure, blockquote, pre { break-inside: avoid; }
  h1, h2, h3 { break-after: avoid; }
}
```

Border, radius, spacing, and shadow tokens don't need dark-mode overrides (`--shadow` is the one
exception, set to `none`) — only color needs restating per theme.

## Theming inside the iframe

An artifact renders in a sandboxed, opaque-origin iframe (see `SKILL.md`'s intro). **There is no
`data-theme` attribute, no `postMessage`, and no other signal from the host page telling you which
theme is active** — `prefers-color-scheme` is the only input you get, which is why every color
above is set via `@media (prefers-color-scheme: dark)` rather than a class or attribute selector.

Two consequences:

- Never hardcode `#fff`, `#000`, or any raw color outside the token block — a hardcoded value is
  invisible to the dark-mode override and will look broken to roughly half of viewers.
- Don't build a theme toggle that "remembers" the choice. `localStorage`/cookies inside this iframe
  are scoped to a token-specific origin that a viewer may never return to, so a remembered
  preference just evaporates — it's not broken, it's working as designed for a page with this
  security model. If a toggle is genuinely useful for a specific artifact (e.g. a long report read
  in one sitting), drive it off a `[data-theme]` attribute on `<html>` that starts unset (following
  the media query) and only overrides for the current view.

Known, accepted mismatch: the Open Artifacts viewer shell around this iframe can be forced to a
theme a signed-in viewer picked explicitly, independent of their OS setting. When that happens the
shell and the artifact can disagree (light shell, dark artifact, or vice versa). That's a
platform-level tradeoff, not something an individual artifact can or should work around.

## Fonts

Default to the system stack in the core block — it's already loaded, matches the OS, and needs no
network round trip. Google Fonts is permitted by CSP (`fonts.googleapis.com` for the CSS,
`fonts.gstatic.com` for the actual font files) but is a render-blocking request on every view of a
link that may get opened for the first time weeks later. Reach for a custom font only for
`DESIGN-promo.md` work where typography carries brand identity, cap it at one family, and always
add `&display=swap` to the stylesheet URL so text isn't invisible while it loads.

## Responsive layout

Treat **400px** width as the floor, not a breakpoint you round up from — the Open Artifacts viewer
panel above the iframe already eats vertical space, and phones are a common share target.

- Fluid type via the `clamp()` scale above; avoid fixed-`px` headings that force horizontal scroll.
- One structural breakpoint, `640px`, is usually enough — prefer
  `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))` over stacking media queries for
  card/tile grids, so the layout adapts continuously instead of snapping at one width.
- **`min-width: 0` on every grid or flex child that holds a chart, table, or long unbroken string.**
  This is the single most common cause of "the layout looks fine until it doesn't" — a grid item's
  default `min-width: auto` refuses to shrink below its content's intrinsic width, and a canvas or
  a wide table then pushes the whole row wider than the viewport.
- Keep a side gutter of at least 16px at every width. Give it once, on `body` or one outer wrapper,
  with `padding-inline`; give vertical padding separately with `padding-block` — never a bare
  `padding` shorthand, which zeroes the sides the moment someone changes the vertical value.
- Only tables, code blocks, and diagrams may scroll horizontally, and each does it inside its own
  `overflow-x: auto` wrapper — the page itself must never gain a horizontal scrollbar.

## Print

The core block's `@media print` rule (white background, no shadows, no orphaned page breaks inside
tables/figures/quotes, headings that don't strand at a page bottom) covers every artifact
automatically. Themed files add page-specific print rules only where they need more (e.g. slide
decks in `DESIGN-promo.md` printing one slide per page).

## Accessibility

- **Contrast is pre-checked at the values above**: body text (`--fg` on `--bg`) exceeds 7:1 in both
  themes; `--fg-muted` on `--bg` is ~4.6:1 (light) / ~4.7:1 (dark), which clears the 4.5:1 floor for
  normal text — don't drop it further, and don't use it below 14px; `--accent` on `--bg`/`--surface`
  exceeds 4.5:1 in both themes. Changing any of these values means re-checking contrast yourself
  before publishing.
- Never encode meaning by color alone — pair a delta chip with an arrow glyph, a status with a
  label, a series with a legend entry, not just a hue.
- `:focus-visible` is defined in the core block; don't remove it or replace it with `outline: none`.
- Use real landmarks (`<header>`, `<main>`, `<nav>`, `<footer>`) instead of an unbroken stack of
  `<div>`s — screen-reader users navigate by them.
- Don't skip heading levels (an `<h2>` should not be followed directly by an `<h4>`).
- Keep body text at 14px/`--t-sm` or larger; nothing below 12px anywhere, including chart labels and
  captions.
- A `<canvas>`-based chart is invisible to assistive tech and to text extraction. Give it
  `role="img"` and a descriptive `aria-label`, **and** include the underlying data as a visually
  hidden `<table>` (`class="sr-only"`, defined above) right next to it.

## Self-review checklist before you publish

- [ ] No horizontal scroll on the page itself at 400px width (only tables/code/diagrams scroll,
      each in its own wrapper).
- [ ] Looks correct with the OS set to both light and dark.
- [ ] Every interactive element (link, button, tab) shows a visible focus ring on keyboard `Tab`.
- [ ] No text smaller than 12px anywhere.
- [ ] Printed/exported to PDF, nothing is clipped or split mid-row.
- [ ] Zero external stylesheets, zero `fetch`/`XHR`/`WebSocket` calls — everything the page needs
      is inlined at publish time.
- [ ] Every CDN `<script src>` names an exact version and is a UMD build (see `SKILL.md`'s CSP
      section — don't restate its rules here, just satisfy them).
- [ ] `<title>` and `<html lang>` are both set to something real.
- [ ] Opened the browser console — no errors.
- [ ] The four themed sections above (theme, print, layout, a11y) all still hold after your last
      edit, not just after your first draft.
