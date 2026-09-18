# Themes Specification

CSS-темы конструктора артефактов. Каждая тема — CSS-файл, который:
1. **Не зависит от контента** — только визуальное оформление
2. **Подключается как дополнение** к `default.css`
3. **Переопределяет только то, что нужно** — не дублирует базовые токены

---

## Файловая структура

```
constructor/themes/
├── default.css     ← Базовые токены (из DESIGN-core.md) + стили всех блоков
├── data.css        ← Delta для дашбордов и аналитики
├── document.css    ← Delta для длинных документов
├── promo.css       ← Delta для лендингов и анонсов
└── diagram.css     ← Delta для диаграмм и схем
```

---

## `default.css` — структура

Файл состоит из двух частей:

### Часть 1: Core tokens (из DESIGN-core.md, не изменяется)

```css
/* === CORE TOKENS (generated from DESIGN-core.md) === */
:root {
  color-scheme: light dark;
  --bg: #fafafa; --surface: #ffffff; --surface-2: #f4f4f5;
  --border: #e4e4e7;
  --fg: #18181b; --fg-muted: #71717a;
  --accent: #2563eb; --accent-fg: #ffffff; --ring: #2563eb;
  --pos: #16a34a; --neg: #dc2626; --warn: #b45309;
  --c1: #2563eb; --c2: #d97706; --c3: #16a34a;
  --c4: #db2777; --c5: #7c3aed; --c6: #0891b2;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --t-xs: clamp(0.72rem, 0.70rem + 0.10vw, 0.78rem);
  /* ... остальные токены из DESIGN-core.md ... */
}
@media (prefers-color-scheme: dark) { /* dark overrides */ }

/* reset + base */
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--fg);
       font: var(--t-base)/1.6 var(--font-sans); }
/* ... остальное из DESIGN-core.md ... */
```

### Часть 2: Block styles (классы для шаблонов блоков)

