# SKILL.md Patch — Constructor Mode section

Этот файл описывает точные изменения, которые нужно внести в `skills/open-artifacts/SKILL.md`.

---

## Место вставки

Новая секция вставляется **перед** строкой:

```
## Design: read a template before you write
```

(текущая строка ~190 в SKILL.md)

---

## Текст новой секции

```markdown
## Constructor Mode (default)

**By default, always use Constructor Mode** to create HTML artifacts. It is faster, uses fewer
tokens, and produces consistent, accessible, dark-mode-ready pages without writing raw HTML.
Only switch to raw HTML when explicitly asked ("write raw HTML", "give me the full source") or
when the layout is genuinely impossible to express with the available blocks.

### How it works

1. Write a YAML specification file (`artifact.yaml`) describing the artifact as a list of blocks
2. Run the builder script to compile it into a self-contained HTML file
3. Push the HTML to Open Artifacts with `oa push`

The builder lives at `skills/open-artifacts/constructor/build.mjs`. Load it from there —
don't copy it. Read the full block catalogue before writing the spec.

### Quick start

```bash
# Write your spec:
cat > /tmp/my-artifact.yaml << 'EOF'
title: "My Report"
theme: data         # default | data | document | promo | diagram

blocks:
  - type: hero
    title: "My Report"
    subtitle: "Summary for Q3 2026"

  - type: kpi-row
    items:
      - label: Revenue
        value: "$4.2M"
        delta: "+18%"
        trend: up

  - type: table
    caption: "Top accounts"
    columns: ["Name", "ARR"]
    rows:
      - ["Acme", "$420k"]
      - ["Globex", "$380k"]
EOF

# Build and publish:
node skills/open-artifacts/constructor/build.mjs /tmp/my-artifact.yaml --share
```

### Theme selection

| Theme | Use when |
|-------|----------|
| `default` | Generic content, one-offs, mixed layouts |
| `data` | KPI dashboards, analytics, dense tables |
| `document` | Long prose: reports, RFCs, post-mortems |
| `promo` | Landing pages, announcements, pitch decks |
| `diagram` | Architecture diagrams, flow charts |

### Block catalogue (summary)

Read `constructor/BLOCKS-SPEC.md` (in this skill's directory) for full field reference.

| Type | Purpose |
|------|---------|
| `hero` | Page header with title, subtitle, badge |
| `kpi-row` | Row of KPI tiles with delta and trend |
| `stats-grid` | Grid of large-number stat cards |
| `table` | Sortable, striped HTML table |
| `chart-bar` | Bar chart (Chart.js) |
| `chart-line` | Line chart (Chart.js) |
| `chart-pie` | Pie / donut chart (Chart.js) |
| `mermaid-diagram` | Embedded Mermaid diagram |
| `text-section` | Heading + short Markdown prose |
| `markdown` | **Full Markdown content inline in YAML** — for ready-made reports |
| `markdown-file` | **Load a .md file from disk** — for large ready-made reports |
| `alert` | Info / warning / error / success callout |
| `code-block` | Syntax-highlighted code |
| `image` | Image with caption |
| `two-columns` | Two-column layout |
| `tabs` | Tabbed content switcher |
| `timeline` | Vertical event timeline |
| `progress-bars` | Horizontal progress bars |
| `list-cards` | Grid of content cards |
| `badge-row` | Row of color-coded badges |
| `divider` | Section separator |
| `spacer` | Vertical whitespace |
| `raw` | **Escape hatch: arbitrary HTML/CSS/JS** |

### Publishing a ready-made Markdown report

If you already have a Markdown document written (report, analysis, README, post-mortem),
you have three options — pick the shortest one for the task:

**Option A — Passthrough (fewest tokens, whole file):**
Write the spec with `source:` instead of `blocks:`. The entire .md file becomes the artifact.
```yaml
title: "Q3 Analysis"
theme: document
source: /tmp/q3-report.md
```
```bash
node skills/open-artifacts/constructor/build.mjs /tmp/spec.yaml --share
```

**Option B — `markdown-file` block (file + optional framing blocks):**
Combine KPI tiles or a hero header with the full .md file.
```yaml
title: "Q3 Full Report"
theme: document
blocks:
  - type: hero
    title: "Q3 Analysis"
    meta: "Generated 2026-09-18"
  - type: markdown-file
    path: /tmp/q3-report.md
```

**Option C — `markdown` block (inline MD in YAML):**
When the content is short enough to paste directly into the spec.
```yaml
blocks:
  - type: markdown
    content: |
      ## Summary
      Revenue grew **18% QoQ**. Key drivers: enterprise expansion, 3 new Fortune 500 logos.
      ...
```

YAML frontmatter (`---…---`) is stripped automatically from both `source` and `markdown-file`.

### When to use `raw` block

Use the `raw` block when no other block fits. It accepts arbitrary `html`, `css`, and `scripts`
fields. CSS custom properties from the active theme are available — use them instead of
hardcoding colors:

```yaml
- type: raw
  css: |
    .custom { background: var(--surface-2); padding: var(--sp-4); border-radius: var(--radius); }
  html: |
    <div class="custom">Any HTML here</div>
  scripts: |
    console.log('runs in browser');
```

### When NOT to use Constructor Mode

- The human explicitly asked for raw/full HTML output
- The layout requires a highly custom structure that `two-columns` + `raw` can't express
- You're updating an existing raw HTML artifact (use `oa get` + edit + `oa push`)

In those cases, skip to the **"Design: read a template before you write"** section below and
write the HTML directly as before.
```

---

## Изменение в таблице "What you're about to publish"

В таблице после секции «Design: read a template before you write» добавить строку **в начало**:

```markdown
| Most cases: KPIs, dashboards, docs, diagrams | **Use Constructor Mode** (above) — don't write raw HTML |
```

---

## Примечание в конце SKILL.md

В конце файла, перед разделом «If you're an MCP client instead», добавить:

```markdown
## Constructor: full reference

The block catalogue and builder specification are in this skill's `constructor/` directory:
- `constructor/BLOCKS-SPEC.md` — every block's fields, defaults, and YAML examples
- `constructor/BUILDER-SPEC.md` — how `build.mjs` works, CLI flags, error handling
- `constructor/THEMES-SPEC.md` — CSS theme files: what they contain and how to extend them

Read these files if you hit a case the quick-start above doesn't cover.
```
