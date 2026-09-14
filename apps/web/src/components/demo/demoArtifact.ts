/**
 * A hand-written demo document for the sign-in screen's brand panel — moved from the former
 * landing (pages/landing/demo/demoArtifact.ts) verbatim. NOT a seeded database artifact and NOT a
 * real `/embed/:token` response — see that file's original comment for why. Rendered via `srcDoc`
 * in an iframe with `sandbox="allow-scripts"` and NO `allow-same-origin` (see DemoPreview.tsx) —
 * the same isolation model as production, with zero backend dependency.
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
  --bg: #fafafa; --surface: #ffffff; --surface-2: #f4f4f5; --border: #e4e4e7;
  --fg: #18181b; --fg-muted: #71717a; --accent: #2563eb; --pos: #16a34a;
  --c1: #2563eb; --c2: #d97706; --c3: #16a34a;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0a0a0b; --surface: #18181b; --surface-2: #232326; --border: #2c2c31;
    --fg: #f4f4f5; --fg-muted: #a1a1aa; --accent: #60a5fa; --pos: #4ade80;
    --c1: #60a5fa; --c2: #fbbf24; --c3: #4ade80;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100vh; background: var(--bg); color: var(--fg);
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 20px; display: flex; flex-direction: column; gap: 16px;
}
h1 { font-size: 15px; margin: 0; }
.sub { color: var(--fg-muted); margin: 0; font-size: 12px; }
.stat-row { display: flex; gap: 12px; flex-wrap: wrap; }
.stat { flex: 1; min-width: 100px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 12px; }
.stat b { display: block; font-size: 20px; font-variant-numeric: tabular-nums; }
.stat span { color: var(--fg-muted); font-size: 11px; }
.pos { color: var(--pos); }
/* No flex:1 on .chart: it is a direct child of the column-flex body, and letting flex-grow drive
   its height makes the explicit 110px indefinite for the flexbox layout algorithm, which in turn
   makes every .bar percentage height resolve against nothing and collapse to 0 — a real
   flex/percentage-height gotcha, not a stylistic choice. */
.chart { display: flex; align-items: flex-end; gap: 6px; height: 110px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 12px; }
.bar { flex: 1; border-radius: 4px 4px 0 0; transform-origin: bottom; animation: grow 900ms ease-out both; }
@keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@media (prefers-reduced-motion: reduce) { .bar { animation: none; } }
</style>
</head>
<body>
  <header>
    <h1>Weekly Active Users</h1>
    <p class="sub">Demo artifact · rendered inside a sandboxed iframe, no allow-same-origin</p>
  </header>
  <div class="stat-row">
    <div class="stat"><b>128,4K</b><span>Users <span class="pos">▲ 12%</span></span></div>
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
