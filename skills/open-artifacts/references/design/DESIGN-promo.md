# Promo & presentation

Read `DESIGN-core.md` first — this file only adds what's specific to persuading or presenting.

## Use this when

- A landing page, feature announcement, or product one-pager.
- A pitch — investor, internal, or sales.
- A slide deck meant to be stepped through, one idea per screen.

## Don't use this when

- The goal is to inform rather than persuade — that's `DESIGN-document.md`.
- It's mostly a data readout — lead with `DESIGN-data.md` and keep the persuasive framing to a
  one-line takeaway per chart.

## Two modes, one token set

This file covers **landing** (a single scrolling page) and **deck** (discrete full-screen slides).
Both use the same tokens and the same component vocabulary — a deck is really a landing page cut
into `100svh` sections.

## Page structure — landing

```html
<body>
  <section class="hero">
    <p class="hero-eyebrow">Now in beta</p>
    <h1>Ship artifacts your team actually wants to open.</h1>
    <p class="hero-sub">One link, rendered safely, styled consistently — every time.</p>
    <div class="hero-cta">
      <a class="btn btn-primary" href="#get-started">Get started</a>
      <a class="btn btn-ghost" href="#learn-more">See how it works</a>
    </div>
  </section>

  <section class="feature-grid">
    <article class="feature-card">…</article>
    <article class="feature-card">…</article>
  </section>

  <section class="proof-strip">
    <div class="stat"><p class="stat-value">40M+</p><p class="stat-label">artifacts rendered</p></div>
  </section>

  <section class="closing-cta">
    <h2>Ready to try it?</h2>
    <a class="btn btn-primary" href="#get-started">Get started</a>
  </section>
</body>
```

## Page structure — deck

```html
<body>
  <div class="deck" id="deck">
    <section class="slide"><h1>Q3 Strategy</h1><p>A three-part plan for next quarter.</p></section>
    <section class="slide"><h2>The problem</h2><p>…</p></section>
    <section class="slide"><h2>The plan</h2><p>…</p></section>
  </div>
  <div class="slide-counter" aria-live="polite">1 / 3</div>
</body>
```

## Delta tokens

Promo work is the one place it's acceptable to lean harder on `--accent` — bigger fills, a subtle
gradient — because the goal is a single strong impression, not sustained reading comfort. Keep it
to **one** accent hue and vary weight/size instead of introducing a second color for emphasis.

## Layout — landing

```css
.hero {
  min-height: 70svh; display: flex; flex-direction: column; justify-content: center;
  padding: var(--sp-8) var(--sp-4); text-align: center; gap: var(--sp-3);
}
.hero-eyebrow { font-size: var(--t-sm); color: var(--accent); font-weight: 600;
  text-transform: uppercase; letter-spacing: .06em; margin: 0; }
.hero h1 { font-size: var(--t-3xl); line-height: 1.1; margin: 0; max-width: 20ch; margin-inline: auto; }
.hero-sub { font-size: var(--t-lg); color: var(--fg-muted); max-width: 46ch; margin: 0 auto; }
.hero-cta { display: flex; gap: var(--sp-3); justify-content: center; flex-wrap: wrap; margin-top: var(--sp-3); }

.feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--sp-4); padding: var(--sp-7) var(--sp-4); max-width: 1080px; margin-inline: auto; }

.proof-strip { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--sp-7);
  padding: var(--sp-6) var(--sp-4); background: var(--surface-2); }
.stat { text-align: center; }
.stat-value { font-size: var(--t-2xl); font-weight: 700; margin: 0; font-variant-numeric: tabular-nums; }
.stat-label { font-size: var(--t-sm); color: var(--fg-muted); margin: var(--sp-1) 0 0; }

.closing-cta { text-align: center; padding: var(--sp-8) var(--sp-4); }
```

## Layout — deck

```css
.deck { scroll-snap-type: y mandatory; overflow-y: auto; height: 100svh; }
.slide {
  scroll-snap-align: start; min-height: 100svh; display: flex; flex-direction: column;
  justify-content: center; padding: var(--sp-8) var(--sp-6); max-width: 900px; margin-inline: auto;
}
.slide-counter {
  position: fixed; bottom: var(--sp-4); right: var(--sp-4); font-size: var(--t-sm);
  color: var(--fg-muted); background: var(--surface); border: 1px solid var(--border);
  border-radius: 999px; padding: var(--sp-1) var(--sp-3);
}
@media print {
  .deck { height: auto; overflow: visible; }
  .slide { break-after: page; min-height: auto; padding: var(--sp-6); }
  .slide-counter { display: none; }
}
```

```js
// Keyboard navigation — no library, no external dependency.
var slides = document.querySelectorAll(".slide");
var counter = document.querySelector(".slide-counter");
var current = 0;
function goTo(i) {
  current = Math.max(0, Math.min(slides.length - 1, i));
  slides[current].scrollIntoView({ behavior: "smooth" });
  if (counter) counter.textContent = (current + 1) + " / " + slides.length;
}
document.addEventListener("keydown", function (e) {
  if (e.key === "ArrowRight" || e.key === " ") goTo(current + 1);
  if (e.key === "ArrowLeft") goTo(current - 1);
});
```

## Component recipes

**Buttons:**

```css
.btn {
  display: inline-flex; align-items: center; gap: var(--sp-2); padding: var(--sp-3) var(--sp-5);
  border-radius: var(--radius-sm); font-weight: 600; text-decoration: none; font-size: var(--t-base);
  border: 1px solid transparent;
}
.btn-primary { background: var(--accent); color: var(--accent-fg); }
.btn-ghost { border-color: var(--border); color: var(--fg); }
```

**Feature card:**

```css
.feature-card { padding: var(--sp-4); border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--surface); }
.feature-card h3 { font-size: var(--t-lg); margin: var(--sp-2) 0 var(--sp-1); }
.feature-card p { color: var(--fg-muted); margin: 0; }
```

## The hard part: hero contrast

A headline over an image, gradient, or colored panel must still clear 4.5:1 against whatever sits
behind the specific pixels the text occupies — checking contrast against the *average* background
color is not enough if the image varies. A reliable recipe: put a scrim between the image and the
text —

```css
.hero-media { position: relative; }
.hero-media::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(10,10,11,0) 0%, rgba(10,10,11,.65) 100%);
}
.hero-media .hero-text { position: relative; color: #fff; }
```

and check the result with the OS in both themes — a scrim tuned for light mode over a light image
can still fail once the surrounding page (and the image, if it has transparency) goes dark.

## Anti-patterns

- Animating on load with no regard for `prefers-reduced-motion` — the core block's media query
  handles it only if you don't override `animation-duration` yourself afterward.
- More than one accent hue, or more than two font families, on one page.
- Placeholder copy (`Lorem ipsum`), invented logos, or invented metrics presented as if real —
  if the human hasn't given you real numbers or names, say `[metric]`/`[logo]` visibly rather than
  fabricate something a viewer might repeat as fact.
- A deck navigable only by mouse scroll, with no keyboard path.
- `height: 100vh` for a hero on mobile — use `100svh`, which accounts for a mobile browser's
  collapsing address bar; `100vh` causes visible cropping and a scroll-jump on load.
- Text laid directly over a busy photo with no scrim, "hoping" it stays readable.

## Before you publish

- [ ] Hero headline contrast checked against the actual rendered background, both themes.
- [ ] Reduced-motion respected — verify by enabling it in OS accessibility settings, not by reading
      the CSS.
- [ ] A deck (if this is one) is navigable by keyboard and exports one slide per printed page.
- [ ] No fabricated logos, quotes, or metrics presented as real.
