# Data & analytics

Read `DESIGN-core.md` first — this file only adds what's specific to dashboards, KPIs, and charts.

## Use this when

- A metrics summary, dashboard, or scorecard — KPI tiles, one or more charts, or both.
- A dense table of numbers meant to be scanned, sorted mentally, or compared row to row.
- Anything whose main point is "here's how the numbers look," even a single chart with commentary.

## Don't use this when

- The numbers are incidental to a longer written argument — that's `DESIGN-document.md` with one
  chart component borrowed from here.
- There's no data, only a relationship or structure to show — that's `DESIGN-diagram.md`.

## Page structure

```html
<body>
  <header class="dash-head">
    <div>
      <h1>Q3 Revenue Review</h1>
      <p class="dash-asof">As of 2026-09-30 · North America · figures frozen at publish time</p>
    </div>
  </header>

  <section class="kpi-row">
    <div class="kpi-tile">…</div>
    <div class="kpi-tile">…</div>
  </section>

  <section class="chart-grid">
    <div class="chart-card">…</div>
    <div class="chart-card">…</div>
  </section>

  <section class="detail-table">
    <table>…</table>
  </section>

  <footer class="dash-foot">Source: internal billing export, 2026-09-30.</footer>
</body>
```

## Delta tokens

Nothing renamed — the categorical series `--c1`…`--c6` and semantic `--pos`/`--neg`/`--warn` from
the core block are this theme's whole palette. Reuse `--c1`…`--c6` in the exact order across every
chart on the page so "series 2" means the same color everywhere the viewer looks.

## Layout

- KPI row: `display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--sp-4);`
- Chart grid: `repeat(auto-fit, minmax(320px, 1fr))` — narrower than that and a legend has nowhere
  to go.
- **Every grid item holding a `<canvas>` needs `min-width: 0`.** A canvas has no natural size of its
  own once you set `maintainAspectRatio: false`, but the grid item's default `min-width: auto`
  still refuses to shrink below its rendered content — this is the #1 cause of dashboards that
  overflow at exactly the width someone actually views them at.
- Dense tables scroll inside their own wrapper (`overflow-x: auto` on a `<div>` around the
  `<table>`, not on the table itself) so the KPI row above it never moves.

## Component recipes

**KPI tile with a directional delta (never color alone):**

```html
<div class="kpi-tile">
  <p class="kpi-label">Net revenue</p>
  <p class="kpi-value">$4.82M</p>
  <p class="kpi-delta kpi-delta-pos">▲ 12.4% vs. Q2</p>
</div>
```
```css
.kpi-tile {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: var(--sp-4); box-shadow: var(--shadow);
}
.kpi-label { font-size: var(--t-sm); color: var(--fg-muted); margin: 0 0 var(--sp-1); }
.kpi-value {
  font-size: var(--t-2xl); font-weight: 600; font-variant-numeric: tabular-nums;
  margin: 0 0 var(--sp-1);
}
.kpi-delta { font-size: var(--t-sm); margin: 0; font-weight: 500; }
.kpi-delta-pos { color: var(--pos); }
.kpi-delta-neg { color: var(--neg); }
```

**Chart card — fixed-aspect wrapper so Chart.js/ECharts don't grow unbounded:**

```html
<div class="chart-card">
  <p class="chart-title">Revenue by region</p>
  <p class="chart-takeaway">EMEA overtook APAC for the first time this quarter.</p>
  <div class="chart-frame"><canvas id="revenue-chart" role="img"
    aria-label="Bar chart of revenue by region, Q1 through Q3 2026"></canvas></div>
  <table class="sr-only">
    <caption>Revenue by region, underlying data for the chart above</caption>
    <thead><tr><th>Region</th><th>Q1</th><th>Q2</th><th>Q3</th></tr></thead>
    <tbody><tr><td>EMEA</td><td>1.1M</td><td>1.4M</td><td>1.9M</td></tr></tbody>
  </table>
</div>
```
```css
.chart-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: var(--sp-4); box-shadow: var(--shadow);
}
.chart-title { font-weight: 600; margin: 0 0 var(--sp-1); }
.chart-takeaway { font-size: var(--t-sm); color: var(--fg-muted); margin: 0 0 var(--sp-3); }
.chart-frame { position: relative; height: 280px; min-width: 0; }
.chart-frame canvas { position: absolute; inset: 0; }
```

