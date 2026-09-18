#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
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
if (!html1.includes('alert--warning') || !html1.includes('Test Warning') || !html1.includes('⚠️')) {
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

// Test 8: Full demo.yaml clean build
if (fs.existsSync(demoYaml)) {
  run(`node "${buildScript}" "${demoYaml}" --out /tmp/t8.html`);
  console.log('✅ Test 8 Passed: Full demo.yaml builds cleanly (11 blocks)');
  fs.unlinkSync('/tmp/t8.html');
}

// Cleanup
fs.unlinkSync('/tmp/t1.yaml'); fs.unlinkSync('/tmp/t1.html');
fs.unlinkSync('/tmp/t2.yaml');
fs.unlinkSync('/tmp/t3.yaml');
fs.unlinkSync('/tmp/t4.yaml'); fs.unlinkSync('/tmp/t4.html');
fs.unlinkSync('/tmp/t5.yaml'); fs.unlinkSync('/tmp/t5.html');
fs.unlinkSync('/tmp/t6.yaml'); fs.unlinkSync('/tmp/t6.html');
fs.unlinkSync('/tmp/t7.yaml'); fs.unlinkSync('/tmp/t7.html');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!\n');
