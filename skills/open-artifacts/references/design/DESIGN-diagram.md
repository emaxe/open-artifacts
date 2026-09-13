# Diagrams & schematics

Read `DESIGN-core.md` first — this file only adds what's specific to showing structure and flow.

## Use this when

- Architecture, a system's components and how they connect.
- A process flow, decision tree, sequence, or state machine.
- An entity-relationship or dependency diagram.
- Any `mermaid` or `svg` artifact, even a simple one.

## Don't use this when

- The diagram is one supporting element inside a longer document — build it with these rules, but
  publish the whole thing as `DESIGN-document.md`.
- There's no structure to show, only numbers — that's `DESIGN-data.md`.

## Three ways to publish a diagram — pick one

| Situation | Publish as |
|---|---|
| The whole artifact *is* the diagram | `kind: "mermaid"` — the server renders and styles it, zero CSP concerns, least work |
| A diagram needs exact manual control over shapes/paths mermaid can't produce | `kind: "svg"` — hand-authored vector |
| A diagram plus surrounding explanation, legend, or interactive controls | `kind: "html"`, with the diagram as one `mermaid.js` or inline-SVG element on the page |

Default to `mermaid` unless you have a concrete reason to hand-author SVG or wrap it in `html` —
it's rendered server-side, so it already gets dark mode and print handling for free (see
`apps/api/src/services/render.ts`'s mermaid branch); you don't have to replicate any of this
file's CSS/token wiring for a pure-diagram artifact.

## Page structure (`html`, diagram + explanation)

```html
<body>
  <header><h1>Request lifecycle</h1></header>
  <figure class="diagram-frame">
    <pre class="mermaid">graph LR; A[Client] --> B[API]; B --> C[(DB)];</pre>
    <figcaption>Simplified — retries and caching omitted.</figcaption>
  </figure>
  <ul class="diagram-legend">
    <li><span class="legend-swatch" style="background:var(--c1)"></span> Synchronous call</li>
    <li><span class="legend-swatch legend-dashed"></span> Async / eventual</li>
  </ul>
</body>
```

## Delta tokens

None beyond the core categorical series `--c1`…`--c6`, which this theme and `DESIGN-data.md` share
on purpose — if a report links a chart to an architecture diagram, "series 2 blue" should mean the
same subsystem in both.

## Mermaid inside an `html` page

Load and initialize it the same theme-aware way the server does internally:

```html
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>
  var dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  mermaid.initialize({
    startOnLoad: true,
    theme: dark ? "dark" : "default",
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
    themeVariables: {
      primaryColor: dark ? "#232326" : "#f4f4f5",
      primaryTextColor: dark ? "#f4f4f5" : "#18181b",
      primaryBorderColor: dark ? "#2c2c31" : "#e4e4e7",
      lineColor: dark ? "#a1a1aa" : "#71717a"
    }
  });
</script>
```

Layout hygiene that matters more than any color choice:

- Cap a single view at roughly 12 nodes. Past that, split into two linked diagrams rather than
  shrinking text to fit — a diagram nobody can read at 100% zoom has failed regardless of styling.
- Prefer left-to-right (`graph LR`) for pipelines and request flows; top-to-bottom for hierarchies
  and org structures.
- Route around crossing edges with swimlanes/subgraphs instead of letting lines overlap — a crossing
  edge is almost always a sign the layout, not the styling, needs work.
- Label thickness/style meaningfully (a dashed edge for async, a bold edge for the critical path) —
  never purely decorative.
- Keep every label at 12px-equivalent or larger; mermaid will happily render smaller text that's
  unreadable once the SVG scales down on a phone-width viewport.

## Hand-authored SVG

```svg
<svg viewBox="0 0 480 240" role="img" aria-labelledby="t d">
  <title id="t">Request lifecycle</title>
  <desc id="d">Client calls the API, which reads from and writes to the database.</desc>
  <rect x="20" y="90" width="120" height="60" rx="8" fill="none" stroke="currentColor"/>
  <text x="80" y="125" text-anchor="middle" fill="currentColor">Client</text>
  <!-- … -->
</svg>
```

Rules, in order of how often they're missed:

1. **Always a `viewBox`, never a fixed `width`/`height` attribute on the root `<svg>`** — a fixed
   size can't shrink on a 400px viewport and can't grow to fill a wider one. Let CSS
   (`max-width: 100%; height: auto`) control the rendered size.
2. **`<title>` + `<desc>`, referenced via `aria-labelledby`**, is the diagram's accessible name —
   without it, a screen reader announces nothing more than "image."
3. **Use `currentColor` for strokes and text fill**, then set `color` on a wrapping element per
   theme — that's what lets a diagram track the page's light/dark state instead of being frozen at
   whatever color it was authored in.
4. **Never hardcode `#000` or `#fff`.** This is also why the *server-rendered* `svg` artifact kind
   deliberately places arbitrary SVGs on a fixed light card rather than a theme-following
   background (see `apps/api/src/views/artifact-styles.ts`) — most hand-drawn SVGs out in the wild
   don't follow rule 3, and a dark page would make a black-stroke diagram vanish. Follow rule 3 in
   anything you author yourself so it doesn't need that fallback.
5. **Pair every color-coded element with a label, shape, or line style** — the same rule as charts,
   for the same reason (color blindness, print in grayscale, a low-quality screenshot).
6. **Include a legend whenever there's more than one edge or node type** — a reader shouldn't have
   to infer what a dashed line means from context.

## Legend component

```css
.diagram-legend { list-style: none; display: flex; gap: var(--sp-4); flex-wrap: wrap;
  margin: var(--sp-3) 0 0; padding: 0; font-size: var(--t-sm); color: var(--fg-muted); }
.legend-swatch { display: inline-block; width: 14px; height: 14px; border-radius: 3px;
  margin-right: var(--sp-1); vertical-align: -2px; }
.legend-dashed { border: 2px dashed var(--fg-muted); background: none; }
```

## Anti-patterns

- Cramming 30 nodes into one view instead of splitting the diagram.
- Crossing edges left unresolved because swimlanes felt like extra work.
- Color as the only signal for edge/node type, with no legend.
- Fixed pixel `width`/`height` on an `<svg>` root instead of `viewBox`.
- Text baked into a raster image instead of a real `<text>` element — it can't be searched, resized,
  or read by a screen reader, and it blurs on zoom.
- A mermaid diagram with `theme` hardcoded to `"default"`, breaking in half the cases (dark OS).

## Before you publish

- [ ] The diagram is legible at both 400px width and printed on paper.
- [ ] Every `<svg>` root has a `viewBox` and no fixed `width`/`height`.
- [ ] Colors track the page theme (`currentColor` + `themeVariables`, or the categorical tokens) —
      check by toggling the OS theme, not just by reading the CSS.
- [ ] A legend exists if more than one line style or color carries meaning.
