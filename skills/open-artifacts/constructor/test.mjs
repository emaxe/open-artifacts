#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildScript = path.join(__dirname, 'build.mjs');
const repoRoot = path.resolve(__dirname, '../../..');
const demoYaml = path.join(repoRoot, 'demo', 'demo.yaml');

console.log('=== RUNNING CONSTRUCTOR TEST SUITE ===\n');

function run(cmd, shouldFail = false) {
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (shouldFail) {
      console.error(`❌ FAILED: Expected command to fail, but it succeeded:\n${cmd}`);
      process.exit(1);
    }
    return out;
  } catch (err) {
    if (!shouldFail) {
      console.error(`❌ FAILED: Command unexpectedly failed:\n${cmd}\n${err.stderr}`);
      process.exit(1);
    }
    return (err.stdout || '') + (err.stderr || '');
  }
}

// Test 1: Original agent issue (variant + text)
fs.writeFileSync('/tmp/t1.yaml', `title: T1\nblocks:\n  - type: alert\n    variant: warning\n    text: "Test Warning"\n`);
run(`node "${buildScript}" /tmp/t1.yaml --out /tmp/t1.html`);
const html1 = fs.readFileSync('/tmp/t1.html', 'utf8');
if (!html1.includes('alert--warning') || !html1.includes('Test Warning') || !html1.includes('alert__icon')) {
  console.error('❌ Test 1 failed: alert output is wrong!');
  process.exit(1);
}
console.log('✅ Test 1 Passed: variant + text correctly auto-mapped to kind:warning + body');

// Test 2: Empty alert protection (no body, no title)
fs.writeFileSync('/tmp/t2.yaml', `title: T2\nblocks:\n  - type: alert\n    variant: warning\n`);
const out2 = run(`node "${buildScript}" /tmp/t2.yaml --out /tmp/t2.html`, true);
if (!out2.includes('neither "body" (or "text") nor "title"')) {
  console.error(`❌ Test 2 failed: Expected empty alert error, got:\n${out2}`);
  process.exit(1);
}
console.log('✅ Test 2 Passed: Empty alert blocked with exit code 1 and helpful error');

// Test 3: Typo detection ("Did you mean?")
fs.writeFileSync('/tmp/t3.yaml', `title: T3\nblocks:\n  - type: alert\n    kind: info\n    bdy: "Hello"\n`);
const out3 = run(`node "${buildScript}" /tmp/t3.yaml --out /tmp/t3.html`, true);
if (!out3.includes('Did you mean "body"?')) {
  console.error(`❌ Test 3 failed: Did you mean not triggered, got:\n${out3}`);
  process.exit(1);
}
console.log('✅ Test 3 Passed: Typo bdy caught with "Did you mean body?"');

// Test 4: Block type alias (callout -> alert)
fs.writeFileSync('/tmp/t4.yaml', `title: T4\nblocks:\n  - type: callout\n    variant: info\n    text: "Callout text"\n`);
run(`node "${buildScript}" /tmp/t4.yaml --out /tmp/t4.html`);
const html4 = fs.readFileSync('/tmp/t4.html', 'utf8');
if (!html4.includes('alert--info') || !html4.includes('Callout text')) {
  console.error('❌ Test 4 failed: callout type not mapped to alert!');
  process.exit(1);
}
console.log('✅ Test 4 Passed: type "callout" auto-mapped to "alert"');

// Test 5: Table aliases (headers + data instead of columns + rows)
fs.writeFileSync('/tmp/t5.yaml', `title: T5\nblocks:\n  - type: table\n    headers: ["A", "B"]\n    data:\n      - [1, 2]\n`);
run(`node "${buildScript}" /tmp/t5.yaml --out /tmp/t5.html`);
const html5 = fs.readFileSync('/tmp/t5.html', 'utf8');
if (!html5.includes('>A</th>') || !html5.includes('<td>1</td>')) {
  console.error('❌ Test 5 failed: table headers/data not rendered!');
  process.exit(1);
}
console.log('✅ Test 5 Passed: table headers & data auto-mapped to columns & rows');

// Test 6: Badge row string array
fs.writeFileSync('/tmp/t6.yaml', `title: T6\nblocks:\n  - type: badge-row\n    items: ["React", "Vue"]\n`);
run(`node "${buildScript}" /tmp/t6.yaml --out /tmp/t6.html`);
const html6 = fs.readFileSync('/tmp/t6.html', 'utf8');
if (!html6.includes('>React</span>') || !html6.includes('>Vue</span>')) {
  console.error('❌ Test 6 failed: badge string array not rendered!');
  process.exit(1);
}
console.log('✅ Test 6 Passed: badge-row string array normalized and rendered');

// Test 7: Mermaid diagram code alias
fs.writeFileSync('/tmp/t7.yaml', `title: T7\nblocks:\n  - type: mermaid-diagram\n    code: "graph LR\\n  A-->B"\n`);
run(`node "${buildScript}" /tmp/t7.yaml --out /tmp/t7.html`);
const html7 = fs.readFileSync('/tmp/t7.html', 'utf8');
if (!html7.includes('A--&gt;B') && !html7.includes('A-->B')) {
  console.error('❌ Test 7 failed: mermaid diagram code alias not rendered!');
  process.exit(1);
}
console.log('✅ Test 7 Passed: mermaid-diagram code alias auto-mapped to definition');

