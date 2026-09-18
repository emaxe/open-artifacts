#!/usr/bin/env node
/**
 * Open Artifacts Constructor — build.mjs
 * Assembles a self-contained HTML artifact from a YAML specification.
 *
 * Usage:
 *   node build.mjs <spec.yaml> [options]
 *
 * Options:
 *   --out <file>         Output HTML path (default: <spec-basename>.html)
 *   --push               Push to Open Artifacts after build
 *   --share              Create share link after push (implies --push)
 *   --title <title>      Override artifact title for oa push
 *   --org <slug>         Override org for oa push
 *   --lifetime <dur>     Lifetime for oa push (e.g. 7d, 12h)
 *   --public             Create public share link
 *   --password <pwd>     Create password-protected share link
 *   --themes-dir <path>  Path to themes directory
 *   --blocks-dir <path>  Path to blocks directory
 *   --strict             Fail build on any unknown fields or alias warnings
 *   --lenient            Proceed with build even if validation errors are found
 *   --verbose            Debug output
 *   --help               Show help
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Dependency resolution ───────────────────────────────────────────────────

function findModule(name) {
  // Walk up from __dirname looking for node_modules
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

async function loadDependencies() {
  const req = createRequire(import.meta.url);
  const deps = {};

  // js-yaml
  try {
    deps.yaml = req('js-yaml');
  } catch {
    const p = findModule('js-yaml');
    if (p) {
      deps.yaml = req(p);
    } else {
      // Don't exit here — JSON files don't need js-yaml
      deps.yaml = null;
    }
  }

  // marked
  try {
    deps.marked = req('marked');
  } catch {
    const p = findModule('marked');
    if (p) deps.marked = req(p);
    else {
      // Fallback: minimal Markdown converter (bold, italic, headers, code, links, lists)
      deps.marked = { parse: minimalMarkdown };
      if (args['--verbose']) console.log('[warn] marked not found, using minimal Markdown fallback');
    }
  }

  return deps;
}

// Minimal Markdown fallback (covers common patterns when marked is unavailable)
function minimalMarkdown(md) {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // fenced code blocks
    .replace(/```[\w]*\n([\s\S]*?)```/g, (_, c) => `<pre><code>${c.trimEnd()}</code></pre>`)
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // headers
    .replace(/^#{6} (.+)$/gm, '<h6>$1</h6>')
    .replace(/^#{5} (.+)$/gm, '<h5>$1</h5>')
    .replace(/^#{4} (.+)$/gm, '<h4>$1</h4>')
    .replace(/^#{3} (.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2} (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // blockquotes
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    // horizontal rule
    .replace(/^---$/gm, '<hr>')
    // unordered lists
    .replace(/(^- .+(\n|$))+/gm, m =>
      '<ul>' + m.trim().split('\n').map(l => `<li>${l.replace(/^- /, '')}</li>`).join('') + '</ul>')
    // ordered lists
    .replace(/(^\d+\. .+(\n|$))+/gm, m =>
      '<ol>' + m.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('') + '</ol>')
    // links + images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // paragraphs (double newline)
    .replace(/\n\n+/g, '\n\n')
    .split('\n\n')
    .map(b => b.startsWith('<') ? b : `<p>${b.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

// ─── Argument parsing ────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a;
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args['--help'] || args._.length === 0) {
  console.log(`
Open Artifacts Constructor — build.mjs

Usage: node build.mjs <spec.yaml> [options]

Options:
  --out <file>         Output HTML file path (default: <spec-basename>.html)
  --push               Push to Open Artifacts after build
  --share              Create share link after push (implies --push)
  --title <title>      Override artifact title for oa push
  --org <slug>         Override org for oa push
  --lifetime <dur>     Lifetime (e.g. 7d, 12h)
  --public             Public share link
  --password <pwd>     Password-protected share link
  --themes-dir <path>  Custom themes directory
  --blocks-dir <path>  Custom blocks directory
  --strict             Fail on any unknown fields or unmapped properties
  --lenient            Proceed with build even if validation errors are found
  --verbose            Verbose output
  --help               This help

Spec format (YAML):
  title: "My Artifact"
  theme: default | data | document | promo | diagram
  lang: en
  source: /path/to/report.md        # passthrough mode (whole MD file)
  blocks:                            # or blocks mode
    - type: hero
      title: "..."
    - type: kpi-row
      items: [...]
    - type: markdown
      content: |
        ## My Markdown
        ...
    - type: markdown-file
      path: ./report.md
`);
  process.exit(0);
}

// ─── CDN URLs ────────────────────────────────────────────────────────────────

const CDN = {
  chartjs: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  mermaid: 'https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.6.1/mermaid.min.js',
  hljs:    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
  hljsCss: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css',
};

// ─── Utility functions ───────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripFrontmatter(md) {
  return md.replace(/^---[\s\S]*?^---\s*(\r?\n|$)/m, '').trimStart();
}

function resolvePath(filePath, base) {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(base, filePath);
}

// sp-N tokens → pixel values
const SP_MAP = { 'sp-1':'4px','sp-2':'8px','sp-3':'12px','sp-4':'16px','sp-5':'24px','sp-6':'32px','sp-7':'48px','sp-8':'64px' };
function resolveSize(s) {
  return SP_MAP[s] || s || '24px';
}

// color token for CSS
function colorVar(c) {
  if (!c) return 'accent';
  const valid = ['accent','pos','neg','warn','muted','c1','c2','c3','c4','c5','c6'];
  return valid.includes(c) ? c : 'accent';
}

// Parse ratio "2:1" → ["2fr", "1fr"]
function parseRatio(ratio) {
  const parts = String(ratio || '1:1').split(':');
  if (parts.length !== 2) return ['1fr', '1fr'];
  return [`${parts[0]}fr`, `${parts[1]}fr`];
}

// ─── Spec Validator & Normalizer ───────────────────────────────────────────

function levenshteinDistance(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;
  const v0 = new Array(s2.length + 1);
  const v1 = new Array(s2.length + 1);
  for (let i = 0; i <= s2.length; i++) v0[i] = i;
  for (let i = 0; i < s1.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < s2.length; j++) {
      const cost = s1[i] === s2[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= s2.length; j++) v0[j] = v1[j];
  }
  return v1[s2.length];
}

function findBestSuggestion(unknown, candidates) {
  const norm = String(unknown).toLowerCase().replace(/[-_]/g, '');
  let best = null;
  let bestDist = Infinity;
  for (const cand of candidates) {
    const normCand = cand.toLowerCase().replace(/[-_]/g, '');
    const d = levenshteinDistance(norm, normCand);
    if (d < bestDist && (d <= 2 || (norm.length > 4 && d <= 3))) {
      bestDist = d;
      best = cand;
    }
  }
  return best;
}

const BLOCK_TYPE_ALIASES = {
  callout: 'alert',
  note: 'alert',
  warning: 'alert',
  cards: 'list-cards',
  card: 'list-cards',
  kpi: 'kpi-row',
  kpis: 'kpi-row',
  stats: 'stats-grid',
  grid: 'stats-grid',
  code: 'code-block',
  codeblock: 'code-block',
  diagram: 'mermaid-diagram',
  mermaid: 'mermaid-diagram',
  text: 'text-section',
  section: 'text-section',
  progress: 'progress-bars',
  bar: 'chart-bar',
  line: 'chart-line',
  pie: 'chart-pie',
  columns: 'two-columns',
  badges: 'badge-row',
};

const BLOCK_DEFINITIONS = {
  hero: {
    canonical: ['type', 'title', 'subtitle', 'badge', 'badge_color', 'align', 'meta', 'class', 'id'],
    aliases: {
      heading: 'title',
      header: 'title',
      description: 'subtitle',
      text: 'subtitle',
      body: 'subtitle',
      tag: 'badge',
      label: 'badge',
      date: 'meta',
      author: 'meta',
      footer: 'meta',
    },
    validate(b) {
      const errs = [];
      if (!b.title || !String(b.title).trim()) {
        errs.push('Hero block requires non-empty "title" (or "heading").');
      }
      return errs;
    }
  },
  'kpi-row': {
    canonical: ['type', 'items', 'cols', 'class', 'id'],
    aliases: {
      cards: 'items',
      kpis: 'items',
      stats: 'items',
    },
    itemCanonical: ['label', 'value', 'delta', 'trend', 'suffix', 'icon', 'color', 'class'],
    itemAliases: {
      title: 'label',
      name: 'label',
      key: 'label',
      val: 'value',
      number: 'value',
      stat: 'value',
      change: 'delta',
      diff: 'delta',
      direction: 'trend',
      unit: 'suffix',
    },
    normalizeItem(it) {
      if (it && it.trend) {
        const tr = String(it.trend).toLowerCase();
        if (['positive', 'increase', 'growing', 'gain'].includes(tr)) it.trend = 'up';
        else if (['negative', 'decrease', 'falling', 'loss'].includes(tr)) it.trend = 'down';
        else if (['flat', 'none', 'same'].includes(tr)) it.trend = 'neutral';
      }
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.items) || b.items.length === 0) {
        errs.push('kpi-row block requires a non-empty "items" array.');
      }
      return errs;
    }
  },
  'stats-grid': {
    canonical: ['type', 'items', 'cols', 'class', 'id'],
    aliases: {
      cards: 'items',
      stats: 'items',
    },
    itemCanonical: ['label', 'value', 'icon', 'color', 'class'],
    itemAliases: {
      title: 'label',
      name: 'label',
      key: 'label',
      val: 'value',
      number: 'value',
      stat: 'value',
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.items) || b.items.length === 0) {
        errs.push('stats-grid block requires a non-empty "items" array.');
      }
      return errs;
    }
  },
  table: {
    canonical: ['type', 'columns', 'rows', 'caption', 'sortable', 'striped', 'compact', 'highlight_col', 'class', 'id'],
    aliases: {
      headers: 'columns',
      cols: 'columns',
      head: 'columns',
      data: 'rows',
      items: 'rows',
      values: 'rows',
      title: 'caption',
    },
    validate(b) {
      const errs = [];
      if (!b.columns && !b.rows) {
        errs.push('table block requires "columns" (or "headers") and/or "rows".');
      }
      return errs;
    }
  },
  'chart-bar': {
    canonical: ['type', 'title', 'labels', 'datasets', 'height', 'stacked', 'horizontal', 'class', 'id'],
    aliases: {
      caption: 'title',
      header: 'title',
      series: 'datasets',
    },
    itemArrayField: 'datasets',
    itemCanonical: ['label', 'data', 'color'],
    itemAliases: {
      name: 'label',
      title: 'label',
      values: 'data',
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.labels) || b.labels.length === 0) {
        errs.push('chart-bar block requires a non-empty "labels" array.');
      }
      if (!Array.isArray(b.datasets) || b.datasets.length === 0) {
        errs.push('chart-bar block requires a non-empty "datasets" array.');
      }
      return errs;
    }
  },
  'chart-line': {
    canonical: ['type', 'title', 'labels', 'datasets', 'height', 'fill', 'tension', 'y_min', 'y_max', 'class', 'id'],
    aliases: {
      caption: 'title',
      header: 'title',
      series: 'datasets',
    },
    itemArrayField: 'datasets',
    itemCanonical: ['label', 'data', 'color'],
    itemAliases: {
      name: 'label',
      title: 'label',
      values: 'data',
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.labels) || b.labels.length === 0) {
        errs.push('chart-line block requires a non-empty "labels" array.');
      }
      if (!Array.isArray(b.datasets) || b.datasets.length === 0) {
        errs.push('chart-line block requires a non-empty "datasets" array.');
      }
      return errs;
    }
  },
  'chart-pie': {
    canonical: ['type', 'title', 'labels', 'data', 'donut', 'height', 'class', 'id'],
    aliases: {
      caption: 'title',
      header: 'title',
      values: 'data',
      datasets: 'data',
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.labels) || b.labels.length === 0) {
        errs.push('chart-pie block requires a non-empty "labels" array.');
      }
      if (!Array.isArray(b.data) || b.data.length === 0) {
        errs.push('chart-pie block requires a non-empty "data" (or "values") array.');
      }
      return errs;
    }
  },
  'mermaid-diagram': {
    canonical: ['type', 'definition', 'caption', 'class', 'id'],
    aliases: {
      code: 'definition',
      diagram: 'definition',
      content: 'definition',
      chart: 'definition',
      mermaid: 'definition',
      title: 'caption',
      description: 'caption',
    },
    validate(b) {
      const errs = [];
      if (!b.definition || !String(b.definition).trim()) {
        errs.push('mermaid-diagram block requires non-empty "definition" (or "code" / "diagram").');
      }
      return errs;
    }
  },
  'text-section': {
    canonical: ['type', 'heading', 'level', 'body', 'lead', 'class', 'id'],
    aliases: {
      title: 'heading',
      header: 'heading',
      content: 'body',
      text: 'body',
      markdown: 'body',
    },
    validate(b) {
      const errs = [];
      if (!b.body || !String(b.body).trim()) {
        errs.push('text-section block requires non-empty "body" (or "text" / "content").');
      }
      return errs;
    }
  },
  alert: {
    canonical: ['type', 'kind', 'title', 'body', 'icon', 'class', 'id'],
    aliases: {
      variant: 'kind',
      status: 'kind',
      severity: 'kind',
      level: 'kind',
      alert_type: 'kind',
      text: 'body',
      content: 'body',
      message: 'body',
      description: 'body',
      heading: 'title',
      header: 'title',
    },
    normalize(b) {
      if (b.kind) {
        const k = String(b.kind).toLowerCase();
        if (k === 'warn') b.kind = 'warning';
        else if (k === 'danger' || k === 'critical') b.kind = 'error';
      }
    },
    validate(b) {
      const errs = [];
      const hasTitle = b.title && String(b.title).trim();
      const hasBody = b.body && String(b.body).trim();
      if (!hasTitle && !hasBody) {
        errs.push('Alert block has neither "body" (or "text") nor "title" — it will render as an empty icon.');
      }
      if (b.kind) {
        const validKinds = ['info', 'warning', 'error', 'success'];
        if (!validKinds.includes(String(b.kind).toLowerCase())) {
          errs.push(`Alert "kind" must be one of: ${validKinds.join(', ')} (got "${b.kind}").`);
        }
      }
      return errs;
    }
  },
  'code-block': {
    canonical: ['type', 'lang', 'code', 'caption', 'line_numbers', 'class', 'id'],
    aliases: {
      language: 'lang',
      content: 'code',
      text: 'code',
      source: 'code',
      title: 'caption',
    },
    validate(b) {
      const errs = [];
      if (b.code == null || !String(b.code).trim()) {
        errs.push('code-block requires non-empty "code" (or "content" / "source").');
      }
      return errs;
    }
  },
  image: {
    canonical: ['type', 'src', 'alt', 'caption', 'width', 'align', 'zoomable', 'class', 'id'],
    aliases: {
      url: 'src',
      path: 'src',
      image: 'src',
      description: 'alt',
      title: 'caption',
      zoom: 'zoomable',
      lightbox: 'zoomable',
      fullscreen: 'zoomable',
    },
    normalize(b) {
      if (b.src && !b.alt) {
        b.alt = b.caption || path.basename(String(b.src)) || 'Image';
      }
    },
    validate(b) {
      const errs = [];
      if (!b.src || !String(b.src).trim()) {
        errs.push('image block requires non-empty "src" (or "url" / "path").');
      }
      return errs;
    }
  },
  'two-columns': {
    canonical: ['type', 'left', 'right', 'ratio', 'gap', 'breakpoint', 'class', 'id'],
    aliases: {
      col1: 'left',
      left_column: 'left',
      col2: 'right',
      right_column: 'right',
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.left) && !Array.isArray(b.right)) {
        errs.push('two-columns block requires "left" and "right" block arrays.');
      }
      return errs;
    }
  },
  tabs: {
    canonical: ['type', 'items', 'default', 'class', 'id'],
    aliases: {
      tabs: 'items',
    },
    itemCanonical: ['label', 'blocks'],
    itemAliases: {
      title: 'label',
      name: 'label',
      content: 'blocks',
      children: 'blocks',
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.items) || b.items.length === 0) {
        errs.push('tabs block requires a non-empty "items" array.');
      }
      return errs;
    }
  },
  timeline: {
    canonical: ['type', 'items', 'class', 'id'],
    aliases: {
      events: 'items',
      steps: 'items',
    },
    itemCanonical: ['date', 'title', 'body', 'status', 'icon'],
    itemAliases: {
      time: 'date',
      timestamp: 'date',
      period: 'date',
      day: 'date',
      heading: 'title',
      header: 'title',
      name: 'title',
      label: 'title',
      text: 'body',
      content: 'body',
      description: 'body',
    },
    normalizeItem(it) {
      if (it && it.status) {
        const s = String(it.status).toLowerCase();
        if (['completed', 'finish', 'finished'].includes(s)) it.status = 'done';
        else if (['in_progress', 'current', 'running', 'progress'].includes(s)) it.status = 'active';
        else if (['todo', 'waiting', 'queue', 'planned'].includes(s)) it.status = 'pending';
      }
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.items) || b.items.length === 0) {
        errs.push('timeline block requires a non-empty "items" array.');
      }
      return errs;
    }
  },
  'progress-bars': {
    canonical: ['type', 'items', 'class', 'id'],
    aliases: {
      bars: 'items',
      progress: 'items',
    },
    itemCanonical: ['label', 'value', 'max', 'unit', 'color', 'show_value'],
    itemAliases: {
      title: 'label',
      name: 'label',
      percent: 'value',
      percentage: 'value',
      total: 'max',
      suffix: 'unit',
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.items) || b.items.length === 0) {
        errs.push('progress-bars block requires a non-empty "items" array.');
      }
      return errs;
    }
  },
  'list-cards': {
    canonical: ['type', 'items', 'cols', 'class', 'id'],
    aliases: {
      cards: 'items',
    },
    itemCanonical: ['title', 'body', 'badge', 'badge_color', 'href', 'icon'],
    itemAliases: {
      heading: 'title',
      header: 'title',
      name: 'title',
      text: 'body',
      content: 'body',
      description: 'body',
      tag: 'badge',
      label: 'badge',
      url: 'href',
      link: 'href',
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.items) || b.items.length === 0) {
        errs.push('list-cards block requires a non-empty "items" array.');
      }
      return errs;
    }
  },
  'badge-row': {
    canonical: ['type', 'items', 'align', 'class', 'id'],
    aliases: {
      badges: 'items',
      tags: 'items',
    },
    itemCanonical: ['label', 'color'],
    itemAliases: {
      text: 'label',
      name: 'label',
      value: 'label',
      title: 'label',
      tag: 'label',
    },
    normalize(b) {
      if (Array.isArray(b.items)) {
        b.items = b.items.map(it => (typeof it === 'string' ? { label: it } : it));
      }
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.items) || b.items.length === 0) {
        errs.push('badge-row block requires a non-empty "items" array.');
      }
      return errs;
    }
  },
  divider: {
    canonical: ['type', 'label', 'class', 'id'],
    aliases: {
      text: 'label',
      title: 'label',
    }
  },
  spacer: {
    canonical: ['type', 'size', 'class', 'id'],
    aliases: {
      height: 'size',
    }
  },
  raw: {
    canonical: ['type', 'html', 'css', 'scripts', 'cdn_scripts', 'class', 'id'],
    aliases: {
      content: 'html',
      body: 'html',
      js: 'scripts',
      script: 'scripts',
      style: 'css',
      styles: 'css',
    }
  },
  markdown: {
    canonical: ['type', 'content', 'class', 'id'],
    aliases: {
      text: 'content',
      body: 'content',
      md: 'content',
      markdown: 'content',
    },
    validate(b) {
      const errs = [];
      if (b.content == null || !String(b.content).trim()) {
        errs.push('markdown block requires non-empty "content" (or "text" / "body").');
      }
      return errs;
    }
  },
  'markdown-file': {
    canonical: ['type', 'path', 'strip_frontmatter', 'class', 'id'],
    aliases: {
      file: 'path',
      src: 'path',
      source: 'path',
    },
    validate(b) {
      const errs = [];
      if (!b.path || !String(b.path).trim()) {
        errs.push('markdown-file block requires non-empty "path" (or "file" / "src").');
      }
      return errs;
    }
  }
};

function normalizeAndValidateBlock(rawBlock, index, pathPrefix, options, report) {
  if (typeof rawBlock !== 'object' || rawBlock === null) {
    report.errors.push(`${pathPrefix}Block #${index + 1} must be a mapping/object (got ${typeof rawBlock}).`);
    return rawBlock;
  }

  const b = { ...rawBlock };
  const loc = `${pathPrefix}Block #${index + 1}`;

  // 1. Resolve type
  if (!b.type) {
    report.errors.push(`${loc}: Missing required "type" property.`);
    return b;
  }

  const rawType = String(b.type).toLowerCase();
  if (BLOCK_TYPE_ALIASES[rawType]) {
    const targetType = BLOCK_TYPE_ALIASES[rawType];
    report.mappedAliases.push(`${loc}: auto-mapped block type "${rawType}" → "${targetType}"`);
    b.type = targetType;
  } else {
    b.type = rawType;
  }

  const def = BLOCK_DEFINITIONS[b.type];
  if (!def) {
    const knownTypes = Object.keys(BLOCK_DEFINITIONS);
    const suggestion = findBestSuggestion(b.type, knownTypes);
    const sugText = suggestion ? ` Did you mean "${suggestion}"?` : '';
    report.errors.push(`${loc}: Unknown block type "${b.type}".${sugText} (Allowed: ${knownTypes.join(', ')})`);
    return b;
  }

  // 2. Resolve block-level aliases
  const aliases = def.aliases || {};
  const canonical = new Set(def.canonical || []);
  const allKnown = new Set([...canonical, ...Object.keys(aliases)]);

  for (const [key, val] of Object.entries(rawBlock)) {
    if (key === 'type' || key.startsWith('not_') || key.startsWith('_')) continue;

    if (aliases[key]) {
      const target = aliases[key];
      if (b[target] === undefined || b[target] === null || b[target] === '') {
        b[target] = val;
      }
      report.mappedAliases.push(`${loc} (${b.type}): auto-mapped "${key}" → "${target}"`);
    } else if (!canonical.has(key)) {
      const suggestion = findBestSuggestion(key, [...allKnown]);
      const sugText = suggestion ? ` Did you mean "${suggestion}"?` : '';
      const msg = `${loc} (${b.type}): Unknown property "${key}".${sugText} (Allowed: ${def.canonical.join(', ')})`;
      if (options.strict) {
        report.errors.push(msg);
      } else {
        report.warnings.push(msg);
      }
    }
  }

  // 3. Custom block normalizer
  if (def.normalize) {
    def.normalize(b);
  }

  // 4. Normalize items in arrays (e.g. kpi-row, stats-grid, list-cards, progress-bars, timeline, badge-row)
  const itemArrayField = def.itemArrayField || 'items';
  if (Array.isArray(b[itemArrayField]) && (def.itemCanonical || def.itemAliases)) {
    const itCan = new Set(def.itemCanonical || []);
    const itAliases = def.itemAliases || {};
    const itKnown = new Set([...itCan, ...Object.keys(itAliases)]);

    b[itemArrayField] = b[itemArrayField].map((it, itIdx) => {
      if (typeof it !== 'object' || it === null) return it;
      const normalizedItem = { ...it };
      for (const [k, v] of Object.entries(it)) {
        if (k.startsWith('_') || k.startsWith('not_')) continue;
        if (itAliases[k]) {
          const target = itAliases[k];
          if (normalizedItem[target] === undefined || normalizedItem[target] === null || normalizedItem[target] === '') {
            normalizedItem[target] = v;
          }
          report.mappedAliases.push(`${loc} (${b.type}) item #${itIdx + 1}: auto-mapped "${k}" → "${target}"`);
        } else if (!itCan.has(k)) {
          const suggestion = findBestSuggestion(k, [...itKnown]);
          const sugText = suggestion ? ` Did you mean "${suggestion}"?` : '';
          const msg = `${loc} (${b.type}) item #${itIdx + 1}: Unknown property "${k}".${sugText}`;
          if (options.strict) report.errors.push(msg);
          else report.warnings.push(msg);
        }
      }
      if (def.normalizeItem) def.normalizeItem(normalizedItem);
      return normalizedItem;
    });
  }

  // 5. Nested blocks (two-columns, tabs)
  if (b.type === 'two-columns') {
    if (Array.isArray(b.left)) {
      b.left = b.left.map((child, i) => normalizeAndValidateBlock(child, i, `${loc} (left) → `, options, report));
    }
    if (Array.isArray(b.right)) {
      b.right = b.right.map((child, i) => normalizeAndValidateBlock(child, i, `${loc} (right) → `, options, report));
    }
  }

  if (b.type === 'tabs' && Array.isArray(b.items)) {
    b.items.forEach((tab, tIdx) => {
      if (Array.isArray(tab.blocks)) {
        tab.blocks = tab.blocks.map((child, i) =>
          normalizeAndValidateBlock(child, i, `${loc} (tab "${tab.label || tIdx + 1}") → `, options, report)
        );
      }
    });
  }

  // 6. Validation rules
  if (def.validate) {
    const errs = def.validate(b);
    if (errs && errs.length) {
      errs.forEach(err => report.errors.push(`${loc} (${b.type}): ${err}`));
    }
  }

  return b;
}

function validateAndNormalizeSpec(spec, options = {}) {
  const report = {
    errors: [],
    warnings: [],
    mappedAliases: [],
    blockCount: 0,
  };

  if (!spec || typeof spec !== 'object') {
    report.errors.push('Spec must be an object/mapping.');
    return { normalizedSpec: spec, report };
  }

  const normalized = { ...spec };

  // Check top-level aliases
  if (normalized.heading && !normalized.title) {
    normalized.title = normalized.heading;
    report.mappedAliases.push('Spec: auto-mapped root "heading" → "title"');
  }

  if (normalized.source) {
    // passthrough mode
    return { normalizedSpec: normalized, report };
  }

  if (!Array.isArray(normalized.blocks)) {
    report.errors.push('Spec must contain a "blocks" array (or "source" file).');
    return { normalizedSpec: normalized, report };
  }

  normalized.blocks = normalized.blocks.map((b, i) =>
    normalizeAndValidateBlock(b, i, '', options, report)
  );
  report.blockCount = normalized.blocks.length;

  return { normalizedSpec: normalized, report };
}

// ─── Template engine ─────────────────────────────────────────────────────────

function getVal(ctx, path) {
  if (ctx == null || path == null) return undefined;
  path = String(path).trim();
  if (path === 'this') {
    return (typeof ctx === 'object' && ctx !== null && typeof ctx.valueOf === 'function') ? ctx.valueOf() : ctx;
  }
  if (path.startsWith('this.')) path = path.slice(5);
  if (path.startsWith('../')) {
    return ctx._parent ? getVal(ctx._parent, path.slice(3)) : undefined;
  }
  const parts = path.split('.');
  let curr = ctx;
  for (const p of parts) {
    if (curr == null) return undefined;
    curr = curr[p];
  }
  return curr;
}

function findBlock(str, keyword) {
  const openTagPrefix = `{{#${keyword}`;
  const startIdx = str.indexOf(openTagPrefix);
  if (startIdx === -1) return null;
  const tagEnd = str.indexOf('}}', startIdx);
  if (tagEnd === -1) return null;
  const expr = str.slice(startIdx + openTagPrefix.length, tagEnd).trim();
  const contentStart = tagEnd + 2;

  let depth = 1;
  let pos = contentStart;
  const openStr = `{{#${keyword}`;
  const closeStr = `{{/${keyword}}}`;

  while (pos < str.length) {
    const nextOpen = str.indexOf(openStr, pos);
    const nextClose = str.indexOf(closeStr, pos);

    if (nextClose === -1) {
      throw new Error(`Unclosed {{#${keyword} ${expr}}}`);
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + openStr.length;
    } else {
      depth--;
      if (depth === 0) {
        return {
          start: startIdx,
          end: nextClose + closeStr.length,
          expr,
          content: str.slice(contentStart, nextClose)
        };
      }
      pos = nextClose + closeStr.length;
    }
  }
  return null;
}

function splitElse(content) {
  let depth = 0;
  let pos = 0;
  while (pos < content.length) {
    if (content.startsWith('{{#', pos)) {
      depth++;
      pos += 3;
    } else if (content.startsWith('{{/', pos)) {
      depth = Math.max(0, depth - 1);
      pos += 3;
    } else if (depth === 0 && content.startsWith('{{else}}', pos)) {
      return [content.slice(0, pos), content.slice(pos + 8)];
    } else {
      pos++;
    }
  }
  return [content, null];
}

function renderTemplate(tpl, ctx) {
  let res = tpl;

  // 1. Process #each blocks
  while (true) {
    const block = findBlock(res, 'each');
    if (!block) break;

    const list = getVal(ctx, block.expr);
    let rendered = '';
    if (Array.isArray(list)) {
      rendered = list.map((item, idx) => {
        let itemCtx;
        if (Array.isArray(item)) {
          itemCtx = [...item];
          itemCtx['@index'] = idx;
          itemCtx['@first'] = idx === 0;
          itemCtx['@last'] = idx === list.length - 1;
          itemCtx._parent = ctx;
        } else if (typeof item === 'object' && item !== null) {
          itemCtx = {
            ...item,
            '@index': idx,
            '@first': idx === 0,
            '@last': idx === list.length - 1,
            _parent: ctx
          };
          for (const [k, v] of Object.entries(item)) {
            itemCtx[`not_${k}`] = !v;
          }
        } else {
          itemCtx = Object.assign(Object(item), {
            '@index': idx,
            '@first': idx === 0,
            '@last': idx === list.length - 1,
            _parent: ctx
          });
        }
        return renderTemplate(block.content, itemCtx);
      }).join('');
    }
    res = res.slice(0, block.start) + rendered + res.slice(block.end);
  }

  // 2. Process #if blocks
  while (true) {
    const block = findBlock(res, 'if');
    if (!block) break;

    let condVal;
    const directVal = getVal(ctx, block.expr);
    if (directVal !== undefined) {
      condVal = !!directVal;
    } else if (block.expr.startsWith('not_')) {
      condVal = !getVal(ctx, block.expr.slice(4));
    } else {
      condVal = false;
    }

    const [truePart, falsePart] = splitElse(block.content);
    const chosenPart = condVal ? truePart : (falsePart || '');
    const rendered = renderTemplate(chosenPart, ctx);
    res = res.slice(0, block.start) + rendered + res.slice(block.end);
  }

  // 3. Raw variables: {{{var}}}
  res = res.replace(/\{\{\{([\w._@/-]+)\}\}\}/g, (_, path) => {
    const v = getVal(ctx, path);
    return v != null ? String(v) : '';
  });

  // 4. Escaped variables: {{var}}
  res = res.replace(/\{\{([\w._@/-]+)\}\}/g, (_, path) => {
    const v = getVal(ctx, path);
    return v != null ? escapeHtml(v) : '';
  });

  return res;
}

// ─── Block preprocessors ─────────────────────────────────────────────────────

let _chartIdx = 0;
let _tabIdx   = 0;

function preprocessBlock(block, { marked, specDir, blocksDir }) {
  const b = { ...block };

  // not_* mirrors for top-level fields
  Object.keys(b).forEach(k => { b[`not_${k}`] = !b[k]; });

  switch (b.type) {

    case 'hero':
      b.title = b.title || b.heading || b.header || '';
      b.subtitle = b.subtitle || b.description || b.text || b.body || '';
      b.align_center = b.align === 'center';
      b.not_align_center = !b.align_center;
      break;

    case 'kpi-row':
      (b.items || []).forEach(item => {
        item.label = item.label || item.title || item.name || item.key || '';
        item.value = item.value != null ? String(item.value) : (item.val != null ? String(item.val) : '');
        item.delta = item.delta || item.change || item.diff || '';
        item.trend = item.trend || 'neutral';
        item.suffix = item.suffix || item.unit || '';
        item.not_icon = !item.icon;
        item.not_delta = !item.delta;
        item.not_suffix = !item.suffix;
      });
      break;

    case 'stats-grid':
      b._cols = b.cols || 3;
      (b.items || []).forEach(item => {
        item.label = item.label || item.title || item.name || '';
        item.value = item.value != null ? String(item.value) : (item.val != null ? String(item.val) : '');
        item.not_icon = !item.icon;
        item.not_color = !item.color;
        item.color = colorVar(item.color);
      });
      break;

    case 'table':
      b.columns = b.columns || b.headers || b.cols || b.head || [];
      b.rows = b.rows || b.data || b.items || b.values || [];
      b.caption = b.caption || b.title || '';
      b.striped = b.striped !== false; // default true
      break;

    case 'chart-bar':
      _chartIdx++;
      b._id = `cb-${_chartIdx}`;
      b.title = b.title || b.caption || b.header || '';
      b.height = b.height || 300;
      b.horizontal = !!b.horizontal;
      b.not_horizontal = !b.horizontal;
      b.stacked = !!b.stacked;
      b.not_stacked = !b.stacked;
      b._labels_json = JSON.stringify(b.labels || []);
      b._datasets_json = JSON.stringify((b.datasets || []).map(ds => ({
        label: ds.label || ds.name || ds.title || '',
        data: ds.data || ds.values || [],
        _color: colorVar(ds.color),
        borderWidth: 1,
      })));
      break;

    case 'chart-line':
      _chartIdx++;
      b._id = `cl-${_chartIdx}`;
      b.title = b.title || b.caption || b.header || '';
      b.height = b.height || 300;
      b._fill = b.fill ? 'true' : 'false';
      b._tension = b.tension != null ? String(b.tension) : '0.3';
      b._labels_json = JSON.stringify(b.labels || []);
      b._datasets_json = JSON.stringify((b.datasets || []).map(ds => ({
        label: ds.label || ds.name || ds.title || '',
        data: ds.data || ds.values || [],
        _color: colorVar(ds.color),
      })));
      break;

    case 'chart-pie':
      _chartIdx++;
      b._id = `cp-${_chartIdx}`;
      b.title = b.title || b.caption || b.header || '';
      b.height = b.height || 280;
      b.donut = !!b.donut;
      b.not_donut = !b.donut;
      b.data = b.data || b.values || [];
      b._labels_json = JSON.stringify(b.labels || []);
      b._data_json = JSON.stringify(b.data || []);
      break;

    case 'mermaid-diagram':
      b.definition = b.definition || b.code || b.diagram || b.content || b.chart || b.mermaid || '';
      b.caption = b.caption || b.title || '';
      break;

    case 'text-section':
      b.level = b.level || 2;
      b.heading = b.heading || b.title || b.header || '';
      b.body = b.body || b.content || b.text || b.markdown || '';
      b._body_html = b.body ? marked.parse(b.body) : '';
      b.not_heading = !b.heading;
      break;

    case 'alert':
      b.kind = b.kind || b.variant || b.status || b.severity || b.level || b.alert_type || 'info';
      if (b.kind === 'warn') b.kind = 'warning';
      if (b.kind === 'danger' || b.kind === 'critical') b.kind = 'error';
      const icons = { info: 'ℹ️', warning: '⚠️', error: '❌', success: '✅' };
      b._default_icon = icons[b.kind] || 'ℹ️';
      b.icon = b.icon || b._default_icon;
      b.not_icon = !b.icon;
      b.title = b.title || b.heading || b.header || '';
      b.body = b.body || b.text || b.content || b.message || b.description || '';
      b._body_html = b.body ? marked.parse(b.body) : '';
      break;

    case 'code-block':
      b.lang = b.lang || b.language || '';
      b.code = b.code ?? b.content ?? b.text ?? b.source ?? '';
      b.caption = b.caption || b.title || '';
      break;

    case 'image':
      b.src = b.src || b.url || b.path || b.image || '';
      b.caption = b.caption || b.title || '';
      b.alt = b.alt || b.description || b.caption || (b.src ? path.basename(String(b.src)) : 'Image');
      b.align = b.align || 'center';
      b.not_width = !b.width;
      b.not_caption = !b.caption;
      b.zoomable = b.zoomable === true || b.zoom === true || b.lightbox === true || b.fullscreen === true;
      b.not_zoomable = !b.zoomable;
      if (b.src && !b.src.startsWith('http://') && !b.src.startsWith('https://') && !b.src.startsWith('data:')) {
        const localPath = resolvePath(b.src, specDir);
        if (fs.existsSync(localPath)) {
          const ext = path.extname(localPath).slice(1).toLowerCase();
          const mime = ext === 'svg' ? 'image/svg+xml' : (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : (ext === 'webp' ? 'image/webp' : 'image/png'));
          const b64 = fs.readFileSync(localPath).toString('base64');
          b.src = `data:${mime};base64,${b64}`;
        }
      }
      break;

    case 'two-columns': {
      const [lf, rf] = parseRatio(b.ratio);
      b._left_fr = lf;
      b._right_fr = rf;
      // render nested block arrays
      b._left_html  = renderBlockList(b.left  || [], { marked, specDir, blocksDir });
      b._right_html = renderBlockList(b.right || [], { marked, specDir, blocksDir });
      break;
    }

    case 'tabs':
      _tabIdx++;
      b._id = `t-${_tabIdx}`;
      (b.items || []).forEach((item, i) => {
        item.label = item.label || item.title || item.name || '';
        item.blocks = item.blocks || item.content || item.children || [];
        item['@index'] = i;
        item['@first'] = i === 0;
        item.not_first = i !== 0;
        item._blocks_html = renderBlockList(item.blocks || [], { marked, specDir, blocksDir });
      });
      break;

    case 'timeline':
      (b.items || []).forEach(item => {
        item.date = item.date || item.time || item.timestamp || item.period || '';
        item.title = item.title || item.heading || item.header || item.name || item.label || '';
        item.body = item.body || item.text || item.content || item.description || '';
        item.status = item.status || 'pending';
        item._body_html = item.body ? marked.parse(item.body) : '';
        item.not_body = !item.body;
        item.not_date = !item.date;
      });
      break;

    case 'progress-bars':
      (b.items || []).forEach(item => {
        item.label = item.label || item.title || item.name || '';
        item.value = Number(item.value ?? item.percent ?? item.percentage ?? 0);
        const max = item.max || item.total || 100;
        item._max = max;
        item._pct = Math.min(100, Math.round((item.value / max) * 100));
        item.unit = item.unit || item.suffix || '';
        item._color = colorVar(item.color);
        item.show_value = item.show_value !== false;
        item.not_show_value = !item.show_value;
      });
      break;

    case 'list-cards':
      b._cols = b.cols || 3;
      (b.items || []).forEach(item => {
        item.title = item.title || item.heading || item.header || item.name || '';
        item.body = item.body || item.text || item.content || item.description || '';
        item.badge = item.badge || item.tag || item.label || '';
        item.href = item.href || item.url || item.link || '';
        item.not_href = !item.href;
        item.not_icon = !item.icon;
        item.not_badge = !item.badge;
        item.not_body = !item.body;
        item.badge_color = colorVar(item.badge_color);
        item._body_html = item.body ? marked.parse(item.body) : '';
      });
      break;

    case 'badge-row':
      b.align = b.align || '';
      if (Array.isArray(b.items)) {
        b.items = b.items.map(it => (typeof it === 'string' ? { label: it } : it));
      }
      (b.items || []).forEach(item => {
        item.label = item.label || item.text || item.name || item.value || '';
        item.color = colorVar(item.color);
        item.not_color = !item.color;
      });
      break;

    case 'divider':
      b.label = b.label || b.text || b.title || '';
      b.not_label = !b.label;
      break;

    case 'spacer':
      b.size = b.size || b.height || 'sp-5';
      b._size = resolveSize(b.size);
      break;

    case 'raw':
      // html/css/scripts passed through as-is
      break;

    case 'markdown':
    case 'markdown-file':
      // handled separately in renderBlock()
      break;

    default:
      break;
  }

  // Update not_* mirrors after normalization
  Object.keys(b).forEach(k => { b[`not_${k}`] = !b[k]; });

  return b;
}

// ─── Block renderer ───────────────────────────────────────────────────────────

function renderBlock(block, { marked, specDir, blocksDir }) {
  const b = preprocessBlock(block, { marked, specDir, blocksDir });

  // markdown inline
  if (b.type === 'markdown') {
    const html = marked.parse(b.content || '');
    const cls = b.class ? ` ${escapeHtml(b.class)}` : '';
    return `<div class="markdown-body${cls}">\n${html}\n</div>`;
  }

  // markdown from file
  if (b.type === 'markdown-file') {
    const mdPath = resolvePath(b.path, specDir);
    if (!fs.existsSync(mdPath)) {
      throw new Error(`markdown-file not found: ${b.path} (resolved: ${mdPath})`);
    }
    let rawMd = fs.readFileSync(mdPath, 'utf8');
    if (b.strip_frontmatter !== false) rawMd = stripFrontmatter(rawMd);
    const html = marked.parse(rawMd);
    const cls = b.class ? ` ${escapeHtml(b.class)}` : '';
    return `<div class="markdown-body${cls}">\n${html}\n</div>`;
  }

  const templatePath = path.join(blocksDir, `${b.type}.html`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Unknown block type "${b.type}" — template not found: ${templatePath}`);
  }
  const template = fs.readFileSync(templatePath, 'utf8');
  return renderTemplate(template, b);
}

function renderBlockList(blocks, ctx) {
  return blocks.map(b => renderBlock(b, ctx)).join('\n');
}

// ─── CDN script collector ────────────────────────────────────────────────────

function collectCdnNeeds(blocks) {
  const needs = { chartjs: false, mermaid: false, hljs: false };
  function scan(list) {
    (list || []).forEach(b => {
      if (['chart-bar','chart-line','chart-pie'].includes(b.type)) needs.chartjs = true;
      if (b.type === 'mermaid-diagram') needs.mermaid = true;
      if (b.type === 'code-block' && b.lang && b.lang !== 'plaintext') needs.hljs = true;
      if (b.type === 'raw' && b.cdn_scripts) {
        // handled separately
      }
      if (b.type === 'two-columns') { scan(b.left); scan(b.right); }
      if (b.type === 'tabs') (b.items||[]).forEach(t => scan(t.blocks));
    });
  }
  scan(blocks);
  return needs;
}

function collectRawCss(blocks) {
  const css = [];
  function scan(list) {
    (list || []).forEach(b => {
      if (b.type === 'raw' && b.css) css.push(b.css);
      if (b.type === 'two-columns') { scan(b.left); scan(b.right); }
      if (b.type === 'tabs') (b.items||[]).forEach(t => scan(t.blocks));
    });
  }
  scan(blocks);
  return css.join('\n');
}

function collectRawScripts(blocks) {
  const scripts = [];
  function scan(list) {
    (list || []).forEach(b => {
      if (b.type === 'raw' && b.scripts) scripts.push(b.scripts);
      if (b.type === 'two-columns') { scan(b.left); scan(b.right); }
      if (b.type === 'tabs') (b.items||[]).forEach(t => scan(t.blocks));
    });
  }
  scan(blocks);
  return scripts;
}

function collectRawCdnScripts(blocks) {
  const urls = [];
  function scan(list) {
    (list || []).forEach(b => {
      if (b.type === 'raw' && Array.isArray(b.cdn_scripts)) urls.push(...b.cdn_scripts);
      if (b.type === 'two-columns') { scan(b.left); scan(b.right); }
      if (b.type === 'tabs') (b.items||[]).forEach(t => scan(t.blocks));
    });
  }
  scan(blocks);
  return [...new Set(urls)];
}

// ─── HTML skeleton ────────────────────────────────────────────────────────────

function buildHtml({ title, lang, css, headScripts, bodyHtml, bodyScripts, inlineScripts, mermaidInit }) {
  const headScriptTags = headScripts.map(u => `  <script src="${u}"></script>`).join('\n');
  const bodyScriptTags = bodyScripts.map(u => `  <script src="${u}"></script>`).join('\n');
  const inlineScriptTag = inlineScripts.length
    ? `\n<script>\n${inlineScripts.join('\n')}\n</script>`
    : '';
  const mermaidTag = mermaidInit
    ? `\n<script>
(function(){
  function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }
  function renderMermaid(container) {
    if (!window.mermaid) return;
    var scope = container || document;
    var nodes = scope.querySelectorAll('.mermaid:not([data-rendered="true"])');
    nodes.forEach(function(el) {
      if (!isVisible(el)) return;
      var code = el.getAttribute('data-code') || el.textContent;
      var id = 'm-' + Math.random().toString(36).slice(2, 9);
      try {
        mermaid.render(id, code).then(function(res) {
          el.innerHTML = res.svg;
          el.setAttribute('data-rendered', 'true');
        }).catch(function() {
          try { mermaid.run({ nodes: [el] }); } catch(e) {}
        });
      } catch(e) {
        try { mermaid.run({ nodes: [el] }); } catch(e) {}
      }
    });
  }
  if (window.mermaid) {
    var isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function(){ renderMermaid(); });
    } else {
      renderMermaid();
    }
    window.addEventListener('load', function(){ renderMermaid(); });
  }
  window.__renderMermaid = renderMermaid;
}());
</script>`
    : '';

  return `<!doctype html>
<html lang="${escapeHtml(lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title || 'Artifact')}</title>
${headScriptTags ? headScriptTags + '\n' : ''}<style>
${css}
</style>
</head>
<body>
<main>
${bodyHtml}
</main>
${bodyScriptTags ? bodyScriptTags + '\n' : ''}${mermaidTag}${inlineScriptTag}
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const specPath = path.resolve(args._[0]);
  if (!fs.existsSync(specPath)) {
    console.error(`Error: spec file not found: ${specPath}`);
    process.exit(1);
  }

  const { yaml, marked } = await loadDependencies();

  // Load spec
  let spec;
  const rawContent = fs.readFileSync(specPath, 'utf8');
  const isJson = specPath.endsWith('.json') || rawContent.trim().startsWith('{');
  if (isJson) {
    try {
      spec = JSON.parse(rawContent);
    } catch (e) {
      console.error(`Error: JSON parse error in ${specPath}: ${e.message}`);
      process.exit(1);
    }
  } else {
    if (!yaml) {
      console.error(`Error: js-yaml is required to parse YAML files.\nRun: npm install --prefix "${__dirname}"`);
      process.exit(1);
    }
    try {
      spec = yaml.load(rawContent);
    } catch (e) {
      console.error(`Error: YAML parse error in ${specPath}: ${e.message}`);
      process.exit(1);
    }
  }

  const specDir   = path.dirname(specPath);
  const themesDir = args['--themes-dir'] || path.join(__dirname, 'themes');
  const blocksDir = args['--blocks-dir'] || path.join(__dirname, 'blocks');
  const outPath   = path.resolve(args['--out'] || specPath.replace(/\.(ya?ml|json)$/i, '.html'));

  const verbose = !!args['--verbose'];
  if (verbose) console.log('[build] spec:', specPath, '\n[build] out:', outPath);

  // ── Load CSS ──────────────────────────────────────────────────────────────
  const defaultCssPath = path.join(themesDir, 'default.css');
  if (!fs.existsSync(defaultCssPath)) {
    console.error(`Error: themes/default.css not found at ${defaultCssPath}`);
    process.exit(1);
  }
  let css = fs.readFileSync(defaultCssPath, 'utf8');

  const theme = spec.theme || 'default';
  if (theme !== 'default') {
    const themeFile = path.join(themesDir, `${theme}.css`);
    if (fs.existsSync(themeFile)) {
      css += '\n' + fs.readFileSync(themeFile, 'utf8');
    } else {
      console.warn(`[warn] theme file not found: ${themeFile}, using default`);
    }
  }

  // ── Spec Validation & Normalization ───────────────────────────────────────
  const { normalizedSpec, report } = validateAndNormalizeSpec(spec, {
    strict: !!args['--strict'],
    lenient: !!args['--lenient'],
    verbose,
  });
  spec = normalizedSpec;

  if (report.mappedAliases.length > 0) {
    if (verbose) {
      console.log(`ℹ Spec: auto-mapped ${report.mappedAliases.length} model-friendly alias(es):`);
      report.mappedAliases.forEach(m => console.log(`  • ${m}`));
    } else {
      console.log(`ℹ Spec: auto-mapped ${report.mappedAliases.length} model-friendly field alias(es) (use --verbose to view details)`);
    }
  }

  if (report.warnings.length > 0) {
    console.warn(`⚠️ Spec warnings (${report.warnings.length}):`);
    report.warnings.forEach(w => console.warn(`  • ${w}`));
  }

  if (report.errors.length > 0) {
    console.error(`\n❌ Spec validation failed with ${report.errors.length} error${report.errors.length > 1 ? 's' : ''}:`);
    report.errors.forEach(err => console.error(`  • ${err}`));
    if (!args['--lenient']) {
      console.error('\nBuild aborted. Fix the spec issues above, or run with --lenient to force build anyway.\n');
      process.exit(1);
    } else {
      console.warn('\n[warn] --lenient active: proceeding despite validation errors.\n');
    }
  } else if (!spec.source && report.blockCount > 0) {
    if (verbose) {
      console.log(`✓ Spec validated: ${report.blockCount} block(s) ok`);
    }
  }

  // ── Passthrough mode (source: file.md) ───────────────────────────────────
  let bodyHtml, cdnNeeds = {}, rawCss = '', rawScripts = [], rawCdnUrls = [];

  if (spec.source) {
    const srcPath = resolvePath(spec.source, specDir);
    if (!fs.existsSync(srcPath)) {
      console.error(`Error: source file not found: ${srcPath}`);
      process.exit(1);
    }
    let rawMd = fs.readFileSync(srcPath, 'utf8');
    rawMd = stripFrontmatter(rawMd);
    bodyHtml = `<article class="markdown-body">\n${marked.parse(rawMd)}\n</article>`;
    if (verbose) console.log('[build] passthrough mode:', srcPath);
  } else {
    // ── Blocks mode ─────────────────────────────────────────────────────────
    const blocks = spec.blocks || [];
    if (!Array.isArray(blocks)) {
      console.error('Error: spec.blocks must be an array');
      process.exit(1);
    }

    cdnNeeds    = collectCdnNeeds(blocks);
    rawCss      = collectRawCss(blocks);
    rawScripts  = collectRawScripts(blocks);
    rawCdnUrls  = collectRawCdnScripts(blocks);

    try {
      bodyHtml = renderBlockList(blocks, { marked, specDir, blocksDir });
    } catch (e) {
      console.error(`Error rendering blocks: ${e.message}`);
      if (verbose) console.error(e.stack);
      process.exit(1);
    }
  }

  // Append raw CSS from raw blocks
  if (rawCss) css += '\n/* === RAW BLOCK CSS === */\n' + rawCss;

  // hljs dark-mode aware CSS inline (fetch not available in CSP — use inline style override)
  if (cdnNeeds.hljs) {
    css += `\n@media (prefers-color-scheme: dark) { pre code.hljs { background: var(--surface-2); color: var(--fg); } }`;
  }

  // ── Assemble CDN tags ─────────────────────────────────────────────────────
  const headScripts = [];
  const bodyScripts = [];

  // Libraries must load in <head> so globals (Chart, mermaid, hljs) are available before body executes
  if (cdnNeeds.chartjs) headScripts.push(CDN.chartjs);
  if (cdnNeeds.mermaid) headScripts.push(CDN.mermaid);
  if (cdnNeeds.hljs)    headScripts.push(CDN.hljs);
  rawCdnUrls.forEach(u => headScripts.push(u));

  // hljs init (if needed)
  const inlineScripts = [...rawScripts];
  if (cdnNeeds.hljs) {
    inlineScripts.unshift(`document.addEventListener('DOMContentLoaded', function(){ document.querySelectorAll('pre code').forEach(function(el){ hljs.highlightElement(el); }); });`);
  }

  // ── Build HTML ────────────────────────────────────────────────────────────
  const html = buildHtml({
    title: spec.title || 'Artifact',
    lang: spec.lang || 'en',
    css,
    headScripts,
    bodyScripts,
    bodyHtml,
    inlineScripts,
    mermaidInit: cdnNeeds.mermaid,
  });

  fs.writeFileSync(outPath, html, 'utf8');
  const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`✓ Built: ${outPath} (${sizeKb} KB)`);

  // ── Push to Open Artifacts ────────────────────────────────────────────────
  const doPush  = args['--push'] || args['--share'];
  if (doPush) {
    const title    = args['--title'] || spec.title || path.basename(outPath, '.html');
    const orgFlag  = args['--org']      ? `--org "${args['--org']}"` : '';
    const lifeFlag = args['--lifetime'] ? `--lifetime ${args['--lifetime']}` : '';
    const shareFlag = args['--share']   ? '--share' : '';
    const pubFlag   = args['--public']  ? '--public' : '';
    const pwdFlag   = args['--password'] ? `--password "${args['--password']}"` : '';

    const cmd = `oa push "${outPath}" --title "${title.replace(/"/g, '\\"')}" ${orgFlag} ${lifeFlag} ${shareFlag} ${pubFlag} ${pwdFlag}`.replace(/\s+/g, ' ').trim();
    if (verbose) console.log('[push]', cmd);
    try {
      const out = execSync(cmd, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
      console.log(out.trim());
    } catch (e) {
      console.error(`Error: oa push failed — ${e.message}`);
      process.exit(1);
    }
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