```css
/* === BLOCK STYLES === */

/* Layout wrapper */
main { max-width: 900px; margin: 0 auto; padding: var(--sp-5) var(--sp-4); }

/* hero block */
.hero { padding: var(--sp-7) 0 var(--sp-6); }
.hero__title { font-size: var(--t-2xl); font-weight: 700; margin: 0 0 var(--sp-2); }
.hero__subtitle { font-size: var(--t-lg); color: var(--fg-muted); margin: 0 0 var(--sp-3); }
.hero__badge { display: inline-block; padding: 2px 10px; border-radius: 99px;
               background: var(--accent); color: var(--accent-fg); font-size: var(--t-xs); }
.hero__meta { font-size: var(--t-sm); color: var(--fg-muted); margin-top: var(--sp-4); }
.hero--center { text-align: center; }

/* kpi-row block */
.kpi-row { display: grid;
           grid-template-columns: repeat(var(--cols, auto-fill), minmax(160px, 1fr));
           gap: var(--sp-4); margin: var(--sp-5) 0; }
.kpi-tile { background: var(--surface); border: 1px solid var(--border);
            border-radius: var(--radius); padding: var(--sp-4) var(--sp-5);
            box-shadow: var(--shadow); }
.kpi-icon { font-size: 1.5em; display: block; margin-bottom: var(--sp-2); }
.kpi-label { font-size: var(--t-sm); color: var(--fg-muted); margin-bottom: var(--sp-1); }
.kpi-value { font-size: var(--t-xl); font-weight: 700; }
.kpi-suffix { font-size: var(--t-sm); font-weight: 400; color: var(--fg-muted); margin-left: 4px; }
.kpi-delta { font-size: var(--t-sm); margin-top: var(--sp-1); }
.kpi-delta--up { color: var(--pos); }
.kpi-delta--down { color: var(--neg); }
.kpi-delta--neutral { color: var(--fg-muted); }

/* stats-grid block */
.stats-grid { display: grid; gap: var(--sp-4); margin: var(--sp-5) 0; }
.stats-card { background: var(--surface); border: 1px solid var(--border);
              border-radius: var(--radius); padding: var(--sp-5);
              display: flex; flex-direction: column; align-items: flex-start; }
.stats-icon { font-size: 2em; margin-bottom: var(--sp-3); }
.stats-value { font-size: var(--t-2xl); font-weight: 800; }
.stats-label { font-size: var(--t-sm); color: var(--fg-muted); margin-top: var(--sp-1); }

/* table block */
.table-wrapper { overflow-x: auto; margin: var(--sp-5) 0; }
.table-caption { font-size: var(--t-sm); color: var(--fg-muted); margin-bottom: var(--sp-2); font-weight: 600; }
table { width: 100%; border-collapse: collapse; font-size: var(--t-sm); }
th { text-align: left; padding: var(--sp-2) var(--sp-3);
     border-bottom: 2px solid var(--border); color: var(--fg-muted);
     font-weight: 600; white-space: nowrap; }
td { padding: var(--sp-2) var(--sp-3); border-bottom: 1px solid var(--border); }
tr:last-child td { border-bottom: none; }
tbody tr:nth-child(even) { background: var(--surface-2); }
table.compact th, table.compact td { padding: var(--sp-1) var(--sp-2); }
th[data-sort] { cursor: pointer; user-select: none; }
th[data-sort]:hover { color: var(--accent); }

/* chart blocks */
.chart-block { background: var(--surface); border: 1px solid var(--border);
               border-radius: var(--radius); padding: var(--sp-4);
               margin: var(--sp-5) 0; min-width: 0; }
.chart-title { font-size: var(--t-base); font-weight: 600; margin-bottom: var(--sp-3); }
.chart-canvas-wrapper { position: relative; }

/* mermaid block */
.mermaid-figure { margin: var(--sp-5) 0; overflow-x: auto; }
.mermaid-figure figcaption { font-size: var(--t-sm); color: var(--fg-muted);
                              text-align: center; margin-top: var(--sp-2); }

/* text-section block */
.text-section { margin: var(--sp-6) 0; }
.text-section h2 { font-size: var(--t-xl); font-weight: 700; margin: 0 0 var(--sp-3); }
.text-section h3 { font-size: var(--t-lg); font-weight: 600; margin: var(--sp-5) 0 var(--sp-2); }
.text-section p { margin: 0 0 var(--sp-3); }
.text-section ul, .text-section ol { margin: 0 0 var(--sp-3); padding-left: var(--sp-5); }
.text-section blockquote { border-left: 3px solid var(--accent); margin: var(--sp-4) 0;
                            padding: var(--sp-2) var(--sp-4); color: var(--fg-muted);
                            background: var(--surface-2); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
.text-section--lead > p:first-child { font-size: var(--t-lg); }

/* alert block */
.alert { border-radius: var(--radius-sm); padding: var(--sp-3) var(--sp-4);
         margin: var(--sp-4) 0; border-left: 3px solid; }
.alert--info { background: color-mix(in srgb, var(--accent) 8%, var(--surface));
               border-color: var(--accent); }
.alert--warning { background: color-mix(in srgb, var(--warn) 8%, var(--surface));
                  border-color: var(--warn); }
.alert--error { background: color-mix(in srgb, var(--neg) 8%, var(--surface));
                border-color: var(--neg); }
.alert--success { background: color-mix(in srgb, var(--pos) 8%, var(--surface));
                  border-color: var(--pos); }
.alert__title { font-weight: 600; margin-bottom: var(--sp-1); font-size: var(--t-sm); }
.alert__body { font-size: var(--t-sm); color: var(--fg-muted); }

/* code-block */
.code-block { margin: var(--sp-4) 0; }
.code-block pre { background: var(--surface-2); border: 1px solid var(--border);
                  border-radius: var(--radius-sm); padding: var(--sp-4);
                  overflow-x: auto; font: var(--t-sm)/1.6 var(--font-mono);
                  margin: 0; }
.code-caption { font-size: var(--t-xs); color: var(--fg-muted); margin-top: var(--sp-1); }

/* image block */
.image-block { margin: var(--sp-5) 0; }
.image-block figure { margin: 0; }
.image-block img { max-width: 100%; height: auto; border-radius: var(--radius-sm);
                   display: block; }
.image-block figcaption { font-size: var(--t-sm); color: var(--fg-muted);
                           margin-top: var(--sp-2); }
.image-block--center { text-align: center; }
.image-block--center img { margin: 0 auto; }

/* two-columns block */
.two-columns { display: grid; gap: var(--sp-5); margin: var(--sp-5) 0; }

/* tabs block */
.tabs { margin: var(--sp-5) 0; }
.tabs__nav { display: flex; gap: 0; border-bottom: 1px solid var(--border); }
.tabs__btn { background: none; border: none; padding: var(--sp-2) var(--sp-4);
             cursor: pointer; font-size: var(--t-sm); color: var(--fg-muted);
             border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tabs__btn[aria-selected="true"] { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
.tabs__panel { padding: var(--sp-4) 0; display: none; }
.tabs__panel[aria-hidden="false"] { display: block; }

/* timeline block */
.timeline { margin: var(--sp-5) 0; list-style: none; padding: 0;
            position: relative; }
.timeline::before { content: ''; position: absolute; left: 8px; top: 8px; bottom: 8px;
                    width: 2px; background: var(--border); }
.timeline__item { display: flex; gap: var(--sp-4); margin-bottom: var(--sp-5);
                  position: relative; padding-left: var(--sp-6); }
.timeline__dot { position: absolute; left: 0; top: 4px; width: 18px; height: 18px;
                 border-radius: 50%; border: 2px solid var(--border);
                 background: var(--surface); flex-shrink: 0; }
.timeline__dot--done { background: var(--pos); border-color: var(--pos); }
.timeline__dot--active { background: var(--accent); border-color: var(--accent); }
.timeline__dot--pending { background: var(--surface-2); }
.timeline__date { font-size: var(--t-xs); color: var(--fg-muted); white-space: nowrap; }
.timeline__title { font-weight: 600; font-size: var(--t-sm); margin-bottom: var(--sp-1); }
.timeline__body { font-size: var(--t-sm); color: var(--fg-muted); }

/* progress-bars block */
.progress-bars { margin: var(--sp-5) 0; display: flex; flex-direction: column; gap: var(--sp-3); }
.progress-item { display: grid; grid-template-columns: 1fr auto; gap: var(--sp-1); }
.progress-label { font-size: var(--t-sm); }
.progress-value { font-size: var(--t-sm); font-weight: 600; color: var(--fg-muted); }
.progress-track { grid-column: 1 / -1; height: 8px; background: var(--surface-2);
                  border-radius: 99px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 99px; background: var(--accent); transition: width 0.4s; }

/* list-cards block */
.list-cards { display: grid; gap: var(--sp-4); margin: var(--sp-5) 0; }
.list-card { background: var(--surface); border: 1px solid var(--border);
             border-radius: var(--radius); padding: var(--sp-4) var(--sp-5);
             box-shadow: var(--shadow); text-decoration: none; color: inherit; }
a.list-card:hover { border-color: var(--accent); }
.list-card__icon { font-size: 1.5em; margin-bottom: var(--sp-2); display: block; }
.list-card__title { font-weight: 600; margin-bottom: var(--sp-1); }
.list-card__body { font-size: var(--t-sm); color: var(--fg-muted); }
.list-card__badge { display: inline-block; padding: 2px 8px; border-radius: 99px;
                    font-size: var(--t-xs); margin-top: var(--sp-2); background: var(--accent);
                    color: var(--accent-fg); }

/* badge-row block */
.badge-row { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin: var(--sp-3) 0; }
.badge { display: inline-block; padding: 3px 12px; border-radius: 99px;
         font-size: var(--t-xs); font-weight: 500; background: var(--accent);
         color: var(--accent-fg); }

/* divider block */
.divider { display: flex; align-items: center; gap: var(--sp-3);
           margin: var(--sp-6) 0; color: var(--fg-muted); }
.divider::before, .divider::after { content: ''; flex: 1;
                                     height: 1px; background: var(--border); }
.divider--no-label::after { display: none; }

/* spacer block */
.spacer { display: block; }

/* raw block */
.raw-block { }

/* print */
@media print {
  body { background: #fff; color: #000; }
  .kpi-tile, .chart-block, .stats-card, .list-card { box-shadow: none !important; }
  table, figure, blockquote, pre { break-inside: avoid; }
  h1, h2, h3 { break-after: avoid; }
}

/* reduced motion */
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
```

