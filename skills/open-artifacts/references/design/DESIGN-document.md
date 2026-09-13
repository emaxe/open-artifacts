# Document & report

Read `DESIGN-core.md` first — this file only adds what's specific to long-form writing.

## Use this when

- A research note, analysis, or write-up meant to be read start to finish.
- A post-mortem, RFC, design spec, or runbook.
- Technical documentation or an API reference with a mix of prose, code, and tables.

## Don't use this when

- The content is mostly numbers and charts at a glance — that's `DESIGN-data.md`, even if it has
  a paragraph of commentary attached.
- The content is a single diagram — that's `DESIGN-diagram.md`.
- It's meant to persuade or announce rather than inform — that's `DESIGN-promo.md`.

## Page structure

```html
<body>
  <header class="doc-head">
    <p class="doc-eyebrow">Post-mortem</p>
    <h1>Checkout latency regression, March 2026</h1>
    <p class="doc-sub">What happened, why, and what changes as a result.</p>
    <ul class="doc-meta">
      <li>Author: Jordan Alvarez</li>
      <li>2026-03-14</li>
      <li>v1.2</li>
    </ul>
  </header>

  <nav class="doc-toc" aria-label="Table of contents">
    <p>Contents</p>
    <ol>
      <li><a href="#summary">Summary</a></li>
      <li><a href="#timeline">Timeline</a></li>
      <li><a href="#root-cause">Root cause</a></li>
    </ol>
  </nav>

  <main class="doc-body">
    <h2 id="summary">Summary</h2>
    <p>…</p>
    <!-- sections -->
  </main>

  <footer class="doc-foot">
    <h2>References</h2>
    <ol class="doc-footnotes"><li id="fn1">…</li></ol>
  </footer>
</body>
```

The TOC is optional — include it only past roughly 4 sections; below that it's overhead, not
navigation.

## Delta tokens

Nothing new — this theme reads straight off the core palette. It leans on `--fg-muted` (metadata,
captions, footnotes) and `--border` (rules, callout edges, code block frames) more than any other
theme, because a document's hierarchy comes from typography and whitespace, not color.

## Layout

- Prose lives in a single column, `max-width: 72ch` — the width the core token block already
  assumes for `body`, so most documents need no extra width rule at all.
- Wide elements (a data table, a full-width figure) get a full-bleed escape hatch: give the
  document body `display: grid; grid-template-columns: 1fr min(72ch, 100%) 1fr` and place normal
  content in the middle column (`grid-column: 2`); a wide child sets `grid-column: 1 / -1` and gets
  its own `overflow-x: auto` if it's still wider than the viewport.
- A sticky TOC (`position: sticky; top: 24px`) belongs in a side rail that only exists above
  `1024px` — below that width, either drop it to a static block above `<main>` or leave it out
  entirely; a sticky element sharing a 400px-wide viewport with prose is guaranteed to overlap.
- Heading rhythm carries the outline: more space above a heading than below it, so a heading binds
  visually to the text that follows rather than floating between two sections.

## Component recipes

**Header + metadata:**

```css
.doc-head { margin-bottom: var(--sp-6); }
.doc-eyebrow {
  font-size: var(--t-xs); text-transform: uppercase; letter-spacing: .06em;
  color: var(--fg-muted); margin: 0 0 var(--sp-1);
}
.doc-head h1 { font-size: var(--t-3xl); margin: 0 0 var(--sp-2); }
.doc-sub { font-size: var(--t-lg); color: var(--fg-muted); margin: 0 0 var(--sp-4); }
.doc-meta { display: flex; gap: var(--sp-4); flex-wrap: wrap; list-style: none; margin: 0; padding: 0;
  font-size: var(--t-sm); color: var(--fg-muted); border-top: 1px solid var(--border); padding-top: var(--sp-3); }
```

**Callout / admonition** — three variants sharing one base:

