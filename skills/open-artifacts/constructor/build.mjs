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

// ─── Shared helpers (anchors, images, links, buttons, sparklines) ────────────

const TRANSLIT = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',
  р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
};

function slugify(text) {
  const s = String(text ?? '').toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[а-яё]/g, ch => TRANSLIT[ch] ?? '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return s || 'section';
}

// Per-build mutable state: id counters, anchor registry, TOC placeholders. Reset by main().
let STATE = null;
function resetState(spec = {}) {
  STATE = {
    counters: {},
    usedIds: new Set(),
    headings: [],   // { id, text, level, kind: 'heading' | 'block' }
    tocs: [],       // TOC configs, replaced after the whole body is rendered
    runtime: new Set(),
    warnings: [],
    headingLinks: spec.heading_links !== false,
    lang: String(spec.lang || 'en').toLowerCase().slice(0, 2),
  };
}
resetState();

function uid(prefix) {
  STATE.counters[prefix] = (STATE.counters[prefix] || 0) + 1;
  return `${prefix}-${STATE.counters[prefix]}`;
}

function uniqueId(base) {
  let id = slugify(base);
  if (STATE.usedIds.has(id)) {
    let n = 2;
    while (STATE.usedIds.has(`${id}-${n}`)) n++;
    id = `${id}-${n}`;
  }
  STATE.usedIds.add(id);
  return id;
}

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

// Adds ids to <h1>-<h6> in rendered Markdown and registers them for the TOC.
function addHeadingIds(html) {
  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_, lvl, inner) => {
    const text = decodeEntities(inner.replace(/<[^>]*>/g, '')).trim();
    const id = uniqueId(text);
    STATE.headings.push({ id, text, level: Number(lvl), kind: 'heading' });
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });
}

// Child HTML is inserted into parent templates, which are re-scanned for {{...}}.
// Shielding keeps literal braces (e.g. handlebars in a code block) intact.
const shield = s => String(s ?? '').replace(/\{\{/g, '{').replace(/\}\}/g, '}');
const unshield = s => s.replace(/\{/g, '{{').replace(/\}/g, '}}');

function mimeOf(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  return { svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' }[ext] || 'image/png';
}

// Local file → data: URI. Remote URLs, data URIs and anchors pass through.
function resolveImageSrc(src, specDir) {
  if (!src) return '';
  src = String(src);
  if (/^(https?:|data:|blob:|\/\/)/i.test(src)) return src;
  const localPath = resolvePath(src, specDir);
  if (fs.existsSync(localPath)) {
    return `data:${mimeOf(localPath)};base64,${fs.readFileSync(localPath).toString('base64')}`;
  }
  return src;
}

// Rejects javascript:/vbscript:/data: targets in author-supplied links.
function safeHref(href) {
  const h = String(href ?? '').trim();
  if (!h) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(h) && !/^(https?|mailto|tel):/i.test(h)) return '';
  return h;
}

// Links leaving the artifact must open in a new tab: the artifact lives in a sandboxed iframe.
function linkAttrs(href, newTab) {
  const external = /^https?:/i.test(href);
  const blank = newTab === undefined ? external : !!newTab;
  return `href="${escapeHtml(href)}"${blank ? ' target="_blank" rel="noopener noreferrer"' : ''}`;
}

function buttonsHtml(items, { size, align } = {}) {
  const list = (items || []).map(it => (typeof it === 'string' ? { label: it } : it)).filter(Boolean);
  if (!list.length) return '';
  const variants = ['primary', 'secondary', 'ghost', 'link'];
  const inner = list.map((it, i) => {
    const label = it.label || it.text || it.title || it.name || '';
    const href = safeHref(it.href || it.url || it.link || '');
    const variant = variants.includes(it.variant) ? it.variant : (i === 0 ? 'primary' : 'secondary');
    const icon = it.icon ? `<span class="oa-btn__icon" aria-hidden="true">${escapeHtml(it.icon)}</span>` : '';
    const content = `${icon}<span>${escapeHtml(label)}</span>`;
    return href
      ? `<a class="oa-btn oa-btn--${variant}" ${linkAttrs(href, it.new_tab)}>${content}</a>`
      : `<span class="oa-btn oa-btn--${variant} oa-btn--static">${content}</span>`;
  }).join('');
  const cls = ['oa-buttons', size ? `oa-buttons--${size}` : '', align ? `oa-buttons--${align}` : ''].filter(Boolean).join(' ');
  return `<div class="${cls}">${inner}</div>`;
}

function sparklineSvg(values, { w = 96, h = 28 } = {}) {
  const nums = (values || []).map(Number).filter(Number.isFinite);
  if (nums.length < 2) return '';
  const min = Math.min(...nums), max = Math.max(...nums), span = max - min || 1;
  const pad = 2;
  const pts = nums.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (nums.length - 1);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = pts[pts.length - 1].split(',');
  return `<svg class="oa-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">` +
    `<polyline points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<circle cx="${last[0]}" cy="${last[1]}" r="2.5" fill="currentColor"/></svg>`;
}

// "16:9" / "16/9" / 1.5 → CSS aspect-ratio value
function parseAspect(a) {
  if (a == null || a === '') return '';
  const s = String(a).trim();
  const m = /^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$/.exec(s);
  if (m) return `${m[1]} / ${m[2]}`;
  return /^\d+(?:\.\d+)?$/.test(s) ? s : '';
}

function cssLen(v, fallback) {
  if (v == null || v === '') return fallback;
  if (typeof v === 'number') return `${v}px`;
  return resolveSize(String(v));
}

// ─── Block tree ──────────────────────────────────────────────────────────────

// Where nested blocks live. `own`: arrays on the block itself; `items`: arrays inside each item.
const CHILD_SPEC = {
  'two-columns': { own: ['left', 'right'] },
  section: { own: ['blocks'] },
  grid: { own: ['blocks'] },
  stack: { own: ['blocks'] },
  tabs: { items: true },
  accordion: { items: true },
  steps: { items: true },
  slideshow: { items: true },
  cards: { items: true },
};

function childSlots(b) {
  const spec = CHILD_SPEC[b.type];
  if (!spec) return [];
  const slots = [];
  for (const key of spec.own || []) {
    if (Array.isArray(b[key])) slots.push({ obj: b, key, label: key });
  }
  if (spec.items && Array.isArray(b.items)) {
    b.items.forEach((it, i) => {
      if (it && typeof it === 'object' && Array.isArray(it.blocks)) {
        slots.push({ obj: it, key: 'blocks', label: `item "${it.label || it.title || i + 1}"` });
      }
    });
  }
  return slots;
}

function walkBlocks(blocks, visit) {
  (blocks || []).forEach(b => {
    if (!b || typeof b !== 'object') return;
    visit(b);
    childSlots(b).forEach(s => walkBlocks(s.obj[s.key], visit));
  });
}

// Fields every block accepts, rendered onto its root element.
const COMMON_FIELDS = ['id', 'class', 'width', 'spacing', 'hide', 'span', 'row_span', 'toc_label', 'toc_level'];
const WIDTHS = ['narrow', 'normal', 'wide', 'full'];
const HIDES = ['mobile', 'desktop', 'print'];

function rootAttrsFor(b) {
  const cls = [];
  const style = [];
  if (typeof b.width === 'string' && WIDTHS.includes(b.width)) cls.push(`oa-w-${b.width}`);
  const hide = Array.isArray(b.hide) ? b.hide : (b.hide ? [b.hide] : []);
  hide.map(String).filter(h => HIDES.includes(h)).forEach(h => cls.push(`oa-hide-${h}`));
  if (b.class) cls.push(...String(b.class).split(/\s+/).filter(Boolean).map(escapeHtmlClass));
  const sp = b.spacing;
  if (sp && typeof sp === 'object') {
    const top = sp.top ?? sp.mt, bottom = sp.bottom ?? sp.mb;
    if (top != null) style.push(`margin-top:${cssLen(top)}`);
    if (bottom != null) style.push(`margin-bottom:${cssLen(bottom)}`);
  } else if (sp != null && sp !== '') {
    style.push(`margin-top:${cssLen(sp)}`, `margin-bottom:${cssLen(sp)}`);
  }
  if (Number(b.span) > 1) style.push(`--oa-span:${Math.floor(Number(b.span))}`);
  if (Number(b.row_span) > 1) style.push(`grid-row:span ${Math.floor(Number(b.row_span))}`);
  return { id: b.id ? String(b.id) : '', cls, style };
}

function escapeHtmlClass(c) { return String(c).replace(/[^\w\- ]/g, ''); }