---

## `data.css` — Delta для дашбордов

```css
/* === THEME: data — analytics dashboards === */

main { max-width: 1100px; }  /* шире для плотного контента */

/* compact spacing */
.kpi-row { gap: var(--sp-3); }
.kpi-tile { padding: var(--sp-3) var(--sp-4); }

/* stronger table borders */
th { border-bottom-width: 2px; border-bottom-color: var(--accent); }
tbody tr:hover { background: color-mix(in srgb, var(--accent) 5%, var(--surface)); }

/* chart emphasis */
.chart-block { box-shadow: var(--shadow); }
```

---

## `document.css` — Delta для документов

```css
/* === THEME: document — long-form prose === */

main { max-width: 720px; }  /* reader-friendly width */

body { line-height: 1.8; }
.text-section p { line-height: 1.85; margin-bottom: var(--sp-4); }

/* drop cap for first paragraph */
.text-section--lead > p:first-child::first-letter {
  float: left; font-size: 3em; line-height: 0.8; margin: 4px 8px 0 0;
  font-weight: 800; color: var(--accent);
}

/* wider heading margin */
.text-section h2 { margin-top: var(--sp-8); padding-bottom: var(--sp-2);
                   border-bottom: 1px solid var(--border); }
```

---

## `promo.css` — Delta для лендингов

