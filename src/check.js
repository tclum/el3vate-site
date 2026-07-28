// The full validation run, in one command: `npm run check`.
//
// Kept separate from src/validate.js on purpose. validate.js is zero-dependency
// and must stay runnable anywhere; the phase-8 interaction tests need playwright
// and a chromium download. Rather than let validate.js "skip" the interaction
// gate when playwright is absent — a skipped gate that reports green is a false
// done — the interaction stage lives here and is always attempted. If playwright
// is missing this run FAILS and says so.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STAGES = [
  ['build', ['src/build.js']],
  ['content gates', ['src/validate.js']],
  ['gate selftest', ['src/validate.js', '--selftest']],
  ['demo interaction tests', ['src/interact.js']],
];

const results = [];
for (const [name, args] of STAGES) {
  console.log(`\n${'='.repeat(64)}\n== ${name}\n${'='.repeat(64)}`);
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
  results.push([name, r.status === 0]);
  if (name === 'build' && r.status !== 0) break;   // nothing downstream can run
}

console.log(`\n${'='.repeat(64)}`);
for (const [name, ok] of results) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
const failed = results.filter(r => !r[1]);
console.log(failed.length ? `\nCHECK FAILED: ${failed.map(f => f[0]).join(', ')}` : '\nCHECK PASSED: every stage green.');
process.exit(failed.length ? 1 : 0);