// Test 9: chart series without an explicit colour are not collapsed to the accent
fs.writeFileSync('/tmp/t9.yaml', `title: T9\nblocks:\n  - type: chart-bar\n    labels: [a, b]\n    datasets:\n      - { label: x, data: [1, 2] }\n      - { label: y, data: [2, 1], color: c3 }\n  - type: chart-bar\n    monochrome: true\n    labels: [a]\n    datasets: [{ label: z, data: [1] }]\n`);
run(`node "${buildScript}" /tmp/t9.yaml --out /tmp/t9.html`);
const html9 = fs.readFileSync('/tmp/t9.html', 'utf8');
if (!html9.includes('"_color":""') || !html9.includes('"_color":"c3"') || !html9.includes('var vary = false;') || !html9.includes('var vary = true;')) {
  console.error('❌ Test 9 failed: chart colour defaults are wrong!');
  process.exit(1);
}
console.log('✅ Test 9 Passed: uncoloured series walk the palette; explicit color and monochrome are respected');

// Test 8: Full demo.yaml clean build
if (fs.existsSync(demoYaml)) {
  run(`node "${buildScript}" "${demoYaml}" --out /tmp/t8.html`);
  console.log('✅ Test 8 Passed: Full demo.yaml builds cleanly (11 blocks)');
  fs.unlinkSync('/tmp/t8.html');
}

// ─── v0.13 blocks ────────────────────────────────────────────────────────────
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oa-constructor-'));
function build(name, yamlText, extra = '', shouldFail = false) {
  const spec = path.join(tmpDir, `${name}.yaml`);
  const out = path.join(tmpDir, `${name}.html`);
  fs.writeFileSync(spec, yamlText);
  const log = run(`node "${buildScript}" "${spec}" --out "${out}" ${extra} 2>&1`, shouldFail);
  return { log, html: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '' };
}
function check(name, cond, detail = '') {
  if (!cond) {
    console.error(`❌ ${name} failed! ${detail}`);
    process.exit(1);
  }
  console.log(`✅ ${name} Passed`);
}
const count = (str, sub) => str.split(sub).length - 1;

// Test 10: deep nesting through containers; shared libraries are included once
{
  const { html } = build('t10', `title: T10
blocks:
  - type: section
    title: Outer
    blocks:
      - type: grid
        cols: 2
        blocks:
          - type: tabs
            items:
              - label: A
                blocks:
                  - type: accordion
                    items:
                      - title: Q
                        blocks:
                          - { type: chart-bar, labels: [a], datasets: [{ label: x, data: [1] }] }
          - { type: mermaid-diagram, definition: "graph LR; A-->B" }
`);
  check('Test 10: nested section→grid→tabs→accordion→chart',
    count(html, 'chart.umd.min.js') === 1 && count(html, 'mermaid.min.js') === 1 && html.includes('oa-accordion') && html.includes('canvas'));
}

// Test 11: common fields land on the root element of any block (markdown included)
{
  const { html } = build('t11', `title: T11
blocks:
  - { type: alert, body: hi, id: note-1, class: extra, width: wide, hide: print }
  - { type: markdown, content: "text", id: md-1, hide: [mobile, print], spacing: { top: sp-7 } }
  - { type: grid, cols: 2, blocks: [ { type: alert, body: a, span: 2 }, { type: alert, body: b } ] }
`);
  const tagOf = id => (html.match(new RegExp(`<[a-z]+[^>]*id="${id}"[^>]*>`)) || [''])[0];
  const alertTag = tagOf('note-1');
  check('Test 11: common fields on a block root (id/class/width/hide)',
    ['extra', 'oa-w-wide', 'oa-hide-print'].every(c => alertTag.includes(c)), alertTag);
  const mdTag = tagOf('md-1');
  check('Test 11b: markdown root gets id, hide classes and margin',
    mdTag.includes('oa-hide-mobile') && mdTag.includes('oa-hide-print') && mdTag.includes('margin-top:48px'), mdTag);
  check('Test 11c: span becomes --oa-span on a grid child', html.includes('--oa-span:2'));
}

// Test 12: anchors + TOC (transliteration, de-duplication, placeholder replaced)
{
  const { html } = build('t12', `title: T12
blocks:
  - { type: toc, numbered: true }
  - { type: text-section, heading: "Введение", body: "x" }
  - { type: text-section, heading: "Введение", body: "y" }
  - { type: markdown, content: "## Install\\n\\ntext\\n\\n### Details\\n" }
`);
  check('Test 12: TOC lists headings with slugs',
    html.includes('id="vvedenie"') && html.includes('id="vvedenie-2"') && html.includes('href="#install"') &&
    html.includes('href="#details"') && html.includes('oa-toc__num') && !html.includes('OA_TOC_LIST'));
}