```html
<aside class="callout callout-warn">
  <strong>Watch out.</strong> Rolling this back also reverts the rate-limit fix from v1.1.
</aside>
```
```css
.callout {
  margin: var(--sp-4) 0; padding: var(--sp-3) var(--sp-4);
  border-left: 3px solid var(--accent); background: var(--surface-2); border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.callout-warn { border-left-color: var(--warn); }
.callout-danger { border-left-color: var(--neg); }
```

**Fenced code with a language label:**

```html
<figure class="code-block">
  <figcaption>server/render.ts</figcaption>
  <pre><code>export function renderArtifactHtml(kind, content) { … }</code></pre>
</figure>
```
```css
.code-block { margin: var(--sp-4) 0; }
.code-block figcaption {
  font-size: var(--t-xs); font-family: var(--font-mono); color: var(--fg-muted);
  padding: var(--sp-1) var(--sp-3); background: var(--surface-2); border: 1px solid var(--border);
  border-bottom: none; border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}
.code-block pre { margin: 0; border-radius: 0 0 var(--radius-sm) var(--radius-sm); }
```

**Definition list for parameters/fields:**

```html
<dl class="param-list">
  <div><dt><code>lifetime</code> <span class="param-type">string, optional</span></dt>
       <dd>Duration like <code>12h</code> or <code>7d</code>. Omit for the team default.</dd></div>
</dl>
```
```css
.param-list > div { display: grid; grid-template-columns: minmax(160px, 240px) 1fr; gap: var(--sp-3);
  padding: var(--sp-3) 0; border-top: 1px solid var(--border); }
.param-list > div:first-child { border-top: none; }
.param-type { font-size: var(--t-xs); color: var(--fg-muted); font-weight: 400; }
```

**Figure with caption:**

```css
figure { margin: var(--sp-5) 0; }
figure img, figure svg { display: block; margin: 0 auto; }
figcaption { text-align: center; font-size: var(--t-sm); color: var(--fg-muted); margin-top: var(--sp-2); }
```

**Footnotes:**

```html
<p>The regression started at deploy time<sup><a href="#fn1">1</a></sup>.</p>
…
<ol class="doc-footnotes">
  <li id="fn1">Confirmed via the deploy log, not user reports. <a href="#fnref1">↩</a></li>
</ol>
```
```css
.doc-footnotes { font-size: var(--t-sm); color: var(--fg-muted); border-top: 1px solid var(--border); padding-top: var(--sp-3); }
```

## The hard part: keeping a long document scannable

A wall of `<h2>`s with identical weight is not an outline. Give the reader a way to skim: a
one-sentence summary under the title, a short "what changed" or "TL;DR" callout near the top for
anything past ~800 words, and headings that are genuinely informative on their own ("Root cause:
a stale connection-pool config" beats "Root cause"). If the document has more than two heading
levels, make the difference between them obvious in the type scale (`--t-xl` → `--t-lg` → `--t-base`
with bold) — two headings that look almost the same size read as one level, no matter what the
markup says.

## Anti-patterns

- Full-width prose with no measure — anything past ~75 characters per line is measurably harder to
  read; use the 72ch column even for a report nobody asked to be "designed."
- Centered or justified body text. Left-align; justification without hyphenation creates ugly gaps.
- A fresh `<h1>` per section — one `<h1>` per document (the title), `<h2>` for sections below it.
- Emoji as bullet markers or section markers in place of real hierarchy.
- Bolding entire paragraphs for emphasis — it removes the ability to emphasize anything within them.
- Skipping heading levels to get a smaller font size — change the type scale value instead.
- A code block with no scroll container — a single long line will blow out the page width.
- A sticky TOC that overlaps body text below 1024px (see Layout above).

## Before you publish

- [ ] Every heading level is visually distinct from its neighbors, not just semantically.
- [ ] Any table or figure wider than 72ch uses the full-bleed column and/or scrolls in its own
      wrapper — the page itself never scrolls horizontally.
- [ ] A reader who only reads the title, subtitle, and any TL;DR callout still gets the point.
- [ ] Printed/exported to PDF, the TOC and any sticky elements don't appear mid-page or overlap text.
