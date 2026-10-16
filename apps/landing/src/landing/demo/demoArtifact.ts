/**
 * A hand-written demo document for the landing's "live preview" section — NOT a seeded database
 * artifact and NOT a real `/embed/:token` response. A seeded artifact would need a migration, a
 * demo org, and a live share row on every fresh install, would break the moment an admin deletes
 * it or turns off public links, and would pollute the exact view-count analytics the product
 * sells. This document is rendered via `srcDoc` in an iframe with `sandbox="allow-scripts"` and NO
 * `allow-same-origin` (see DemoPreview.tsx) — the same isolation model as production, with zero
 * backend dependency. It follows the sand/moss token palette from
 * packages/shared/src/design/tokens.css (mirrored by hand: the iframe is isolated, so it cannot import it) so it looks like a real artifact, not a
 * mockup, and carries its own CSP meta tag and its own `prefers-reduced-motion` handling, since
 * neither crosses the iframe boundary from the parent page.
 */
export const DEMO_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'">
<title>Weekly Active Users</title>
<style>
:root {
  color-scheme: light dark;
  --bg: #e6e0d2; --surface: #efeade; --surface-2: #d9d2c1;
  --fg: #2a2a26; --fg-muted: #59574e; --accent: #4f6238; --pos: #3f6b2a;
  --c1: #4f6238; --c2: #b0741a; --c3: #3d6a8a;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #171913; --surface: #20231b; --surface-2: #2a2e24;
    --fg: #ece7da; --fg-muted: #a9a590; --accent: #a9c47f; --pos: #8fc46a;
    --c1: #a9c47f; --c2: #e0a548; --c3: #7fb0d4;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100svh; background: var(--bg); color: var(--fg);
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  padding: 24px; display: flex; flex-direction: column; gap: 20px;
}
h1 { font-size: 22px; letter-spacing: -0.02em; margin: 0; }
.sub { color: var(--fg-muted); margin: 4px 0 0; font-size: 13px; }
.stat-row { display: flex; gap: 8px; flex-wrap: wrap; }
.stat { flex: 1; min-width: 110px; background: var(--surface); padding: 14px; border-radius: 2px; }
.stat b { display: block; font-size: 26px; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.stat span { color: var(--fg-muted); font-size: 13px; }
.pos { color: var(--pos); }
/* No flex:1 on .chart: it is a direct child of the column-flex body, and letting flex-grow drive
   its height makes the explicit 120px indefinite for the flexbox layout algorithm, which in turn
   makes every .bar percentage height resolve against nothing and collapse to 0 — a real
   flex/percentage-height gotcha, not a stylistic choice. */
.chart { display: flex; align-items: flex-end; gap: 6px; height: 120px; background: var(--surface-2); padding: 14px; border-radius: 2px; }
.bar { flex: 1; transform-origin: bottom; animation: grow 900ms cubic-bezier(.22,1,.36,1) both; }
@keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@media (prefers-reduced-motion: reduce) { .bar { animation: none; } }
</style>
</head>
<body>
  <header>
    <h1>Weekly Active Users</h1>
    <p class="sub">Demo artifact · sandboxed iframe, no allow-same-origin</p>
  </header>
  <div class="stat-row">
    <div class="stat"><b>128,4K</b><span>Users <span class="pos">+12%</span></span></div>
    <div class="stat"><b>4.8K</b><span>Artifacts published</span></div>
    <div class="stat"><b>99.98%</b><span>Uptime</span></div>
  </div>
  <div class="chart" role="img" aria-label="Weekly bar chart, values rising from 40 to 92">
    <div class="bar" style="height:40%;background:var(--c1);animation-delay:0ms"></div>
    <div class="bar" style="height:55%;background:var(--c1);animation-delay:40ms"></div>
    <div class="bar" style="height:48%;background:var(--c1);animation-delay:80ms"></div>
    <div class="bar" style="height:70%;background:var(--c2);animation-delay:120ms"></div>
    <div class="bar" style="height:65%;background:var(--c1);animation-delay:160ms"></div>
    <div class="bar" style="height:82%;background:var(--c1);animation-delay:200ms"></div>
    <div class="bar" style="height:92%;background:var(--c3);animation-delay:240ms"></div>
  </div>
</body>
</html>`;
