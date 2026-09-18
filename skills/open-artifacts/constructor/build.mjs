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
      b.align_center = b.align === 'center';
      b.not_align_center = !b.align_center;
      break;

    case 'kpi-row':
      (b.items || []).forEach(item => {
        item.trend = item.trend || 'neutral';
        item.not_icon = !item.icon;
        item.not_delta = !item.delta;
        item.not_suffix = !item.suffix;
      });
      break;

    case 'stats-grid':
      b._cols = b.cols || 3;
      (b.items || []).forEach(item => {
        item.not_icon = !item.icon;
        item.not_color = !item.color;
        item.color = colorVar(item.color);
      });
      break;

    case 'table':
      b.striped = b.striped !== false; // default true
      break;

    case 'chart-bar':
      _chartIdx++;
      b._id = `cb-${_chartIdx}`;
      b.height = b.height || 300;
      b.horizontal = !!b.horizontal;
      b.not_horizontal = !b.horizontal;
      b.stacked = !!b.stacked;
      b.not_stacked = !b.stacked;
      b._labels_json = JSON.stringify(b.labels || []);
      b._datasets_json = JSON.stringify((b.datasets || []).map(ds => ({
        label: ds.label || '',
        data: ds.data || [],
        _color: colorVar(ds.color),
        borderWidth: 1,
      })));
      break;

    case 'chart-line':
      _chartIdx++;
      b._id = `cl-${_chartIdx}`;
      b.height = b.height || 300;
      b._fill = b.fill ? 'true' : 'false';
      b._tension = b.tension != null ? String(b.tension) : '0.3';
      b._labels_json = JSON.stringify(b.labels || []);
      b._datasets_json = JSON.stringify((b.datasets || []).map(ds => ({
        label: ds.label || '',
        data: ds.data || [],
        _color: colorVar(ds.color),
      })));
      break;

    case 'chart-pie':
      _chartIdx++;
      b._id = `cp-${_chartIdx}`;
      b.height = b.height || 280;
      b.donut = !!b.donut;
      b.not_donut = !b.donut;
      b._labels_json = JSON.stringify(b.labels || []);
      b._data_json = JSON.stringify(b.data || []);
      break;

    case 'mermaid-diagram':
      // definition passed as raw
      break;

    case 'text-section':
      b.level = b.level || 2;
      b._body_html = b.body ? marked.parse(b.body) : '';
      b.not_heading = !b.heading;
      break;

    case 'alert':
      b.kind = b.kind || 'info';
      const icons = { info: 'ℹ️', warning: '⚠️', error: '❌', success: '✅' };
      b._default_icon = icons[b.kind] || 'ℹ️';
      b.icon = b.icon || b._default_icon;
      b.not_icon = !b.icon;
      b._body_html = b.body ? marked.parse(b.body) : '';
      break;

    case 'code-block':
      b.lang = b.lang || '';
      break;

    case 'image':
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
        item['@index'] = i;
        item['@first'] = i === 0;
        item.not_first = i !== 0;
        item._blocks_html = renderBlockList(item.blocks || [], { marked, specDir, blocksDir });
      });
      break;

    case 'timeline':
      (b.items || []).forEach(item => {
        item.status = item.status || 'pending';
        item._body_html = item.body ? marked.parse(item.body) : '';
        item.not_body = !item.body;
        item.not_date = !item.date;
      });
      break;

    case 'progress-bars':
      (b.items || []).forEach(item => {
        const max = item.max || 100;
        item._max = max;
        item._pct = Math.min(100, Math.round((item.value / max) * 100));
        item._color = colorVar(item.color);
        item.show_value = item.show_value !== false;
        item.not_show_value = !item.show_value;
      });
      break;

    case 'list-cards':
      b._cols = b.cols || 3;
      (b.items || []).forEach(item => {
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
      (b.items || []).forEach(item => {
        item.color = colorVar(item.color);
        item.not_color = !item.color;
      });
      break;

    case 'divider':
      b.not_label = !b.label;
      break;

    case 'spacer':
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