// Adds id/class/style to the first real element of a rendered block (no wrapper → existing CSS keeps working).
function injectRootAttrs(html, { id, cls, style }) {
  if (!id && !cls.length && !style.length) return html;
  const m = /<(?!\/|!--|script\b|style\b)([a-zA-Z][\w-]*)((?:\s[^>]*)?)>/.exec(html);
  if (!m) return html;
  let attrs = m[2];
  let prefix = '';
  if (id) {
    if (/\sid\s*=/.test(attrs)) prefix = `<a id="${escapeHtml(id)}" class="oa-anchor" aria-hidden="true"></a>`;
    else attrs += ` id="${escapeHtml(id)}"`;
  }
  if (cls.length) {
    if (/\sclass="/.test(attrs)) attrs = attrs.replace(/\sclass="([^"]*)"/, (_, c) => ` class="${c} ${cls.join(' ')}"`);
    else attrs += ` class="${cls.join(' ')}"`;
  }
  if (style.length) {
    const extra = style.join(';');
    if (/\sstyle="/.test(attrs)) attrs = attrs.replace(/\sstyle="([^"]*)"/, (_, s) => ` style="${s}${s && !s.trim().endsWith(';') ? ';' : ''}${extra}"`);
    else attrs += ` style="${extra}"`;
  }
  return html.slice(0, m.index) + prefix + `<${m[1]}${attrs}>` + html.slice(m.index + m[0].length);
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
  card: 'cards',
  'list-cards': 'cards',
  kpi: 'kpi-row',
  kpis: 'kpi-row',
  stats: 'stats-grid',
  code: 'code-block',
  codeblock: 'code-block',
  diagram: 'mermaid-diagram',
  mermaid: 'mermaid-diagram',
  text: 'text-section',
  progress: 'progress-bars',
  bar: 'chart-bar',
  line: 'chart-line',
  pie: 'chart-pie',
  badges: 'badge-row',
  // containers
  container: 'section',
  wrapper: 'section',
  row: 'stack',
  flex: 'stack',
  // navigation
  contents: 'toc',
  'table-of-contents': 'toc',
  // media
  carousel: 'slideshow',
  slider: 'slideshow',
  slides: 'slideshow',
  'before-after': 'image-compare',
  'image-comparison': 'image-compare',
  // disclosure
  faq: 'accordion',
  collapse: 'accordion',
  collapsible: 'accordion',
  details: 'accordion',
  // content
  howto: 'steps',
  instructions: 'steps',
  testimonial: 'quote',
  pullquote: 'quote',
  blockquote: 'quote',
  comparison: 'compare',
  vs: 'compare',
  matrix: 'feature-matrix',
  features: 'feature-matrix',
  button: 'buttons',
  'cta-row': 'buttons',
  'button-row': 'buttons',
  banner: 'cta',
  video: 'embed',
  glossary: 'definition-list',
  'key-value': 'definition-list',
  facts: 'definition-list',
  dl: 'definition-list',
  todo: 'checklist',
  tasks: 'checklist',
};

// Names that used to mean one thing and now are real blocks: decide by the shape of the data.
function resolveLegacyType(rawType, b) {
  if (rawType === 'grid' && Array.isArray(b.items) && !Array.isArray(b.blocks)) return 'stats-grid';
  if (rawType === 'columns') return Array.isArray(b.blocks) ? 'grid' : 'two-columns';
  if (rawType === 'section' && !Array.isArray(b.blocks) && (b.body || b.content || b.text)) return 'text-section';
  return null;
}

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
    itemCanonical: ['label', 'value', 'delta', 'trend', 'suffix', 'icon', 'color', 'spark', 'class'],
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
    itemCanonical: ['label', 'value', 'icon', 'color', 'spark', 'class'],
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
    canonical: ['type', 'title', 'labels', 'datasets', 'height', 'stacked', 'horizontal', 'monochrome', 'class', 'id'],
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
    canonical: ['type', 'title', 'labels', 'datasets', 'height', 'fill', 'tension', 'y_min', 'y_max', 'monochrome', 'class', 'id'],
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
    canonical: ['type', 'src', 'alt', 'title', 'caption', 'credit', 'link', 'width', 'height', 'aspect', 'fit', 'align',
                'float', 'zoomable', 'rounded', 'border', 'shadow', 'lazy', 'group', 'class', 'id'],
    aliases: {
      url: 'src',
      path: 'src',
      image: 'src',
      description: 'alt',
      heading: 'title',
      source: 'credit',
      href: 'link',
      zoom: 'zoomable',
      lightbox: 'zoomable',
      fullscreen: 'zoomable',
    },
    normalize(b) {
      if (b.src && !b.alt) {
        b.alt = b.caption || b.title || path.basename(String(b.src)) || 'Image';
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
  cards: {
    canonical: ['type', 'items', 'cols', 'variant', 'layout', 'equal_height', 'image_aspect', 'align', 'class', 'id'],
    aliases: {
      cards: 'items',
      list: 'items',
    },
    itemCanonical: ['title', 'subtitle', 'body', 'image', 'image_alt', 'image_position', 'zoomable', 'icon', 'badge',
                    'badge_color', 'tags', 'meta', 'href', 'link_label', 'new_tab', 'buttons', 'footer', 'color', 'blocks'],
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
      img: 'image',
      picture: 'image',
      src: 'image',
      position: 'image_position',
      actions: 'buttons',
    },
    normalize(b) {
      if (b.variant) {
        const v = String(b.variant).toLowerCase();
        b.variant = ({ filled: 'elevated', default: 'elevated', bordered: 'outline', plain: 'flat' })[v] || v;
      }
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.items) || b.items.length === 0) {
        errs.push('cards block requires a non-empty "items" array.');
      }
      if (b.variant && !['elevated', 'outline', 'flat', 'accent'].includes(b.variant)) {
        errs.push(`"variant" must be one of: elevated, outline, flat, accent (got "${b.variant}").`);
      }
      if (b.layout && !['grid', 'list', 'scroll'].includes(b.layout)) {
        errs.push(`"layout" must be one of: grid, list, scroll (got "${b.layout}").`);
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
  // ── containers ──
  section: {
    canonical: ['type', 'title', 'subtitle', 'eyebrow', 'level', 'blocks', 'background', 'padding', 'border', 'align', 'class', 'id'],
    aliases: {
      heading: 'title',
      header: 'title',
      items: 'blocks',
      children: 'blocks',
      content: 'blocks',
      bg: 'background',
      description: 'subtitle',
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.blocks) || b.blocks.length === 0) {
        errs.push('section block requires a non-empty "blocks" array.');
      }
      return errs;
    }
  },
  grid: {
    canonical: ['type', 'blocks', 'cols', 'min', 'gap', 'align', 'cols_mobile', 'class', 'id'],
    aliases: {
      items: 'blocks',
      children: 'blocks',
      content: 'blocks',
      columns: 'cols',
      min_width: 'min',
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.blocks) || b.blocks.length === 0) {
        errs.push('grid block requires a non-empty "blocks" array.');
      }
      return errs;
    }
  },
  stack: {
    canonical: ['type', 'blocks', 'direction', 'gap', 'align', 'justify', 'wrap', 'fill', 'class', 'id'],
    aliases: {
      items: 'blocks',
      children: 'blocks',
      content: 'blocks',
      dir: 'direction',
      orientation: 'direction',
    },
    normalize(b) {
      if (b.direction) {
        const d = String(b.direction).toLowerCase();
        if (['horizontal', 'h', 'inline'].includes(d)) b.direction = 'row';
        else if (['vertical', 'v', 'block'].includes(d)) b.direction = 'column';
      }
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.blocks) || b.blocks.length === 0) {
        errs.push('stack block requires a non-empty "blocks" array.');
      }
      if (b.direction && !['row', 'column'].includes(b.direction)) {
        errs.push(`"direction" must be row or column (got "${b.direction}").`);
      }
      return errs;
    }
  },
  // ── navigation ──
  anchor: {
    canonical: ['type', 'id', 'label', 'class'],
    aliases: { name: 'id', target: 'id', text: 'label' },
    validate(b) {
      const errs = [];
      if (!b.id || !String(b.id).trim()) errs.push('anchor block requires "id".');
      return errs;
    }
  },
  toc: {
    canonical: ['type', 'title', 'depth', 'min_level', 'numbered', 'variant', 'include', 'class', 'id'],
    aliases: {
      heading: 'title',
      levels: 'depth',
      max_level: 'depth',
      numbering: 'numbered',
      position: 'variant',
      mode: 'variant',
    },
    validate(b) {
      const errs = [];
      if (b.variant && !['inline', 'sticky', 'sidebar'].includes(b.variant)) {
        errs.push(`"variant" must be one of: inline, sticky, sidebar (got "${b.variant}").`);
      }
      if (b.include && !['headings', 'blocks', 'both'].includes(b.include)) {
        errs.push(`"include" must be one of: headings, blocks, both (got "${b.include}").`);
      }
      return errs;
    }
  },
  // ── media ──
  gallery: {
    canonical: ['type', 'items', 'layout', 'cols', 'aspect', 'gap', 'captions', 'zoomable', 'max_visible', 'fit', 'class', 'id'],
    aliases: {
      images: 'items',
      photos: 'items',
      pictures: 'items',
      columns: 'cols',
      zoom: 'zoomable',
      lightbox: 'zoomable',
      limit: 'max_visible',
    },
    itemCanonical: ['src', 'alt', 'title', 'caption', 'link'],
    itemAliases: {
      url: 'src',
      path: 'src',
      image: 'src',
      description: 'alt',
      heading: 'title',
      href: 'link',
    },
    normalize(b) {
      if (Array.isArray(b.items)) b.items = b.items.map(it => (typeof it === 'string' ? { src: it } : it));
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.items) || b.items.length === 0) {
        errs.push('gallery block requires a non-empty "items" array.');
      } else {
        b.items.forEach((it, i) => {
          if (!it || !(it.src || it.url || it.path || it.image)) errs.push(`gallery item #${i + 1} requires "src".`);
        });
      }
      if (b.layout && !['grid', 'masonry', 'strip'].includes(b.layout)) {
        errs.push(`"layout" must be one of: grid, masonry, strip (got "${b.layout}").`);
      }
      if (b.captions && !['below', 'overlay', 'hover', 'none'].includes(b.captions)) {
        errs.push(`"captions" must be one of: below, overlay, hover, none (got "${b.captions}").`);
      }
      return errs;
    }
  },
  slideshow: {
    canonical: ['type', 'items', 'effect', 'nav', 'arrows', 'autoplay', 'loop', 'per_view', 'aspect', 'fit', 'captions',
                'zoomable', 'label', 'class', 'id'],
    aliases: {
      slides: 'items',
      images: 'items',
      zoom: 'zoomable',
      lightbox: 'zoomable',
      transition: 'effect',
      interval: 'autoplay',
      aria_label: 'label',
    },
    itemCanonical: ['src', 'alt', 'title', 'caption', 'blocks'],
    itemAliases: {
      url: 'src',
      path: 'src',
      image: 'src',
      description: 'alt',
      heading: 'title',
      content: 'blocks',
      children: 'blocks',
    },
    normalize(b) {
      if (Array.isArray(b.items)) b.items = b.items.map(it => (typeof it === 'string' ? { src: it } : it));
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.items) || b.items.length === 0) {
        errs.push('slideshow block requires a non-empty "items" array.');
      } else {
        b.items.forEach((it, i) => {
          if (it && !(it.src || it.url || it.path || it.image) && !Array.isArray(it.blocks)) {
            errs.push(`slideshow item #${i + 1} requires "src" (image) or "blocks".`);
          }
        });
      }
      if (b.effect && !['slide', 'fade'].includes(b.effect)) errs.push(`"effect" must be slide or fade (got "${b.effect}").`);
      if (b.nav && !['dots', 'thumbs', 'counter', 'none'].includes(b.nav)) {
        errs.push(`"nav" must be one of: dots, thumbs, counter, none (got "${b.nav}").`);
      }
      return errs;
    }
  },
  'image-compare': {
    canonical: ['type', 'before', 'after', 'before_label', 'after_label', 'start', 'aspect', 'caption', 'class', 'id'],
    aliases: {
      left: 'before',
      right: 'after',
      old: 'before',
      new: 'after',
      image_before: 'before',
      image_after: 'after',
      title: 'caption',
    },
    validate(b) {
      const errs = [];
      if (!b.before || !b.after) errs.push('image-compare requires both "before" and "after" images.');
      return errs;
    }
  },
  // ── disclosure / content ──
  accordion: {
    canonical: ['type', 'items', 'multiple', 'single', 'default_open', 'variant', 'class', 'id'],
    aliases: {
      sections: 'items',
      questions: 'items',
      panels: 'items',
      exclusive: 'single',
    },
    itemCanonical: ['title', 'body', 'blocks', 'open', 'icon', 'badge'],
    itemAliases: {
      question: 'title',
      label: 'title',
      heading: 'title',
      header: 'title',
      name: 'title',
      answer: 'body',
      text: 'body',
      content: 'body',
      description: 'body',
      expanded: 'open',
      children: 'blocks',
    },
    normalize(b) {
      if (b.single === true && b.multiple === undefined) b.multiple = false;
      delete b.single;
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.items) || b.items.length === 0) {
        errs.push('accordion block requires a non-empty "items" array.');
      }
      if (b.default_open && !['first', 'all', 'none'].includes(b.default_open)) {
        errs.push(`"default_open" must be one of: first, all, none (got "${b.default_open}").`);
      }
      if (b.variant && !['bordered', 'separated', 'minimal'].includes(b.variant)) {
        errs.push(`"variant" must be one of: bordered, separated, minimal (got "${b.variant}").`);
      }
      return errs;
    }
  },
  steps: {
    canonical: ['type', 'items', 'variant', 'numbered', 'class', 'id'],
    aliases: { stages: 'items', list: 'items', numbering: 'numbered' },
    itemCanonical: ['title', 'body', 'blocks', 'status'],
    itemAliases: {
      heading: 'title',
      header: 'title',
      name: 'title',
      label: 'title',
      text: 'body',
      content: 'body',
      description: 'body',
      children: 'blocks',
    },
    normalizeItem(it) {
      if (it && it.status) {
        const s = String(it.status).toLowerCase();
        if (['completed', 'finished', 'complete'].includes(s)) it.status = 'done';
        else if (['in_progress', 'current', 'running', 'progress'].includes(s)) it.status = 'active';
        else if (['todo', 'waiting', 'queue', 'planned'].includes(s)) it.status = 'pending';
      }
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.items) || b.items.length === 0) errs.push('steps block requires a non-empty "items" array.');
      if (b.variant && !['vertical', 'horizontal'].includes(b.variant)) {
        errs.push(`"variant" must be vertical or horizontal (got "${b.variant}").`);
      }
      return errs;
    }
  },
  quote: {
    canonical: ['type', 'text', 'author', 'role', 'avatar', 'source', 'href', 'variant', 'class', 'id'],
    aliases: {
      quote: 'text',
      body: 'text',
      content: 'text',
      message: 'text',
      name: 'author',
      by: 'author',
      position: 'role',
      title: 'role',
      company: 'role',
      photo: 'avatar',
      image: 'avatar',
      url: 'href',
      link: 'href',
    },
    validate(b) {
      const errs = [];
      if (!b.text || !String(b.text).trim()) errs.push('quote block requires non-empty "text" (or "quote").');
      if (b.variant && !['plain', 'card', 'large'].includes(b.variant)) {
        errs.push(`"variant" must be one of: plain, card, large (got "${b.variant}").`);
      }
      return errs;
    }
  },
  compare: {
    canonical: ['type', 'variant', 'left', 'right', 'class', 'id'],
    aliases: { a: 'left', b: 'right', before: 'left', after: 'right', pros: 'left', cons: 'right' },
    validate(b) {
      const errs = [];
      if (!b.left || !b.right || typeof b.left !== 'object' || typeof b.right !== 'object') {
        errs.push('compare block requires "left" and "right" objects (title, items / body).');
      }
      if (b.variant && !['vs', 'pros-cons', 'before-after'].includes(b.variant)) {
        errs.push(`"variant" must be one of: vs, pros-cons, before-after (got "${b.variant}").`);
      }
      return errs;
    }
  },
  'feature-matrix': {
    canonical: ['type', 'columns', 'rows', 'highlight_col', 'note', 'caption', 'class', 'id'],
    aliases: {
      plans: 'columns',
      products: 'columns',
      headers: 'columns',
      features: 'rows',
      data: 'rows',
      highlight: 'highlight_col',
      title: 'caption',
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.columns) || b.columns.length === 0) errs.push('feature-matrix requires a non-empty "columns" array.');
      if (!Array.isArray(b.rows) || b.rows.length === 0) errs.push('feature-matrix requires a non-empty "rows" array.');
      return errs;
    }
  },
  buttons: {
    canonical: ['type', 'items', 'align', 'size', 'class', 'id'],
    aliases: { links: 'items', actions: 'items', buttons: 'items' },
    itemCanonical: ['label', 'href', 'variant', 'icon', 'new_tab'],
    itemAliases: { text: 'label', title: 'label', name: 'label', url: 'href', link: 'href', style: 'variant' },
    normalize(b) {
      if (Array.isArray(b.items)) b.items = b.items.map(it => (typeof it === 'string' ? { label: it } : it));
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.items) || b.items.length === 0) errs.push('buttons block requires a non-empty "items" array.');
      return errs;
    }
  },
  cta: {
    canonical: ['type', 'title', 'body', 'buttons', 'background', 'align', 'class', 'id'],
    aliases: {
      heading: 'title',
      header: 'title',
      text: 'body',
      content: 'body',
      description: 'body',
      subtitle: 'body',
      actions: 'buttons',
      items: 'buttons',
      bg: 'background',
    },
    validate(b) {
      const errs = [];
      if (!b.title || !String(b.title).trim()) errs.push('cta block requires non-empty "title".');
      return errs;
    }
  },
  embed: {
    canonical: ['type', 'kind', 'src', 'title', 'caption', 'poster', 'thumbnail', 'provider', 'autoplay', 'loop', 'muted', 'aspect', 'class', 'id'],
    aliases: { url: 'src', href: 'src', link: 'src', video: 'src', description: 'caption', cover: 'poster', image: 'thumbnail' },
    validate(b) {
      const errs = [];
      if (!b.src || !String(b.src).trim()) errs.push('embed block requires "src" (video file URL or page URL).');
      if (b.kind && !['video', 'link'].includes(b.kind)) errs.push(`"kind" must be video or link (got "${b.kind}").`);
      return errs;
    },
    warn(b) {
      const w = [];
      const kind = embedKind(b);
      const src = String(b.src || '');
      if (kind === 'video' && /^https?:/i.test(src) && !/\/af\//.test(src)) {
        w.push('embed video from a third-party host will be blocked by the viewer CSP (media-src allows only this instance\'s /af/ files). Use kind: link instead, or upload the video as an artifact file.');
      }
      if (kind === 'video' && src && !/^https?:/i.test(src) && !src.startsWith('/')) {
        w.push('embed video needs a URL: local video files are not inlined. Upload the file and use its /af/ URL.');
      }
      return w;
    }
  },
  'definition-list': {
    canonical: ['type', 'items', 'layout', 'class', 'id'],
    aliases: { terms: 'items', entries: 'items', pairs: 'items', list: 'items', data: 'items' },
    itemCanonical: ['term', 'definition'],
    itemAliases: {
      key: 'term',
      name: 'term',
      label: 'term',
      title: 'term',
      value: 'definition',
      description: 'definition',
      body: 'definition',
      text: 'definition',
    },
    normalize(b) {
      // { Term: "Definition" } → [{ term, definition }]
      if (b.items && typeof b.items === 'object' && !Array.isArray(b.items)) {
        b.items = Object.entries(b.items).map(([term, definition]) => ({ term, definition }));
      }
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.items) || b.items.length === 0) errs.push('definition-list requires a non-empty "items" array (or a key: value mapping).');
      if (b.layout && !['stacked', 'inline', 'grid'].includes(b.layout)) {
        errs.push(`"layout" must be one of: stacked, inline, grid (got "${b.layout}").`);
      }
      return errs;
    }
  },
  checklist: {
    canonical: ['type', 'items', 'summary', 'title', 'class', 'id'],
    aliases: { tasks: 'items', todos: 'items', list: 'items', progress: 'summary', heading: 'title' },
    itemCanonical: ['label', 'status', 'checked', 'note'],
    itemAliases: { text: 'label', title: 'label', name: 'label', task: 'label', done: 'checked', description: 'note', comment: 'note' },
    normalize(b) {
      if (Array.isArray(b.items)) {
        b.items = b.items.map(it => {
          if (typeof it !== 'string') return it;
          const m = /^\[( |x|X)\]\s+(.*)$/.exec(it);
          return m ? { label: m[2], checked: m[1] !== ' ' } : { label: it };
        });
      }
    },
    normalizeItem(it) {
      if (it && it.status) {
        const s = String(it.status).toLowerCase();
        if (['complete', 'completed', 'finished', 'ok', 'yes'].includes(s)) it.status = 'done';
        else if (['open', 'pending', 'planned', 'no'].includes(s)) it.status = 'todo';
        else if (['stuck', 'blocker'].includes(s)) it.status = 'blocked';
        else if (['skipped', 'na', 'n/a'].includes(s)) it.status = 'skip';
      }
    },
    validate(b) {
      const errs = [];
      if (!Array.isArray(b.items) || b.items.length === 0) errs.push('checklist block requires a non-empty "items" array.');
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
  const legacyType = resolveLegacyType(rawType, b);
  if (legacyType) {
    report.mappedAliases.push(`${loc}: auto-mapped block type "${rawType}" → "${legacyType}"`);
    b.type = legacyType;
  } else if (BLOCK_TYPE_ALIASES[rawType]) {
    const targetType = BLOCK_TYPE_ALIASES[rawType];
    // list-cards is the original name of cards: not worth a notice
    if (rawType !== 'list-cards') report.mappedAliases.push(`${loc}: auto-mapped block type "${rawType}" → "${targetType}"`);
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
  const canonicalList = [...new Set([...(def.canonical || []), ...COMMON_FIELDS])];
  const canonical = new Set(canonicalList);
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
      const msg = `${loc} (${b.type}): Unknown property "${key}".${sugText} (Allowed: ${canonicalList.join(', ')})`;
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

  // 5. Nested blocks (containers, tabs, accordion, cards, ...)
  childSlots(b).forEach(({ obj, key, label }) => {
    obj[key] = obj[key].map((child, i) =>
      normalizeAndValidateBlock(child, i, `${loc} (${label}) → `, options, report)
    );
  });

  // Common fields
  const hideVals = Array.isArray(b.hide) ? b.hide : (b.hide ? [b.hide] : []);
  hideVals.forEach(h => {
    if (!HIDES.includes(String(h))) report.errors.push(`${loc} (${b.type}): "hide" must be one of: ${HIDES.join(', ')} (got "${h}").`);
  });
  if (b.type !== 'image' && b.type !== 'accordion' && b.width !== undefined && !WIDTHS.includes(String(b.width))) {
    report.errors.push(`${loc} (${b.type}): "width" must be one of: ${WIDTHS.join(', ')} (got "${b.width}").`);
  }
  if (b.id !== undefined && !/^[A-Za-z][\w:.-]*$/.test(String(b.id))) {
    report.errors.push(`${loc} (${b.type}): "id" must start with a letter and contain only letters, digits, "-", "_", ":" or "." (got "${b.id}").`);
  }

  if (def.warn) {
    (def.warn(b) || []).forEach(w => report.warnings.push(`${loc} (${b.type}): ${w}`));
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

function preprocessBlock(block, ctx) {
  const { marked, specDir } = ctx;
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
        item._spark_svg = shield(sparklineSvg(item.spark));
        item._spark_color = item.color ? colorVar(item.color) : ({ up: 'pos', down: 'neg' })[item.trend] || 'accent';
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
        item._spark_svg = shield(sparklineSvg(item.spark));
      });
      break;

    case 'table':
      b.columns = b.columns || b.headers || b.cols || b.head || [];
      b.rows = b.rows || b.data || b.items || b.values || [];
      b.caption = b.caption || b.title || '';
      b.striped = b.striped !== false; // default true
      break;

    case 'chart-bar':
      b._id = uid('cb');
      b.title = b.title || b.caption || b.header || '';
      b.height = b.height || 300;
      b.horizontal = !!b.horizontal;
      b.not_horizontal = !b.horizontal;
      b.stacked = !!b.stacked;
      b.not_stacked = !b.stacked;
      // A single series is painted bar by bar from the palette unless told otherwise.
      b._vary = (b.monochrome || b.colorful === false) ? 'false' : 'true';
      b._labels_json = JSON.stringify(b.labels || []);
      b._datasets_json = JSON.stringify((b.datasets || []).map(ds => ({
        label: ds.label || ds.name || ds.title || '',
        data: ds.data || ds.values || [],
        // empty = no explicit colour, so the template walks the palette (a missing colour must not collapse every series to the accent)
        _color: ds.color ? colorVar(ds.color) : '',
        borderWidth: 1,
      })));
      break;

    case 'chart-line':
      b._id = uid('cl');
      b.title = b.title || b.caption || b.header || '';
      b.height = b.height || 300;
      b._fill = b.fill ? 'true' : 'false';
      b._vary = (b.monochrome || b.colorful === false) ? 'false' : 'true';
      b._tension = b.tension != null ? String(b.tension) : '0.3';
      b._labels_json = JSON.stringify(b.labels || []);
      b._datasets_json = JSON.stringify((b.datasets || []).map(ds => ({
        label: ds.label || ds.name || ds.title || '',
        data: ds.data || ds.values || [],
        // empty = no explicit colour, so the template walks the palette (a missing colour must not collapse every series to the accent)
        _color: ds.color ? colorVar(ds.color) : '',
      })));
      break;

    case 'chart-pie':
      b._id = uid('cp');
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
      b._body_html = b.body ? mdb(marked, b.body) : '';
      b.not_heading = !b.heading;
      break;

    case 'alert':
      b.kind = b.kind || b.variant || b.status || b.severity || b.level || b.alert_type || 'info';
      if (b.kind === 'warn') b.kind = 'warning';
      if (b.kind === 'danger' || b.kind === 'critical') b.kind = 'error';
      const icons = { info: 'i', warning: '!', error: '×', success: 'OK' };
      b._default_icon = icons[b.kind] || 'i';
      b.icon = b.icon || b._default_icon;
      b.not_icon = !b.icon;
      b.title = b.title || b.heading || b.header || '';
      b.body = b.body || b.text || b.content || b.message || b.description || '';
      b._body_html = b.body ? mdb(marked, b.body) : '';
      break;

    case 'code-block':
      b.lang = b.lang || b.language || '';
      b.code = b.code ?? b.content ?? b.text ?? b.source ?? '';
      b.caption = b.caption || b.title || '';
      break;

    case 'image': {
      b.src = b.src || b.url || b.path || b.image || '';
      b.caption = b.caption || '';
      b.alt = b.alt || b.description || b.caption || b.title || (b.src ? path.basename(String(b.src)) : 'Image');
      b.align = ['left', 'right', 'center'].includes(b.align) ? b.align : 'center';
      b.zoomable = b.zoomable === true || b.zoom === true || b.lightbox === true || b.fullscreen === true;
      b.src = resolveImageSrc(b.src, specDir);
      b._caption_html = b.caption ? shield(inlineMd(marked, b.caption)) : '';
      b._href = safeHref(b.link || b.href || '');
      b._link_attrs = b._href ? linkAttrs(b._href) : '';
      b._group = b.group ? String(b.group) : '';
      b._has_cap = !!(b.caption || b.credit);
      b._cap_text = [b.title, b.caption].filter(Boolean).join(' — ');
      b._loading = b.lazy === false ? 'eager' : 'lazy';
      const fit = b.fit === 'contain' ? 'contain' : 'cover';
      const aspect = parseAspect(b.aspect);
      const imgStyle = [];
      const rootStyle = [];
      if (b.width) { imgStyle.push(`width:${b.width}`, 'max-width:100%'); rootStyle.push(`max-width:${b.width}`); }
      if (aspect || b.height) {
        if (!b.width) imgStyle.push('width:100%');
        if (aspect) imgStyle.push(`aspect-ratio:${aspect}`);
        if (b.height) imgStyle.push(`height:${cssLen(b.height)}`);
        imgStyle.push(`object-fit:${fit}`);
      }
      const float = ['left', 'right'].includes(b.float) ? b.float : '';
      if (float && !b.width) rootStyle.push('width:45%');
      b._img_style = imgStyle.join(';');
      b._root_style = rootStyle.join(';');
      b._cls = [
        `image-block--${b.align}`,
        b.zoomable ? 'image-block--zoomable' : '',
        float ? `image-block--float-${float}` : '',
        b.border ? 'image-block--framed' : '',
        b.shadow ? 'image-block--shadow' : '',
        b.rounded === false ? 'image-block--square' : '',
      ].filter(Boolean).join(' ');
      break;
    }

    case 'two-columns': {
      const [lf, rf] = parseRatio(b.ratio);
      b._left_fr = lf;
      b._right_fr = rf;
      // render nested block arrays
      b._left_html  = renderKids(b.left  || [], ctx);
      b._right_html = renderKids(b.right || [], ctx);
      break;
    }

    case 'tabs':
      b._id = uid('t');
      (b.items || []).forEach((item, i) => {
        item.label = item.label || item.title || item.name || '';
        item.blocks = item.blocks || item.content || item.children || [];
        item['@index'] = i;
        item['@first'] = i === 0;
        item.not_first = i !== 0;
        item._blocks_html = renderKids(item.blocks || [], ctx);
      });
      break;

    case 'timeline':
      (b.items || []).forEach(item => {
        item.date = item.date || item.time || item.timestamp || item.period || '';
        item.title = item.title || item.heading || item.header || item.name || item.label || '';
        item.body = item.body || item.text || item.content || item.description || '';
        item.status = item.status || 'pending';
        item._body_html = item.body ? mdb(marked, item.body) : '';
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

    // ── containers ──
    case 'section': {
      b.level = Math.min(6, Math.max(1, Number(b.level) || 2));
      b._level = b.level;
      const bg = String(b.background || 'none');
      const style = [];
      if (['none', 'surface', 'accent-soft', 'gradient'].includes(bg)) {
        b._bg = bg;
      } else {
        b._bg = 'image';
        const img = resolveImageSrc(bg, specDir).replace(/'/g, '%27');
        style.push(`background-image:url('${img}')`);
      }
      if (b.padding != null && b.padding !== '') style.push(`padding:${cssLen(b.padding)}`);
      b._style = style.join(';');
      b._align = ['center', 'right'].includes(b.align) ? ` oa-section--${b.align}` : '';
      b._border = b.border ? ' oa-section--bordered' : '';
      b._has_head = !!(b.title || b.subtitle || b.eyebrow);
      b._blocks_html = renderKids(b.blocks || [], ctx);
      break;
    }

    case 'grid': {
      const colsRaw = b.cols == null || b.cols === '' ? 'auto' : String(b.cols).trim();
      const min = cssLen(b.min, '240px');
      let cols;
      if (/^\d+$/.test(colsRaw)) cols = `repeat(${colsRaw}, minmax(0, 1fr))`;
      else if (colsRaw === 'auto') cols = `repeat(auto-fit, minmax(min(100%, ${min}), 1fr))`;
      else cols = colsRaw.split(/\s+/).map(t => (/^\d+$/.test(t) ? `${t}fr` : t)).join(' ');
      const style = [`--oa-cols:${cols}`, `--oa-cols-m:${Math.max(1, Number(b.cols_mobile) || 1)}`];
      if (b.gap != null && b.gap !== '') style.push(`--oa-gap:${cssLen(b.gap)}`);
      if (['start', 'center', 'end', 'stretch'].includes(b.align)) style.push(`--oa-align:${b.align}`);
      b._style = style.join(';');
      b._blocks_html = renderKids(b.blocks || [], ctx);
      break;
    }

    case 'stack': {
      b.direction = b.direction || 'column';
      const style = [];
      if (b.gap != null && b.gap !== '') style.push(`--oa-gap:${cssLen(b.gap)}`);
      const al = { start: 'flex-start', end: 'flex-end', center: 'center', stretch: 'stretch', baseline: 'baseline' }[b.align];
      const jf = { start: 'flex-start', end: 'flex-end', center: 'center', between: 'space-between', around: 'space-around' }[b.justify];
      if (al) style.push(`align-items:${al}`);
      if (jf) style.push(`justify-content:${jf}`);
      b._style = style.join(';');
      b._cls = [
        `oa-stack--${b.direction}`,
        b.wrap === false ? 'oa-stack--nowrap' : 'oa-stack--wrap',
        b.fill ? 'oa-stack--fill' : '',
      ].filter(Boolean).join(' ');
      b._blocks_html = renderKids(b.blocks || [], ctx);
      break;
    }

    // ── navigation ──
    case 'anchor':
      break;

    case 'toc': {
      b.variant = b.variant || 'inline';
      if (b.title === undefined) b.title = STATE.lang === 'ru' ? 'Содержание' : 'Contents';
      b._n = STATE.tocs.length;
      STATE.tocs.push({
        variant: b.variant,
        include: b.include || 'headings',
        minLevel: Number(b.min_level) || 2,
        depth: Number(b.depth) || 3,
        numbered: b.numbered === true,
      });
      b._label = b.title || (STATE.lang === 'ru' ? 'Содержание' : 'Contents');
      break;
    }

    // ── media ──
    case 'gallery': {
      b.layout = b.layout || 'grid';
      b.cols = Math.max(1, Number(b.cols) || 3);
      b.captions = b.captions || 'below';
      b.zoomable = b.zoomable !== false;
      b._group = uid('gal');
      const aspect = parseAspect(b.aspect) || (b.layout === 'masonry' ? '' : '4 / 3');
      const style = [`--oa-cols:${b.cols}`];
      if (b.gap != null && b.gap !== '') style.push(`--oa-gap:${cssLen(b.gap)}`);
      if (aspect) style.push(`--oa-aspect:${aspect}`);
      if (b.fit === 'contain') style.push('--oa-fit:contain');
      b._style = style.join(';');
      const items = b.items || [];
      const limit = Number(b.max_visible) > 0 && Number(b.max_visible) < items.length ? Number(b.max_visible) : Infinity;
      items.forEach((item, i) => {
        item.src = resolveImageSrc(item.src || item.url || item.path || item.image, specDir);
        item.alt = item.alt || item.description || item.title || item.caption || '';
        item._cap_text = [item.title, item.caption].filter(Boolean).join(' — ');
        item.not_cap = !(item.title || item.caption);
        item._hidden = i >= limit;
        item._more = limit !== Infinity && i === limit - 1;
        item._more_n = items.length - limit;
        const href = !b.zoomable ? safeHref(item.link || item.href || '') : '';
        item._href = href;
        item._link_attrs = href ? linkAttrs(href) : '';
      });
      b._cls = `oa-gallery--${b.layout} oa-gallery--cap-${b.captions}`;
      break;
    }

    case 'slideshow': {
      b.effect = b.effect || 'slide';
      b.nav = b.nav || 'dots';
      b.captions = b.captions || 'overlay';
      b.zoomable = b.zoomable === true;
      b._arrows = b.arrows === false ? 'false' : 'true';
      b._autoplay = b.autoplay === true ? 5000 : (Number(b.autoplay) > 0 ? Number(b.autoplay) : 0);
      b._loop = b.loop === false ? 'false' : 'true';
      b._per_view = b.effect === 'fade' ? 1 : Math.min(4, Math.max(1, Number(b.per_view) || 1));
      b._group = uid('ss');
      b._label = b.label || (STATE.lang === 'ru' ? 'Слайдшоу' : 'Slideshow');
      const items = b.items || [];
      const imagesOnly = items.every(it => (it.src || it.url || it.path || it.image) && !Array.isArray(it.blocks));
      const aspect = parseAspect(b.aspect) || (imagesOnly ? '16 / 9' : '');
      const style = [`--oa-per-view:${b._per_view}`];
      if (aspect) style.push(`--oa-aspect:${aspect}`);
      if (b.fit === 'contain') style.push('--oa-fit:contain');
      b._style = style.join(';');
      b._total = items.length;
      items.forEach((item, i) => {
        item.src = resolveImageSrc(item.src || item.url || item.path || item.image, specDir);
        item.alt = item.alt || item.description || item.title || item.caption || '';
        item.blocks = item.blocks || item.content || item.children || [];
        item._blocks_html = item.blocks.length ? renderKids(item.blocks, ctx) : '';
        item._n = i + 1;
        item._cap_text = [item.title, item.caption].filter(Boolean).join(' — ');
        item.not_cap = !(item.title || item.caption);
        item._caption_html = item.caption ? shield(inlineMd(marked, item.caption)) : '';
      });
      break;
    }

    case 'image-compare': {
      b.before = resolveImageSrc(b.before, specDir);
      b.after = resolveImageSrc(b.after, specDir);
      const start = Number(b.start);
      b._start = Number.isFinite(start) ? Math.min(100, Math.max(0, start)) : 50;
      b._aspect = parseAspect(b.aspect) || '16 / 9';
      const ru = STATE.lang === 'ru';
      b.before_label = b.before_label ?? (ru ? 'До' : 'Before');
      b.after_label = b.after_label ?? (ru ? 'После' : 'After');
      b._label = [b.before_label, b.after_label].filter(Boolean).join(' / ') || 'Comparison';
      b._caption_html = b.caption ? shield(inlineMd(marked, b.caption)) : '';
      break;
    }

    // ── cards / accordion / steps ──
    case 'cards': {
      b._cols = Math.max(1, Number(b.cols) || 3);
      b.variant = b.variant || 'elevated';
      b.layout = b.layout || 'grid';
      const style = [`--oa-cols:${b._cols}`];
      const ia = parseAspect(b.image_aspect);
      if (ia) style.push(`--oa-aspect:${ia}`);
      if (['center', 'right'].includes(b.align)) style.push(`text-align:${b.align}`);
      b._style = style.join(';');
      b._cls = [`oa-cards--${b.variant}`, `oa-cards--${b.layout}`, b.equal_height ? 'oa-cards--equal' : ''].filter(Boolean).join(' ');
      (b.items || []).forEach(item => {
        item.title = item.title || item.heading || item.header || item.name || '';
        item.body = item.body || item.text || item.content || item.description || '';
        item.badge = item.badge || item.tag || item.label || '';
        item.badge_color = colorVar(item.badge_color);
        const href = safeHref(item.href || item.url || item.link || '');
        const buttons = Array.isArray(item.buttons) ? item.buttons : [];
        const blocks = Array.isArray(item.blocks) ? item.blocks : [];
        item._body_html = item.body ? mdb(marked, item.body) : '';
        item._blocks_html = blocks.length ? renderKids(blocks, ctx) : '';
        item._buttons_html = buttons.length ? shield(buttonsHtml(buttons)) : '';
        item._whole = !!href && !item.link_label && !buttons.length && !blocks.length;
        item._tag = item._whole ? 'a' : 'div';
        item._attrs = item._whole ? linkAttrs(href, item.new_tab) : '';
        item._link_html = href && !item._whole
          ? `<a class="oa-card__link" ${linkAttrs(href, item.new_tab)}>${escapeHtml(item.link_label || (STATE.lang === 'ru' ? 'Подробнее' : 'Open'))}</a>`
          : '';
        item._image = resolveImageSrc(item.image, specDir);
        item._alt = item.image_alt || item.title || '';
        const pos = ['top', 'left', 'background'].includes(item.image_position) ? item.image_position : 'top';
        item._cls = [
          item._image ? `oa-card--img-${pos}` : '',
          item._whole ? 'oa-card--link' : '',
        ].filter(Boolean).join(' ');
        item._style = item.color ? `--card-accent:var(--${colorVar(item.color)})` : '';
        item._tags = (Array.isArray(item.tags) ? item.tags : (item.tags ? [item.tags] : [])).map(t => ({ t: String(t) }));
        item._has_tags = item._tags.length > 0;
        item._cap_text = item.title;
        item._zoom = item.zoomable === true && !!item._image && !item._whole;
        item.not_icon = !item.icon;
        item.not_badge = !item.badge;
        item.not_body = !item.body;
      });
      b._group = uid('cg');
      break;
    }

    case 'accordion': {
      b.variant = b.variant || 'bordered';
      b.multiple = b.multiple !== false;
      b._exclusive = !b.multiple;
      b._name = uid('acc');
      (b.items || []).forEach((item, i) => {
        item.title = item.title || item.question || item.label || item.heading || item.header || item.name || '';
        item.body = item.body || item.answer || item.text || item.content || item.description || '';
        item._open = item.open === true || b.default_open === 'all' || (b.default_open === 'first' && i === 0);
        item._body_html = item.body ? mdb(marked, item.body) : '';
        const blocks = Array.isArray(item.blocks) ? item.blocks : [];
        item._blocks_html = blocks.length ? renderKids(blocks, ctx) : '';
        item.not_icon = !item.icon;
        item.not_badge = !item.badge;
      });
      break;
    }

    case 'steps': {
      b.variant = b.variant || 'vertical';
      b.numbered = b.numbered !== false;
      (b.items || []).forEach((item, i) => {
        item.title = item.title || item.heading || item.name || item.label || '';
        item.body = item.body || item.text || item.content || item.description || '';
        item._status = item.status || 'todo';
        item._num = item._status === 'done' ? '✓' : (b.numbered ? String(i + 1) : '•');
        item._body_html = item.body ? mdb(marked, item.body) : '';
        const blocks = Array.isArray(item.blocks) ? item.blocks : [];
        item._blocks_html = blocks.length ? renderKids(blocks, ctx) : '';
      });
      break;
    }

    // ── content ──
    case 'quote': {
      b.variant = b.variant || 'plain';
      b._text_html = mdb(marked, b.text || '');
      b.avatar = b.avatar ? resolveImageSrc(b.avatar, specDir) : '';
      const href = safeHref(b.href || '');
      b._source_html = b.source
        ? (href ? `<a ${linkAttrs(href)}>${escapeHtml(b.source)}</a>` : escapeHtml(b.source))
        : (href ? `<a ${linkAttrs(href)}>${escapeHtml(href.replace(/^https?:\/\//, ''))}</a>` : '');
      b._has_by = !!(b.author || b.role || b._source_html || b.avatar);
      break;
    }

    case 'compare': {
      b.variant = b.variant || 'vs';
      const tones = {
        vs: ['neutral', 'neutral'],
        'pros-cons': ['pos', 'neg'],
        'before-after': ['neutral', 'pos'],
      }[b.variant] || ['neutral', 'neutral'];
      const side = (src, defTone) => {
        const s = { ...(src || {}) };
        s.title = s.title || s.heading || s.name || s.label || '';
        s._tone = ['pos', 'neg', 'neutral'].includes(s.tone) ? s.tone : defTone;
        s._mark = { pos: '✓', neg: '✗', neutral: '•' }[s._tone];
        const list = Array.isArray(s.items) ? s.items : [];
        s._items = list.map(it => ({ _html: shield(inlineMd(marked, typeof it === 'string' ? it : (it?.text ?? it?.label ?? ''))) }));
        s._has_items = s._items.length > 0;
        const body = s.body || s.text || s.content || '';
        s._body_html = body ? mdb(marked, body) : '';
        return s;
      };
      b._left = side(b.left, tones[0]);
      b._right = side(b.right, tones[1]);
      break;
    }

    case 'feature-matrix': {
      const cols = (b.columns || []).map(c => (typeof c === 'string' ? { name: c } : { ...c }));
      let hl = -1;
      if (b.highlight_col !== undefined && b.highlight_col !== null && b.highlight_col !== '') {
        hl = Number.isInteger(Number(b.highlight_col)) ? Number(b.highlight_col) : cols.findIndex(c => c.name === b.highlight_col);
      }
      cols.forEach((c, i) => {
        c.name = c.name || c.title || c.label || '';
        c._hl = i === hl;
        c.not_sub = !c.sub;
        c.not_badge = !c.badge;
      });
      b._cols = cols;
      b._span = cols.length + 1;
      const cell = v => {
        if (v === true || /^(yes|true|✓|✔)$/i.test(String(v))) return '<span class="oa-yes" role="img" aria-label="Yes">✓</span>';
        if (v === false || /^(no|false|✗|✘)$/i.test(String(v))) return '<span class="oa-no" role="img" aria-label="No">✗</span>';
        if (v == null || v === '' || v === '-' || v === '—') return '<span class="oa-na" aria-label="Not applicable">—</span>';
        return shield(inlineMd(marked, String(v)));
      };
      b._rows = (b.rows || []).map(r => {
        if (Array.isArray(r)) r = { feature: r[0], values: r.slice(1) };
        const row = { ...r };
        row._group = row.group && !row.feature && !row.values ? String(row.group) : '';
        row.feature = row.feature || row.name || row.label || '';
        const values = Array.isArray(row.values) ? row.values : (Array.isArray(row.cells) ? row.cells : []);
        row._cells = cols.map((c, i) => {
          const v = values[i];
          return { _html: cell(v), _cls: `${v === true ? 'is-yes' : (v === false ? 'is-no' : '')}${c._hl ? ' is-hl' : ''}`.trim() };
        });
        row.not_note = !row.note;
        return row;
      });
      break;
    }

    case 'buttons':
      b._html = shield(buttonsHtml(b.items, { size: b.size, align: b.align }));
      break;

    case 'cta': {
      b.body = b.body || '';
      b._body_html = b.body ? mdb(marked, b.body) : '';
      b._buttons_html = shield(buttonsHtml(Array.isArray(b.buttons) ? b.buttons : [], { align: b.align }));
      const bg = String(b.background || 'accent');
      const style = [];
      if (['accent', 'surface', 'accent-soft', 'gradient'].includes(bg)) b._bg = bg;
      else {
        b._bg = 'image';
        style.push(`background-image:url('${resolveImageSrc(bg, specDir).replace(/'/g, '%27')}')`);
      }
      b._style = style.join(';');
      b._align = ['left', 'center', 'right'].includes(b.align) ? b.align : 'left';
      break;
    }

    case 'embed': {
      b._kind = embedKind(b);
      b._is_video = b._kind === 'video';
      b._caption_html = b.caption ? shield(inlineMd(marked, b.caption)) : '';
      b._aspect = parseAspect(b.aspect) || '16 / 9';
      if (b._kind === 'video') {
        b._poster = b.poster ? resolveImageSrc(b.poster, specDir) : '';
        b._flags = [b.autoplay ? 'autoplay' : '', b.loop ? 'loop' : '', (b.muted || b.autoplay) ? 'muted' : ''].filter(Boolean).join(' ');
        b._src = safeHref(b.src);
      } else {
        b._href = safeHref(b.src);
        b._link_attrs = linkAttrs(b._href, true);
        let host = '';
        try { host = new URL(b._href).hostname.replace(/^www\./, ''); } catch { host = ''; }
        const yt = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/.exec(b._href);
        b._provider = b.provider || (yt ? 'YouTube' : (host || 'Link'));
        b._title = b.title || b._provider;
        const thumb = b.thumbnail ? resolveImageSrc(b.thumbnail, specDir) : (yt ? `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` : '');
        b._thumb = thumb;
        b._meta = host && host.toLowerCase() !== String(b._provider).toLowerCase() ? `${b._provider} · ${host}` : b._provider;
      }
      break;
    }

    case 'definition-list': {
      b.layout = b.layout || 'stacked';
      (b.items || []).forEach(item => {
        item.term = item.term ?? item.key ?? item.name ?? '';
        item._term_html = shield(inlineMd(marked, String(item.term)));
        item._def_html = shield(inlineMd(marked, String(item.definition ?? item.value ?? '')));
      });
      break;
    }

    case 'checklist': {
      const labels = { done: 'done', todo: 'to do', blocked: 'blocked', skip: 'skipped' };
      let done = 0, total = 0;
      (b.items || []).forEach(item => {
        item.label = item.label || item.text || item.title || '';
        item._status = ['done', 'todo', 'blocked', 'skip'].includes(item.status) ? item.status : (item.checked ? 'done' : 'todo');
        item._status_label = labels[item._status];
        item._label_html = shield(inlineMd(marked, String(item.label)));
        item.not_note = !item.note;
        if (item._status !== 'skip') total++;
        if (item._status === 'done') done++;
      });
      b._done = done;
      b._total = total;
      b._pct = total ? Math.round((done / total) * 100) : 0;
      break;
    }

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

// Block-level Markdown whose output is inserted into a template (shielded against {{ }} re-scanning).
function mdb(marked, text) {
  return shield(marked.parse(String(text ?? '')));
}

// Inline Markdown: strips the wrapping paragraph from block output when parseInline is unavailable.
function inlineMd(marked, text) {
  const t = String(text ?? '');
  if (typeof marked.parseInline === 'function') return marked.parseInline(t);
  return String(marked.parse(t)).replace(/^\s*<p>([\s\S]*?)<\/p>\s*$/, '$1');
}

function renderKids(list, ctx) {
  return shield(renderBlockList(list, ctx));
}

function embedKind(b) {
  if (b.kind) return b.kind;
  return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(String(b.src || '')) ? 'video' : 'link';
}

// Gives a block its anchor id and registers it for the TOC (document order = render order).
function assignAnchor(b) {
  let text = '';
  let level = 2;
  switch (b.type) {
    case 'hero': text = b.title || b.heading || ''; level = 1; break;
    case 'text-section': text = b.heading || b.title || ''; level = Number(b.level) || 2; break;
    case 'section': text = b.title || b.heading || ''; level = Number(b.level) || 2; break;
    default: break;
  }
  const label = b.toc_label || (b.type === 'anchor' ? b.label : '');
  if (!b.id && (text || label)) b.id = uniqueId(label || text);
  if (label) {
    STATE.headings.push({ id: b.id, text: String(label), level: Number(b.toc_level) || level, kind: 'block' });
  } else if (text && b.id) {
    STATE.headings.push({ id: b.id, text: String(text), level, kind: 'heading' });
  }
}

function renderBlock(block, ctx) {
  const { marked, specDir, blocksDir } = ctx;
  assignAnchor(block);
  const b = preprocessBlock(block, ctx);
  let html;

  if (b.type === 'markdown') {
    html = `<div class="markdown-body">\n${addHeadingIds(marked.parse(b.content || ''))}\n</div>`;
  } else if (b.type === 'markdown-file') {
    const mdPath = resolvePath(b.path, specDir);
    if (!fs.existsSync(mdPath)) {
      throw new Error(`markdown-file not found: ${b.path} (resolved: ${mdPath})`);
    }
    let rawMd = fs.readFileSync(mdPath, 'utf8');
    if (b.strip_frontmatter !== false) rawMd = stripFrontmatter(rawMd);
    html = `<div class="markdown-body">\n${addHeadingIds(marked.parse(rawMd))}\n</div>`;
  } else {
    const templatePath = path.join(blocksDir, `${b.type}.html`);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Unknown block type "${b.type}" — template not found: ${templatePath}`);
    }
    html = unshield(renderTemplate(fs.readFileSync(templatePath, 'utf8'), b));
  }

  return injectRootAttrs(html, rootAttrsFor(block));
}

function renderBlockList(blocks, ctx) {
  return blocks.map(b => renderBlock(b, ctx)).join('\n');
}

// Replaces <!--OA_TOC_LIST:n--> placeholders once every heading is known.
function renderTocLists(html) {
  return html.replace(/<!--OA_TOC_LIST:(\d+)-->/g, (_, n) => {
    const cfg = STATE.tocs[Number(n)];
    if (!cfg) return '';
    let entries = STATE.headings.filter(h => {
      if (cfg.include === 'headings' && h.kind !== 'heading') return false;
      if (cfg.include === 'blocks' && h.kind !== 'block') return false;
      return h.level >= cfg.minLevel && h.level <= cfg.depth;
    });
    // the sticky bar is a single row of top-level entries
    if (cfg.variant === 'sticky') entries = entries.filter(h => h.level === cfg.minLevel);
    if (!entries.length) return '';
    const counters = [];
    const items = entries.map(e => {
      let num = '';
      if (cfg.numbered) {
        const depth = e.level - cfg.minLevel;
        counters.length = depth + 1;
        for (let i = 0; i <= depth; i++) counters[i] = (counters[i] || 0) + (i === depth ? 1 : 0);
        num = `<span class="oa-toc__num">${counters.map(c => c || 1).join('.')}</span> `;
      }
      return `<li class="oa-toc__item oa-toc__item--l${e.level}"><a href="#${escapeHtml(e.id)}">${num}${escapeHtml(e.text)}</a></li>`;
    });
    return `<ol class="oa-toc__list">${items.join('')}</ol>`;
  });
}

// ─── Needs collector (CDN libs, runtime modules, raw blocks) ─────────────────

function collectNeeds(blocks) {
  const needs = { chartjs: false, mermaid: false, hljs: false, runtime: new Set(), css: [], scripts: [], cdn: [] };
  walkBlocks(blocks, b => {
    switch (b.type) {
      case 'chart-bar': case 'chart-line': case 'chart-pie': needs.chartjs = true; break;
      case 'mermaid-diagram': needs.mermaid = true; break;
      case 'code-block': if (b.lang && b.lang !== 'plaintext') needs.hljs = true; break;
      case 'raw':
        if (b.css) needs.css.push(b.css);
        if (b.scripts) needs.scripts.push(b.scripts);
        if (Array.isArray(b.cdn_scripts)) needs.cdn.push(...b.cdn_scripts);
        break;
      case 'image': if (b.zoomable) needs.runtime.add('lightbox'); break;
      case 'gallery': if (b.zoomable !== false) needs.runtime.add('lightbox'); break;
      case 'slideshow':
        needs.runtime.add('slideshow');
        if (b.zoomable) needs.runtime.add('lightbox');
        break;
      case 'cards': if ((b.items || []).some(it => it && it.zoomable === true && it.image)) needs.runtime.add('lightbox'); break;
      case 'accordion': needs.runtime.add('accordion'); break;
      case 'tabs': needs.runtime.add('core'); break;
      case 'image-compare': needs.runtime.add('compare'); break;
      case 'toc': if (['sticky', 'sidebar'].includes(b.variant)) needs.runtime.add('toc'); break;
      default: break;
    }
  });
  needs.cdn = [...new Set(needs.cdn)];
  return needs;
}

// Runtime modules live in runtime/*.js and are inlined once, only when a block needs them.
const RUNTIME_ORDER = ['core', 'lightbox', 'slideshow', 'accordion', 'compare', 'toc', 'anchors'];

function loadRuntime(names, runtimeDir) {
  const wanted = new Set(names);
  if (wanted.size) wanted.add('core');
  return RUNTIME_ORDER.filter(n => wanted.has(n)).map(n => {
    const file = path.join(runtimeDir, `${n}.js`);
    if (!fs.existsSync(file)) throw new Error(`runtime module not found: ${file}`);
    return `/* oa-runtime: ${n} */\n${fs.readFileSync(file, 'utf8').trim()}`;
  });
}

// ─── HTML skeleton ────────────────────────────────────────────────────────────

function buildHtml({ title, lang, css, headScripts, bodyHtml, bodyScripts, inlineScripts, mermaidInit, mainStyle = '', afterMain = '' }) {
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
    var cs = getComputedStyle(document.documentElement);
    function v(n) { return cs.getPropertyValue(n).trim(); }
    // Diagrams take the page's own tokens instead of mermaid's stock look.
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        darkMode: isDark,
        background: v('--bg'),
        fontFamily: getComputedStyle(document.body).fontFamily,
        fontSize: '15px',
        primaryColor: v('--accent-soft'),
        primaryTextColor: v('--fg'),
        primaryBorderColor: v('--accent'),
        lineColor: v('--fg-muted'),
        secondaryColor: v('--surface-2'),
        tertiaryColor: v('--surface'),
        noteBkgColor: v('--surface-2'),
        noteTextColor: v('--fg')
      }
    });
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
<main${mainStyle ? ` style="${escapeHtml(mainStyle)}"` : ''}>
${bodyHtml}
</main>
${afterMain ? afterMain + '\n' : ''}${bodyScriptTags ? bodyScriptTags + '\n' : ''}${mermaidTag}${inlineScriptTag}
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

  resetState(spec || {});

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
  let bodyHtml, cdnNeeds = { runtime: new Set() }, rawCss = '', rawScripts = [], rawCdnUrls = [];

  if (spec.source) {
    const srcPath = resolvePath(spec.source, specDir);
    if (!fs.existsSync(srcPath)) {
      console.error(`Error: source file not found: ${srcPath}`);
      process.exit(1);
    }
    let rawMd = fs.readFileSync(srcPath, 'utf8');
    rawMd = stripFrontmatter(rawMd);
    bodyHtml = `<article class="markdown-body">\n${addHeadingIds(marked.parse(rawMd))}\n</article>`;
    if (verbose) console.log('[build] passthrough mode:', srcPath);
  } else {
    // ── Blocks mode ─────────────────────────────────────────────────────────
    const blocks = spec.blocks || [];
    if (!Array.isArray(blocks)) {
      console.error('Error: spec.blocks must be an array');
      process.exit(1);
    }

    cdnNeeds    = collectNeeds(blocks);
    rawCss      = cdnNeeds.css.join('\n');
    rawScripts  = cdnNeeds.scripts;
    rawCdnUrls  = cdnNeeds.cdn;

    // explicit ids are reserved first so auto-generated anchors never collide with them
    walkBlocks(blocks, b => { if (b.id) STATE.usedIds.add(String(b.id)); });

    try {
      bodyHtml = renderBlockList(blocks, { marked, specDir, blocksDir });
    } catch (e) {
      console.error(`Error rendering blocks: ${e.message}`);
      if (verbose) console.error(e.stack);
      process.exit(1);
    }
  }

  bodyHtml = renderTocLists(bodyHtml);

  // Page width: narrow | normal | wide | <css length>
  const MAIN_WIDTHS = { narrow: 720, normal: 920, wide: 1200 };
  let mainWidthPx = MAIN_WIDTHS.normal;
  let mainStyle = '';
  if (spec.width != null && spec.width !== '') {
    const w = String(spec.width);
    if (MAIN_WIDTHS[w]) { mainWidthPx = MAIN_WIDTHS[w]; mainStyle = `--oa-main-w:${mainWidthPx}px`; }
    else if (/^\d+(px)?$/.test(w)) { mainWidthPx = parseInt(w, 10); mainStyle = `--oa-main-w:${mainWidthPx}px`; }
    else console.warn(`[warn] spec "width" must be narrow, normal, wide or a pixel value (got "${w}") — ignored`);
  }

  // Sidebar TOC sits beside <main>; it needs room on both sides, so it only floats on wide viewports.
  if (STATE.tocs.some(t => t.variant === 'sidebar')) {
    const need = mainWidthPx + 2 * (240 + 24);
    css += `\n/* === TOC SIDEBAR (generated for main width ${mainWidthPx}px) === */
@media (min-width: ${need}px) {
  .oa-toc--sidebar { position: fixed; top: var(--sp-5); left: calc(50% + ${mainWidthPx / 2}px + var(--sp-5)); width: 240px;
    max-height: calc(100vh - 2 * var(--sp-5)); overflow-y: auto; margin: 0; }
}\n`;
  }

  // Append raw CSS from raw blocks
  if (rawCss) css += '\n/* === RAW BLOCK CSS === */\n' + rawCss;

  // hljs dark-mode aware CSS inline (fetch not available in CSP — use inline style override)
  if (cdnNeeds.hljs) {
    css += `\npre code.hljs { background: transparent; color: var(--fg); padding: 0; }
.hljs-keyword, .hljs-selector-tag, .hljs-built_in { color: var(--accent); font-weight: 600; }
.hljs-string, .hljs-attr, .hljs-attribute { color: var(--c3); }
.hljs-number, .hljs-literal, .hljs-symbol { color: var(--c2); }
.hljs-title, .hljs-function, .hljs-name { color: var(--c5); }
.hljs-comment, .hljs-quote { color: var(--fg-muted); font-style: italic; }`;
  }

  // ── Runtime modules ───────────────────────────────────────────────────────
  const runtimeNeeds = new Set(cdnNeeds.runtime);
  const backToTop = spec.back_to_top === true;
  if (STATE.headingLinks && STATE.headings.length) runtimeNeeds.add('anchors');
  if (backToTop) runtimeNeeds.add('anchors');
  const runtimeScripts = loadRuntime([...runtimeNeeds], path.join(__dirname, 'runtime'));
  const afterMain = backToTop
    ? `<a class="oa-top" href="#" aria-label="${STATE.lang === 'ru' ? 'Наверх' : 'Back to top'}" hidden>↑</a>`
    : '';

  // ── Assemble CDN tags ─────────────────────────────────────────────────────
  const headScripts = [];
  const bodyScripts = [];

  // Libraries must load in <head> so globals (Chart, mermaid, hljs) are available before body executes
  if (cdnNeeds.chartjs) headScripts.push(CDN.chartjs);
  if (cdnNeeds.mermaid) headScripts.push(CDN.mermaid);
  if (cdnNeeds.hljs)    headScripts.push(CDN.hljs);
  rawCdnUrls.forEach(u => headScripts.push(u));

  // hljs init (if needed)
  const inlineScripts = [...runtimeScripts, ...rawScripts];
  if (cdnNeeds.chartjs) {
    // Shared by every chart block (runs before their DOMContentLoaded init): the page's own type and
    // colours become Chart.js defaults, and series colours get a proper alpha for filled areas.
    inlineScripts.unshift(`window.__oaChartInit = function (cs) {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 13;
  Chart.defaults.color = cs.getPropertyValue('--fg-muted').trim();
  Chart.defaults.borderColor = cs.getPropertyValue('--surface-2').trim();
};
window.__oaAlpha = function (hex, a) {
  var m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  var n = parseInt(m[1], 16);
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
};`);
  }
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
    mainStyle,
    afterMain,
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