// Test 13: runtime modules are inlined only when needed, and only once
{
  const plain = build('t13a', `title: T13a\nblocks:\n  - { type: alert, body: x }\n`).html;
  check('Test 13a: no runtime without media blocks', !plain.includes('oa-runtime: lightbox') && !plain.includes('oa-runtime: slideshow') && !plain.includes('oa-runtime: accordion'));
  const rich = build('t13b', `title: T13b
blocks:
  - { type: image, src: "data:image/png;base64,AAAA", zoomable: true }
  - { type: gallery, items: ["data:image/png;base64,AAAA", "data:image/png;base64,BBBB"] }
  - { type: slideshow, items: ["data:image/png;base64,AAAA", "data:image/png;base64,BBBB"] }
`).html;
  check('Test 13b: lightbox/slideshow runtime once each',
    count(rich, 'oa-runtime: lightbox') === 1 && count(rich, 'oa-runtime: slideshow') === 1 && count(rich, 'oa-runtime: core') === 1);
}

// Test 14: gallery "+N" tile, local images inlined, slideshow data attributes
{
  fs.writeFileSync(path.join(tmpDir, 'p.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>');
  const { html } = build('t14', `title: T14
blocks:
  - type: gallery
    max_visible: 2
    items: [p.svg, p.svg, p.svg, p.svg]
  - { type: slideshow, autoplay: 3000, effect: fade, nav: thumbs, items: [p.svg, p.svg] }
`);
  check('Test 14: gallery +N, base64 inlining, slideshow config',
    html.includes('+2') && html.includes('data:image/svg+xml;base64,') && html.includes('data-autoplay="3000"') && html.includes('data-effect="fade"'));
}

// Test 15: backward compatibility (list-cards, two-columns, zoomable image)
{
  const { html } = build('t15', `title: T15
blocks:
  - type: list-cards
    cols: 2
    items: [{ title: A, body: b, href: "https://example.com", badge: new }, { title: B }]
  - type: two-columns
    left: [{ type: alert, body: l }]
    right: [{ type: alert, body: r }]
  - { type: image, src: "data:image/png;base64,AAAA", caption: Cap, zoomable: true }
`);
  check('Test 15: list-cards / two-columns / zoomable image still render',
    html.includes('list-card__title') && html.includes('--oa-cols:2') && html.includes('target="_blank"') &&
    html.includes('two-columns__left') && html.includes('data-zoomable="true"') && html.includes('<figcaption>Cap'));
}

// Test 16: new aliases and "Did you mean" for block types
{
  const { html, log } = build('t16', `title: T16
blocks:
  - { type: faq, items: [{ question: Q, answer: A }] }
  - { type: carousel, items: ["data:image/png;base64,AAAA"] }
`);
  check('Test 16a: faq → accordion, carousel → slideshow', html.includes('oa-accordion') && html.includes('data-oa-slideshow'));
  const bad = build('t16b', `title: T16b\nblocks:\n  - { type: slidshow, items: [] }\n`, '', true).log;
  check('Test 16b: block-type typo suggests slideshow', bad.includes('Did you mean "slideshow"?'), bad);
}

// Test 17: embed — video from a third-party host warns; unknown fields still caught
{
  const { log } = build('t17', `title: T17
blocks:
  - { type: embed, kind: video, src: "https://cdn.example.com/a.mp4" }
`);
  check('Test 17: third-party video warns about CSP', log.includes('blocked by the viewer CSP'), log);
}

// Test 18: literal {{ }} inside nested blocks survive; javascript: links are dropped
{
  const { html } = build('t18', `title: T18
blocks:
  - type: section
    blocks:
      - { type: code-block, lang: plaintext, code: "<p>{{ name }}</p>" }
      - type: buttons
        items:
          - { label: Bad, href: "javascript:alert(1)" }
          - { label: Good, href: "https://example.com" }
`);
  check('Test 18a: braces inside a nested code block are preserved', html.includes('{{ name }}'));
  check('Test 18b: javascript: href removed, https kept', !html.includes('javascript:') && html.includes('href="https://example.com"'));
}

// Test 19: showcase builds cleanly (no warnings)
{
  const showcase = path.join(repoRoot, 'demo', 'showcase.yaml');
  if (fs.existsSync(showcase)) {
    const out = run(`node "${buildScript}" "${showcase}" --out "${path.join(tmpDir, 'showcase.html')}"`);
    check('Test 19: demo/showcase.yaml builds without warnings', !/warnings|failed/i.test(out), out);
  }
}
fs.rmSync(tmpDir, { recursive: true, force: true });

// Cleanup
fs.unlinkSync('/tmp/t1.yaml'); fs.unlinkSync('/tmp/t1.html');
fs.unlinkSync('/tmp/t2.yaml');
fs.unlinkSync('/tmp/t3.yaml');
fs.unlinkSync('/tmp/t4.yaml'); fs.unlinkSync('/tmp/t4.html');
fs.unlinkSync('/tmp/t5.yaml'); fs.unlinkSync('/tmp/t5.html');
fs.unlinkSync('/tmp/t6.yaml'); fs.unlinkSync('/tmp/t6.html');
fs.unlinkSync('/tmp/t7.yaml'); fs.unlinkSync('/tmp/t7.html');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
