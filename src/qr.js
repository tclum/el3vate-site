// Phase 10/11 — generate the site's QR code as a static SVG.
//
// The QR is generated here rather than inside src/build.js so that build.js
// stays zero-dependency: the SVG is committed to assets/ as reproducible input,
// and the runtime output is a static SVG with no script and no dependency of
// any kind.
//
// assets/qr.json records which URL was encoded. src/build.js compares that
// against its own SITE_URL constant and FAILS THE BUILD if they disagree, so a
// QR code can never silently point at a stale address after someone edits
// SITE_URL. Re-run this script whenever SITE_URL changes:
//
//   node src/qr.js
'use strict';
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');

// Read SITE_URL straight out of build.js so there is exactly one definition of
// the address in the repository and this script cannot drift from it.
function siteUrl() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'build.js'), 'utf8');
  const m = src.match(/^const SITE_URL\s*=\s*'([^']+)'/m);
  if (!m) throw new Error('could not find `const SITE_URL = ...` at the top of src/build.js');
  return m[1];
}

async function main() {
  const url = siteUrl();
  if (/^https?:\/\/[a-z0-9-]+-[a-f0-9]{6,}-/i.test(url)) {
    console.error(`REFUSING: ${url} looks like a deployment-specific Vercel hostname.`);
    console.error('Those are frozen to one build; a QR printed from one goes stale on the next deploy.');
    console.error('SITE_URL must be the stable production alias.');
    process.exit(1);
  }

  fs.mkdirSync(ASSETS, { recursive: true });
  // Error correction M: readable from a shared screen and tolerant of a camera
  // catching it at an angle, without inflating the module count the way H does.
  const svg = await QRCode.toString(url, {
    type: 'svg', errorCorrectionLevel: 'M', margin: 1,
    color: { dark: '#15211C', light: '#FFFFFF' },
  });
  fs.writeFileSync(path.join(ASSETS, 'qr.svg'), svg);
  fs.writeFileSync(path.join(ASSETS, 'qr.json'), JSON.stringify({
    url, errorCorrectionLevel: 'M', generatedBy: 'src/qr.js',
  }, null, 2) + '\n');

  const modules = (svg.match(/viewBox="0 0 (\d+)/) || [])[1];
  console.log(`QR encoded: ${url}`);
  console.log(`  assets/qr.svg   ${(fs.statSync(path.join(ASSETS, 'qr.svg')).size / 1024).toFixed(1)} KB, ${modules}x${modules} modules`);
  console.log(`  assets/qr.json  records the encoded URL for the build-time staleness check`);

  const decoded = await decodeSvg(svg);
  if (decoded !== url) {
    console.error(`\nDECODE MISMATCH: the SVG scans as ${JSON.stringify(decoded)}, not ${JSON.stringify(url)}`);
    process.exit(1);
  }
  console.log(`  verified: rasterised and scanned back as ${decoded}`);
}

// Trusting the encoder is not the same as knowing the image scans. Render the
// SVG the way a projector would, then read it back with a real QR decoder — the
// failure this guards against (a QR on a shared screen that goes somewhere else,
// or nowhere) is silent and unrecoverable once the room has scanned it.
async function decodeSvg(svg) {
  const { chromium } = require('playwright');
  const jsqrPath = require.resolve('jsqr/dist/jsQR.js');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
    await page.setContent(`<body style="margin:0;background:#fff">${
      svg.replace('<svg', '<svg id="q" width="512" height="512"')}</body>`);
    await page.addScriptTag({ path: jsqrPath });
    return await page.evaluate(async () => {
      const svgEl = document.getElementById('q');
      const blobUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgEl.outerHTML)));
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = blobUrl; });
      const c = document.createElement('canvas');
      c.width = 512; c.height = 512;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, 0, 0, 512, 512);
      const d = ctx.getImageData(0, 0, 512, 512);
      const r = window.jsQR(d.data, d.width, d.height);
      return r ? r.data : null;
    });
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(2); });