```css
/* === THEME: promo — landing pages & announcements === */

main { max-width: 1000px; }

/* bold hero */
.hero { padding: var(--sp-8) 0; text-align: center; }
.hero__title { font-size: var(--t-3xl); font-weight: 800; }
.hero__subtitle { font-size: var(--t-xl); max-width: 600px; margin: 0 auto var(--sp-4); }

/* accent gradient for hero background */
.hero { background: linear-gradient(135deg,
  color-mix(in srgb, var(--accent) 8%, var(--bg)) 0%,
  var(--bg) 60%); }

/* card hover effects */
.list-card { transition: transform 0.15s, box-shadow 0.15s; }
.list-card:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0,0,0,.12); }
```

---

## `diagram.css` — Delta для диаграмм

```css
/* === THEME: diagram — architecture & flow diagrams === */

main { max-width: 1000px; }

/* mermaid centering */
.mermaid-figure { text-align: center; }
.mermaid svg { max-width: 100%; height: auto; }

/* extra space around diagram */
.mermaid-figure { padding: var(--sp-5) 0; }
```

---

## Цветовые маппинги

В шаблонах блоков поле `color: c1` преобразуется в CSS-переменную. Таблица маппинга:

| Значение | CSS-переменная | Light | Dark |
|----------|---------------|-------|------|
| `accent` | `--accent` | #2563eb | #60a5fa |
| `pos` | `--pos` | #16a34a | #4ade80 |
| `neg` | `--neg` | #dc2626 | #f87171 |
| `warn` | `--warn` | #b45309 | #fbbf24 |
| `muted` | `--fg-muted` | #71717a | #a1a1aa |
| `c1` | `--c1` | #2563eb | #60a5fa |
| `c2` | `--c2` | #d97706 | #fbbf24 |
| `c3` | `--c3` | #16a34a | #4ade80 |
| `c4` | `--c4` | #db2777 | #f472b6 |
| `c5` | `--c5` | #7c3aed | #a78bfa |
| `c6` | `--c6` | #0891b2 | #22d3ee |

Использование в шаблоне блока:
```html
<div class="badge" style="background: var(--{{color}})">
```

Для badge на тёмном фоне добавляется автоматически `color: white` или `color: black` через `color-contrast()` (или фиксированный `accent-fg`).
