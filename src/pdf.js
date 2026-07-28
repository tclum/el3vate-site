// Phase 9 — render the print-styled handouts to PDF.
//
// src/build.js always emits dist/<slug>/handout.md and a print-styled
// dist/<slug>/handout.html rendered from that same file on disk. This step turns
// each of those into dist/<slug>/handout.pdf, plus one combined
// dist/all-handouts.pdf, using the chromium that phase 8 already installed.
//
// If no renderer is available the HTML stands as the handout artifact and this
// script says so and exits 0 — the substitution is logged rather than silently
// producing nothing. The phase-9 gate in src/validate.js accepts either artifact
// but requires one of them per discipline, at a plausible size.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* handled below */ }

function targets() {
  const list = [];
  for (const entry of fs.readdirSync(DIST, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const html = path.join(DIST, entry.name, 'handout.html');
    if (fs.existsSync(html)) list.push({ label: entry.name, html, pdf: path.join(DIST, entry.name, 'handout.pdf') });
  }
  list.sort((a, b) => a.label.localeCompare(b.label));
  const combined = path.join(DIST, 'all-handouts.html');
  if (fs.existsSync(combined)) list.push({ label: 'all-handouts', html: combined, pdf: path.join(DIST, 'all-handouts.pdf') });
  return list;
}

async function main() {
  const list = targets();
  if (!list.length) {
    console.error('no handout.html found in dist/ — run `node src/build.js` first.');
    process.exit(2);
  }

  if (!chromium) {
    console.log('SUBSTITUTION: no local PDF renderer (playwright/chromium not installed).');
    console.log(`Emitting print-styled HTML instead of PDF for ${list.length} handouts:`);
    list.forEach(t => console.log(`    ${path.relative(DIST, t.html)}`));
    console.log('The phase-9 gate accepts handout.html as the handout artifact.');
    console.log('Install with: npm i -D playwright && npx playwright install chromium');
    process.exit(0);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const made = [];
  try {
    for (const t of list) {
      await page.goto('file://' + t.html, { waitUntil: 'load' });
      await page.emulateMedia({ media: 'print' });
      await page.pdf({
        path: t.pdf,
        format: 'Letter',
        printBackground: true,
        margin: { top: '16mm', bottom: '16mm', left: '16mm', right: '16mm' },
      });
      const kb = (fs.statSync(t.pdf).size / 1024).toFixed(1);
      made.push({ label: t.label, kb: Number(kb) });
      console.log(`    ${String(kb).padStart(7)} KB  ${path.relative(DIST, t.pdf)}`);
    }
  } finally {
    await browser.close();
  }

  const small = made.filter(m => m.kb < 2);
  console.log(`\nrendered ${made.length} PDFs (${made.length - 1} discipline handouts + 1 combined).`);
  if (small.length) {
    console.log('WARNING: suspiciously small output — ' + small.map(s => `${s.label} ${s.kb}KB`).join(', '));
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(2); });
