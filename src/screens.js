// Phase 10 — capture the presenter kit's fallback screenshots.
//
// The presenter page embeds a still of every demo it links to, so a demo that
// will not load on conference wifi can still be narrated from the picture
// without leaving the page. Those stills are captured here and committed to
// assets/screens/ rather than generated into dist/, for two reasons: src/build.js
// stays zero-dependency and can produce a complete presenter page on a machine
// with no browser, and the stills are reproducible input rather than build
// output that vanishes on the next `rmrf(DIST)`.
//
// Run after a change to any demo:  node src/screens.js
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DEMOS = path.join(ROOT, 'demos');
const OUT = path.join(ROOT, 'assets', 'screens');

// Some demos are inert until something is clicked. A still of an empty audit
// panel is useless to narrate from, so each demo is put into the state the
// presenter will actually be showing before the shutter fires.
const PREP = {
  'a11y-audit': async page => { await page.locator('#run').click(); },
  'tradition-critique': async page => {
    for (const i of [2, 3]) await page.locator('#arg button.s').nth(i).click();
  },
  'break-even': async page => { await page.locator('#vol').fill('1400'); },
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const slugs = fs.readdirSync(DEMOS, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name).sort();

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 720 }, deviceScaleFactor: 1 });
  const rows = [];
  try {
    for (const slug of slugs) {
      const src = path.join(DEMOS, slug, 'index.html');
      if (!fs.existsSync(src)) continue;
      await page.goto('file://' + src, { waitUntil: 'load' });
      if (PREP[slug]) await PREP[slug](page);
      const out = path.join(OUT, slug + '.png');
      await page.screenshot({ path: out, fullPage: true });
      const kb = fs.statSync(out).size / 1024;
      rows.push({ slug, kb });
      console.log(`    ${kb.toFixed(1).padStart(7)} KB  assets/screens/${slug}.png`);
    }
  } finally {
    await browser.close();
  }
  const total = rows.reduce((s, r) => s + r.kb, 0);
  console.log(`\ncaptured ${rows.length} demo stills, ${total.toFixed(0)} KB total ` +
    `(~${(total * 1.37).toFixed(0)} KB once base64-inlined into the presenter page).`);
  const empty = rows.filter(r => r.kb < 5);
  if (empty.length) {
    console.log('WARNING: near-empty capture — ' + empty.map(e => e.slug).join(', '));
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(2); });