**Dense, sortable-looking table:**

```css
.detail-table { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); }
.detail-table table { width: 100%; border-collapse: collapse; font-size: var(--t-sm); }
.detail-table thead th {
  position: sticky; top: 0; background: var(--surface-2); text-align: left;
  padding: var(--sp-2) var(--sp-3); border-bottom: 1px solid var(--border);
}
.detail-table td { padding: var(--sp-2) var(--sp-3); border-bottom: 1px solid var(--border);
  font-variant-numeric: tabular-nums; }
.detail-table td.num, .detail-table th.num { text-align: right; }
.detail-table tbody tr:nth-child(even) { background: var(--surface-2); }
```

**Empty state:**

```css
.empty-state { text-align: center; color: var(--fg-muted); padding: var(--sp-7) var(--sp-4); }
```

## The hard part: charts that respect the tokens and the theme

The page can never fetch data at runtime (see `SKILL.md`'s CSP section), so every number in the
chart must already be embedded in the page at publish time — there is no "refresh" for a dashboard
artifact, so an as-of line (as in the page
structure above) is not optional, it's the only honest way to label a frozen snapshot.

Wire Chart.js (or ECharts/D3) to the token values instead of its own default palette, and make it
re-read them when the OS theme flips:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js"></script>
<script>
  function seriesColors() {
    var s = getComputedStyle(document.documentElement);
    return ["--c1","--c2","--c3","--c4","--c5","--c6"].map(function (v) { return s.getPropertyValue(v).trim(); });
  }
  function applyChartTheme() {
    var s = getComputedStyle(document.documentElement);
    Chart.defaults.color = s.getPropertyValue("--fg-muted").trim();
    Chart.defaults.borderColor = s.getPropertyValue("--border").trim();
  }
  applyChartTheme();
  var chart = new Chart(document.getElementById("revenue-chart"), {
    type: "bar",
    data: { labels: ["Q1","Q2","Q3"], datasets: [{ label: "EMEA", data: [1.1,1.4,1.9], backgroundColor: seriesColors()[0] }] },
    options: { maintainAspectRatio: false, responsive: true }
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    applyChartTheme();
    chart.data.datasets.forEach(function (d, i) { d.backgroundColor = seriesColors()[i]; });
    chart.update();
  });
</script>
```

`options.maintainAspectRatio: false` plus the `.chart-frame { position: relative; height: … }`
wrapper from the recipe above is what keeps a canvas from growing every time it's re-measured — the
two have to be used together, neither one alone is enough.

## Anti-patterns

- Gradient-filled KPI tiles or chart bars — a flat fill on a bordered card reads as data; a
  gradient reads as decoration and fights every other tile on the page for attention.
- 3D bars, donut charts for anything with more than 2-3 categories, or any chart type chosen for
  novelty over legibility.
- More than 6 series on one chart — split into small multiples instead of adding a 7th color.
- A truncated y-axis with no visible note — it's the single most common way a chart misleads.
- Reusing the default Chart.js/D3 palette — it isn't tuned for this token system or for dark mode.
- A `<canvas>` chart with no text fallback — a screen reader and a text extractor both see nothing.
- Percentages with no visible base ("+40%" of what?).
- Implying the dashboard is live when it can't be — no loading spinners, no "last updated: just
  now," no auto-refreshing anything; state the freeze time instead.

## Before you publish

- [ ] Every chart's series colors come from `--c1`…`--c6` (or `getComputedStyle`, per the recipe
      above), in the same order across every chart on the page.
- [ ] Toggling the OS theme re-colors every chart, not just the surrounding page.
- [ ] Every `<canvas>` has an `aria-label` and a paired `.sr-only` data table.
- [ ] The as-of / snapshot-time line is visible near the top, not buried in a footer.
