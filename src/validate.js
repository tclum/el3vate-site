// Validation gates for the generated site. Runs against dist/ + content/, exits
// non-zero on failure. Plain Node, zero dependencies.
//   node src/validate.js            run all gates against the real build
//   node src/validate.js --selftest feed each gate a broken fixture, prove it fails
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const DIST = path.join(ROOT, 'dist');
const SIM_THRESHOLD = 0.45;

// ---------- shared ----------
// claims.json is the phase-7 claim audit, not a discipline document.
const NOT_A_DOC = new Set(['claims.json']);

function loadDocs(dir) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.json') && !NOT_A_DOC.has(f))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => a.part - b.part);
}
// SITE_URL / FEEDBACK_EMAIL are defined once, at the top of src/build.js. Read
// them from there rather than restating them here, so the gate cannot pass by
// agreeing with a stale copy of the constant it is supposed to be checking.
function buildConstant(name) {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'build.js'), 'utf8');
  const m = src.match(new RegExp(`^const ${name}\\s*=\\s*'([^']+)'`, 'm'));
  if (!m) throw new Error(`could not find \`const ${name} = ...\` in src/build.js`);
  return m[1];
}

function loadClaims() {
  const p = path.join(CONTENT, 'claims.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function textOf(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(textOf).join(' ');
  if (typeof v === 'object') return Object.values(v).map(textOf).join(' ');
  return String(v);
}
const tok = s => (s.toLowerCase().match(/[a-z0-9]+/g) || []);
function walk(dir, ext) {
  const out = [];
  (function rec(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p);
      else if (!ext || p.endsWith(ext)) out.push(p);
    }
  })(dir);
  return out;
}

// ---------- GATE 1: similarity (TF-IDF cosine) ----------
function tfidfPairs(docs, field) {
  const corpus = docs.map(d => tok(textOf(d[field])));
  const N = corpus.length, df = {};
  corpus.forEach(t => new Set(t).forEach(w => df[w] = (df[w] || 0) + 1));
  const idf = w => Math.log(N / (df[w] || 1)) + 1;
  const vecs = corpus.map(t => {
    const tf = {}; t.forEach(w => tf[w] = (tf[w] || 0) + 1);
    const v = {}; for (const w in tf) v[w] = tf[w] * idf(w); return v;
  });
  const cos = (a, b) => {
    let dot = 0, na = 0, nb = 0;
    for (const w in a) { na += a[w] * a[w]; if (b[w]) dot += a[w] * b[w]; }
    for (const w in b) nb += b[w] * b[w];
    return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  };
  const pairs = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++)
    pairs.push({ a: docs[i].slug, b: docs[j].slug, sim: cos(vecs[i], vecs[j]) });
  return pairs;
}
function similarityGate(docs) {
  const fields = ['tryTuesday', 'replaces', 'aiFailsHere', 'rubric'];
  const all = [];
  const perField = {};
  for (const f of fields) {
    const pairs = tfidfPairs(docs, f);
    perField[f] = pairs.slice().sort((x, y) => y.sim - x.sim);
    pairs.forEach(p => all.push({ field: f, ...p }));
  }
  all.sort((a, b) => b.sim - a.sim);
  const over = all.filter(p => p.sim > SIM_THRESHOLD);
  return { pass: over.length === 0, top: all.slice(0, 10), over, perField, max: all[0] ? all[0].sim : 0 };
}

// ---------- GATE 2: link integrity ----------
function linkGate(distDir, docs) {
  const problems = [];
  const files = walk(distDir, '.html');
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const dir = path.dirname(file);
    const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]);
    for (let ref of refs) {
      if (/^(https?:|mailto:|data:|#)/.test(ref)) continue; // external / in-page anchor
      ref = ref.split('#')[0].split('?')[0];
      if (!ref) continue;
      const target = path.resolve(dir, ref);
      if (!fs.existsSync(target)) problems.push(`${path.relative(distDir, file)} -> ${ref} (missing)`);
    }
  }
  // every related slug must have a built page
  for (const d of docs) for (const r of (d.related || [])) {
    if (!fs.existsSync(path.join(distDir, r.slug, 'index.html')))
      problems.push(`${d.slug}.related -> ${r.slug} (no built page)`);
  }
  return { pass: problems.length === 0, problems };
}

// ---------- GATE 3: reciprocity ----------
function reciprocityGate(docs) {
  const bySlug = Object.fromEntries(docs.map(d => [d.slug, d]));
  const problems = [];
  for (const d of docs) for (const r of (d.related || [])) {
    const o = bySlug[r.slug];
    if (!o) { problems.push(`${d.slug} -> ${r.slug} (orphan)`); continue; }
    if (!(o.related || []).some(x => x.slug === d.slug))
      problems.push(`${d.slug} -> ${r.slug} but ${r.slug} does not list ${d.slug}`);
  }
  return { pass: problems.length === 0, problems };
}

// ---------- GATE 4: contrast ----------
function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function rgbFromStr(s, vars) {
  s = s.trim();
  const vm = s.match(/var\((--[a-z0-9-]+)\)/i);
  if (vm) return vars[vm[1]] ? hexToRgb(vars[vm[1]]) : null;
  const hm = s.match(/#[0-9a-f]{3,6}\b/i);
  if (hm) return hexToRgb(hm[0]);
  const rm = s.match(/rgb\(([^)]+)\)/i);
  if (rm) { const p = rm[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2] }; }
  return null;
}
function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function lum(x) { return 0.2126 * lin(x.r) + 0.7152 * lin(x.g) + 0.0722 * lin(x.b); }
function ratio(a, b) { const L1 = lum(a), L2 = lum(b); const hi = Math.max(L1, L2), lo = Math.min(L1, L2); return (hi + 0.05) / (lo + 0.05); }
function stripMedia(css) {
  // remove @media blocks (print overrides, responsive layout) so only base
  // screen rules are contrast-checked; handles nested braces.
  let out = '', i = 0;
  while (i < css.length) {
    if (css.startsWith('@media', i)) {
      const brace = css.indexOf('{', i);
      if (brace === -1) { out += css.slice(i); break; }
      let depth = 1, j = brace + 1;
      while (j < css.length && depth > 0) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
      i = j;
    } else { out += css[i]; i++; }
  }
  return out;
}
function contrastGate(cssRaw) {
  const css = stripMedia(cssRaw);
  // resolve :root vars
  const vars = {};
  const root = css.match(/:root\s*\{([^}]*)\}/);
  if (root) for (const m of root[1].matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-f]{3,6})/gi)) vars[m[1]] = m[2];
  // dark-context selectors sit on the mat green; everything else on paper (conservative: paper is darker than card)
  const MAT = hexToRgb(vars['--mat'] || '#17352C');
  const PAPER = hexToRgb(vars['--paper'] || '#F3F5F0');
  const isDark = sel => /hero|\.tt\b|chip|backlink|eyebrow/.test(sel);
  const pairs = [];
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const sel = m[1].trim(), body = m[2];
    if (sel.startsWith('@') || sel.includes(':root')) continue;
    const colorM = body.match(/(?:^|;)\s*color\s*:\s*([^;]+)/);
    if (!colorM) continue;
    const fg = rgbFromStr(colorM[1], vars);
    if (!fg) continue;
    const bgM = body.match(/background(?:-color)?\s*:\s*([^;]+)/);
    let bg = bgM ? rgbFromStr(bgM[1], vars) : null;
    if (!bg) bg = isDark(sel) ? MAT : PAPER;
    // font size -> large-text threshold
    const fsM = body.match(/font-size\s*:\s*([0-9.]+)(px|rem)/);
    let large = false;
    if (fsM) { const v = parseFloat(fsM[1]) * (fsM[2] === 'rem' ? 17 : 1); large = v >= 24; }
    if (/clamp\(|font-size:\s*[0-9.]+rem/.test(body) && /h1|nm|be|score/.test(sel)) large = true;
    const need = large ? 3.0 : 4.5;
    const r = ratio(fg, bg);
    pairs.push({ sel: sel.slice(0, 42), ratio: r, need, pass: r >= need });
  }
  const failures = pairs.filter(p => !p.pass);
  return { pass: failures.length === 0, failures, count: pairs.length };
}

// ---------- GATE 5: offline (demos) ----------
function offlineGate(demoFiles) {
  const bad = /fetch\(|XMLHttpRequest|\bapi\.|import\(|https?:\/\//;
  const hits = [];
  for (const f of demoFiles) {
    for (const line of f.text.split('\n').map((t, i) => ({ t, i }))) {
      const m = line.t.match(bad);
      if (m) hits.push(`${f.name}:${line.i + 1} "${m[0]}"`);
    }
  }
  return { pass: hits.length === 0, hits };
}

// ---------- GATE 6: completeness ----------
function completenessGate(docs) {
  const REQ = ['tryTuesday', 'replaces', 'aiFailsHere', 'rubric', 'budget', 'scales', 'related', 'prompt', 'make', 'build', 'plan', 'hook'];
  const problems = [];
  for (const d of docs) {
    for (const k of REQ) {
      const v = d[k];
      const empty = v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
      if (empty) problems.push(`${d.slug}: empty required field "${k}"`);
    }
  }
  // scales.fourWeeks must not say "four-week" when the plan is not four weeks.
  // The key name is a misnomer for the two five-week disciplines (renaming it is
  // a schema change across all 15 files — see BLOCKERS.md); this at least stops
  // the *prose* from contradicting plan[].
  for (const d of docs) {
    const txt = textOf(d.scales && d.scales.fourWeeks);
    const n = (d.plan || []).length;
    if (n !== 4 && /four[- ]week/i.test(txt))
      problems.push(`${d.slug}: scales.fourWeeks says "four-week" but plan is ${n} weeks`);
  }

  // promptOutput: non-null must not be identical across two disciplines
  const seen = {};
  for (const d of docs) {
    const po = d.promptOutput;
    if (po && po.output) {
      const key = po.output.trim();
      if (seen[key]) problems.push(`${d.slug}: identical promptOutput to ${seen[key]}`);
      else seen[key] = d.slug;
    }
  }
  return { pass: problems.length === 0, problems };
}

// ---------- GATE 7: claim audit (phase 7) ----------
// Two obligations, both enforced here:
//   (a) a claim audited `refuted` must not survive verbatim in dist/. The one
//       exception is a claim inside a promptOutput transcript — those are real
//       model output, preserved unedited on purpose — so instead we require that
//       transcript's annotations to name the error explicitly.
//   (b) a claim audited `unverifiable` and flagged `marker: true` must render
//       inside its visible `unverified` marker, never bare.
const escHtml = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function claimGate(claims, docs, distDir) {
  const problems = [];
  const counts = { verified: 0, refuted: 0, unverifiable: 0 };
  if (!claims) return { pass: false, problems: ['content/claims.json not found — the phase 7 audit is missing'], counts };

  const bySlug = Object.fromEntries(docs.map(d => [d.slug, d]));
  // audit.html is the human-readable claim audit itself — it quotes every claim,
  // including refuted ones, by design, so it is excluded from the verbatim scan.
  const files = walk(distDir, '.html').concat(walk(distDir, '.md'))
    .filter(p => path.basename(p) !== 'audit.html')
    .map(p => ({ name: path.relative(distDir, p), text: fs.readFileSync(p, 'utf8') }));

  for (const c of (claims.claims || [])) {
    if (counts[c.status] === undefined) { problems.push(`${c.id}: unknown status "${c.status}"`); continue; }
    counts[c.status]++;

    // A `verified` claim with no source is not a verified claim — it is an
    // unexamined one wearing the label, which is the exact failure this whole
    // phase exists to catch. Fail the build rather than let it pass as checked.
    if (c.status === 'verified' && !c.verifiedAgainst)
      problems.push(`${c.id}: status "verified" but no verifiedAgainst URL — a claim is not verified until a source says so`);

    // Any claim preserved inside a transcript must be named in that transcript's
    // annotations, whichever way the audit came out. Transcripts are never
    // edited, so the annotation is the only place the correction can live.
    if (c.inTranscript && (c.status === 'refuted' || c.status === 'unverifiable')) {
      const slug = path.basename(String(c.file).split(',')[0].trim(), '.json');
      const d = bySlug[slug];
      const ann = d && d.promptOutput ? JSON.stringify(d.promptOutput.annotations || []) : '';
      if (!c.annotationMustContain)
        problems.push(`${c.id}: ${c.status} + inTranscript but declares no annotationMustContain`);
      else if (!ann.includes(c.annotationMustContain))
        problems.push(`${c.id}: ${c.status} claim preserved in ${slug} transcript, but no annotation names it (looking for "${c.annotationMustContain}")`);
    }

    if (c.status === 'refuted' && !c.inTranscript) {
      for (const f of files) {   // `files` already excludes audit.html, see above
        if (f.text.includes(c.claim) || f.text.includes(escHtml(c.claim)))
          problems.push(`${c.id}: refuted claim still appears verbatim in dist/${f.name}`);
      }
    }

    if (c.status === 'unverifiable' && c.marker) {
      for (const s of (c.markedSpans || [])) {
        const slug = path.basename(s.file, '.json');
        const rendered = files.filter(f => f.name.startsWith(slug + '/'));
        if (!rendered.length) { problems.push(`${c.id}: no rendered page found for ${slug}`); continue; }
        for (const f of rendered) {
          const needle = f.name.endsWith('.html') ? escHtml(s.text) : s.text;
          const at = f.text.indexOf(needle);
          if (at === -1) { problems.push(`${c.id}: marked span absent from dist/${f.name}`); continue; }
          if (!/unverified/i.test(f.text.slice(at, at + needle.length + 240)))
            problems.push(`${c.id}: unverifiable claim renders without its marker in dist/${f.name}`);
        }
      }
    }
  }
  return { pass: problems.length === 0, problems, counts };
}

// ---------- GATE 8: handout artifacts (phase 9) ----------
// Every discipline must ship a handout someone can actually take away: the
// markdown source plus a rendered artifact — handout.pdf where a local renderer
// exists, handout.html where one does not. A 400-byte "handout" is a rendering
// failure that still leaves a file on disk, so every artifact must clear 2KB.
const MIN_HANDOUT = 2048;

function handoutGate(distDir, docs) {
  const problems = [];
  const rows = [];
  for (const d of docs) {
    const dir = path.join(distDir, d.slug);
    const md = path.join(dir, 'handout.md');
    const pdf = path.join(dir, 'handout.pdf');
    const html = path.join(dir, 'handout.html');

    if (!fs.existsSync(md)) problems.push(`${d.slug}: no handout.md`);
    else if (fs.statSync(md).size < MIN_HANDOUT)
      problems.push(`${d.slug}: handout.md is ${fs.statSync(md).size}B, under the ${MIN_HANDOUT}B floor`);

    const rendered = [pdf, html].filter(p => fs.existsSync(p));
    if (!rendered.length) { problems.push(`${d.slug}: no rendered handout artifact (neither handout.pdf nor handout.html)`); continue; }
    for (const p of rendered) {
      const size = fs.statSync(p).size;
      if (size < MIN_HANDOUT)
        problems.push(`${d.slug}: ${path.basename(p)} is ${size}B, under the ${MIN_HANDOUT}B floor`);
    }
    rows.push({ slug: d.slug, kind: fs.existsSync(pdf) ? 'pdf' : 'html', kb: (fs.statSync(rendered[0]).size / 1024).toFixed(1) });
  }

  // the combined handout
  const combined = ['all-handouts.pdf', 'all-handouts.html'].map(f => path.join(distDir, f)).filter(p => fs.existsSync(p));
  if (!combined.length) problems.push('no combined handout (neither all-handouts.pdf nor all-handouts.html)');
  else for (const p of combined) {
    if (fs.statSync(p).size < MIN_HANDOUT)
      problems.push(`${path.basename(p)} is ${fs.statSync(p).size}B, under the ${MIN_HANDOUT}B floor`);
  }

  const pdfs = rows.filter(r => r.kind === 'pdf').length;
  return { pass: problems.length === 0, problems, rows, pdfs, combined: combined.map(p => path.basename(p)) };
}

// ---------- GATE 9: presenter kit (phase 10) ----------
// The presenter page is driven live, possibly with the network down, and is not
// meant to be discoverable. Each of those properties is one careless edit away
// from being lost, so each is a check:
//   (a) it exists and is marked noindex
//   (b) nothing else in dist/ links to it
//   (c) it loads NO subresource over the network — no CDN font, stylesheet,
//       script or image. Text mentions of the site URL are fine; a fetch is not.
//   (d) every demo it links to has an embedded fallback still
//   (e) the QR is present and inline
function presenterGate(distDir, docs) {
  const problems = [];
  const file = path.join(distDir, 'presenter', 'index.html');
  if (!fs.existsSync(file)) return { pass: false, problems: ['dist/presenter/index.html not found'], stills: 0 };
  const html = fs.readFileSync(file, 'utf8');

  if (!/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html))
    problems.push('presenter page is not marked noindex');

  // (b) nothing links to it
  for (const p of walk(distDir, '.html')) {
    if (p === file) continue;
    const t = fs.readFileSync(p, 'utf8');
    if (/(?:href|src)="[^"]*presenter\//.test(t))
      problems.push(`${path.relative(distDir, p)} links to the presenter page, which is supposed to be unlinked`);
  }

  // (c) no network subresources
  for (const m of html.matchAll(/<(link|script|img|iframe|source)\b[^>]*\b(?:href|src)="([^"]+)"/gi)) {
    if (/^https?:|^\/\//i.test(m[2]))
      problems.push(`presenter page loads an external subresource: <${m[1]}> ${m[2].slice(0, 70)}`);
  }
  for (const m of html.matchAll(/@import|url\(\s*['"]?https?:/gi))
    problems.push(`presenter page CSS reaches the network: ${m[0]}`);
  if (/fonts\.(googleapis|gstatic)\.com/.test(html))
    problems.push('presenter page references CDN fonts — it must render with the network down');

  // (d) a fallback still per linked demo
  const linked = [...html.matchAll(/href="\.\.\/demos\/([^/"]+)\//g)].map(m => m[1]);
  const uniqLinked = [...new Set(linked)];
  const stills = (html.match(/src="data:image\/png;base64,/g) || []).length;
  const expected = docs.filter(d => d.demo).length;
  if (uniqLinked.length !== expected)
    problems.push(`presenter links ${uniqLinked.length} demos but ${expected} disciplines declare one`);
  if (stills < uniqLinked.length)
    problems.push(`presenter embeds ${stills} fallback stills for ${uniqLinked.length} linked demos`);

  // (e) inline QR
  if (!/<svg[^>]*viewBox="0 0 \d+ \d+"/.test(html))
    problems.push('presenter page has no inline QR svg');

  return { pass: problems.length === 0, problems, stills, linked: uniqLinked.length, kb: (html.length / 1024).toFixed(0) };
}

// ---------- GATE 10: session-day artifacts (phase 11) ----------
// The QR, the closing card and the feedback links all encode the same two
// constants. The failure that matters is a silent one: a QR or a card that
// points at a hostname frozen to a single deployment, which works when it is
// tested and is dead the next time the site ships. That is checked explicitly
// across all of dist/, not just on the card.
const DEPLOY_HOSTNAME = /\b[a-z0-9-]*-[a-z0-9]{7,}-[a-z0-9-]+\.vercel\.app/i;

function sessionGate(distDir, docs, siteUrl, feedbackEmail) {
  const problems = [];

  // (a) the standalone QR
  const qrPath = path.join(distDir, 'qr.svg');
  if (!fs.existsSync(qrPath)) problems.push('dist/qr.svg not found');
  else {
    const qr = fs.readFileSync(qrPath, 'utf8');
    if (!/^<svg[^>]*viewBox="0 0 \d+ \d+"/.test(qr.trim())) problems.push('dist/qr.svg is not an SVG with a viewBox');
    if (/<script/i.test(qr)) problems.push('dist/qr.svg contains a script — the runtime output must be static');
    const meta = path.join(ROOT, 'assets', 'qr.json');
    if (!fs.existsSync(meta)) problems.push('assets/qr.json not found — cannot confirm which URL the QR encodes');
    else {
      const enc = JSON.parse(fs.readFileSync(meta, 'utf8')).url;
      if (enc !== siteUrl) problems.push(`the QR encodes ${enc} but SITE_URL is ${siteUrl}`);
    }
  }

  // (b) the closing card
  const card = path.join(distDir, 'closing-card.html');
  if (!fs.existsSync(card)) problems.push('dist/closing-card.html not found');
  else {
    const html = fs.readFileSync(card, 'utf8');
    if (!html.includes(siteUrl)) problems.push('closing card does not show SITE_URL');
    if (!/<svg[^>]*viewBox="0 0 \d+ \d+"/.test(html)) problems.push('closing card has no inline QR');
    for (const m of html.matchAll(/<(link|script|img)\b[^>]*\b(?:href|src)="(https?:|\/\/)[^"]*"/gi))
      problems.push(`closing card loads an external subresource: ${m[0].slice(0, 60)}`);
  }

  // (c) feedback link on every discipline page
  let withFeedback = 0;
  for (const d of docs) {
    const p = path.join(distDir, d.slug, 'index.html');
    if (!fs.existsSync(p)) { problems.push(`${d.slug}: no built page to carry a feedback link`); continue; }
    const html = fs.readFileSync(p, 'utf8');
    const m = html.match(/href="mailto:([^"?]+)\?([^"]*)"/);
    if (!m) { problems.push(`${d.slug}: no mailto feedback link`); continue; }
    if (m[1] !== feedbackEmail)
      problems.push(`${d.slug}: feedback goes to ${m[1]}, not the FEEDBACK_EMAIL constant ${feedbackEmail}`);
    const params = new URLSearchParams(m[2].replace(/&amp;/g, '&'));
    const subject = params.get('subject') || '';
    if (!subject.includes(d.name))
      problems.push(`${d.slug}: mailto subject "${subject}" does not name the discipline`);
    if (!/what|happen/i.test(params.get('body') || ''))
      problems.push(`${d.slug}: mailto body does not ask what they tried and what happened`);
    withFeedback++;
  }

  // (d) no deployment-frozen hostname anywhere in the built site
  for (const f of walk(distDir, '.html').concat(walk(distDir, '.md'), walk(distDir, '.svg'))) {
    const hit = fs.readFileSync(f, 'utf8').match(DEPLOY_HOSTNAME);
    if (hit) problems.push(`${path.relative(distDir, f)} references a deployment-specific hostname ${hit[0]} — ` +
      'those are frozen to one build and go stale on the next deploy');
  }

  return { pass: problems.length === 0, problems, withFeedback };
}

// ---------- runner ----------
function runAll() {
  const docs = loadDocs(CONTENT);
  if (!fs.existsSync(DIST)) { console.error('dist/ not found — run `node src/build.js` first.'); process.exit(2); }
  const css = (fs.readFileSync(path.join(DIST, 'index.html'), 'utf8').match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  const demoFiles = walk(path.join(DIST, 'demos'), '.html').map(p => ({ name: path.relative(DIST, p), text: fs.readFileSync(p, 'utf8') }));

  const results = [];
  const sim = similarityGate(docs);
  console.log('\n[1] SIMILARITY  ' + (sim.pass ? 'PASS' : 'FAIL') + `  (max ${sim.max.toFixed(3)}, threshold ${SIM_THRESHOLD})`);
  console.log('    top 10 most-similar pairs:');
  sim.top.forEach(p => console.log(`      ${p.sim.toFixed(3)}  [${p.field}] ${p.a} ~ ${p.b}`));
  if (!sim.pass) sim.over.forEach(p => console.log(`    OVER: ${p.sim.toFixed(3)} [${p.field}] ${p.a} ~ ${p.b}`));
  results.push(['similarity', sim.pass]);

  const link = linkGate(DIST, docs);
  console.log('\n[2] LINK INTEGRITY  ' + (link.pass ? 'PASS' : 'FAIL'));
  link.problems.forEach(p => console.log('    ' + p));
  results.push(['link-integrity', link.pass]);

  const recip = reciprocityGate(docs);
  console.log('\n[3] RECIPROCITY  ' + (recip.pass ? 'PASS' : 'FAIL'));
  recip.problems.forEach(p => console.log('    ' + p));
  results.push(['reciprocity', recip.pass]);

  const con = contrastGate(css);
  console.log('\n[4] CONTRAST  ' + (con.pass ? 'PASS' : 'FAIL') + `  (${con.count} fg/bg pairs checked)`);
  con.failures.forEach(f => console.log(`    FAIL ${f.ratio.toFixed(2)}:1 (need ${f.need}) — ${f.sel}`));
  results.push(['contrast', con.pass]);

  const off = offlineGate(demoFiles);
  console.log('\n[5] OFFLINE (demos)  ' + (off.pass ? 'PASS' : 'FAIL') + `  (${demoFiles.length} demo files)`);
  off.hits.forEach(h => console.log('    ' + h));
  results.push(['offline', off.pass]);

  const comp = completenessGate(docs);
  console.log('\n[6] COMPLETENESS  ' + (comp.pass ? 'PASS' : 'FAIL'));
  comp.problems.forEach(p => console.log('    ' + p));
  results.push(['completeness', comp.pass]);

  const cl = claimGate(loadClaims(), docs, DIST);
  console.log('\n[7] CLAIM AUDIT  ' + (cl.pass ? 'PASS' : 'FAIL') +
    `  (${cl.counts.verified} verified, ${cl.counts.refuted} refuted, ${cl.counts.unverifiable} unverifiable)`);
  cl.problems.forEach(p => console.log('    ' + p));
  results.push(['claim-audit', cl.pass]);

  const ho = handoutGate(DIST, docs);
  console.log('\n[8] HANDOUT ARTIFACTS  ' + (ho.pass ? 'PASS' : 'FAIL') +
    `  (${ho.rows.length}/${docs.length} disciplines, ${ho.pdfs} as PDF, combined: ${ho.combined.join(' + ') || 'none'})`);
  ho.problems.forEach(p => console.log('    ' + p));
  results.push(['handouts', ho.pass]);

  const pk = presenterGate(DIST, docs);
  console.log('\n[9] PRESENTER KIT  ' + (pk.pass ? 'PASS' : 'FAIL') +
    `  (${pk.linked} demos linked, ${pk.stills} fallback stills embedded, ${pk.kb} KB self-contained)`);
  pk.problems.forEach(p => console.log('    ' + p));
  results.push(['presenter', pk.pass]);

  const siteUrl = buildConstant('SITE_URL');
  const feedbackEmail = buildConstant('FEEDBACK_EMAIL');
  const sd = sessionGate(DIST, docs, siteUrl, feedbackEmail);
  console.log('\n[10] SESSION-DAY ARTIFACTS  ' + (sd.pass ? 'PASS' : 'FAIL') +
    `  (qr.svg + closing-card.html, ${sd.withFeedback}/${docs.length} feedback links)`);
  console.log(`     SITE_URL       ${siteUrl}`);
  console.log(`     FEEDBACK_EMAIL ${feedbackEmail}`);
  sd.problems.forEach(p => console.log('     ' + p));
  results.push(['session-artifacts', sd.pass]);

  const failed = results.filter(r => !r[1]).map(r => r[0]);
  console.log('\n' + (failed.length ? 'VALIDATION FAILED: ' + failed.join(', ') : 'ALL GATES PASS'));
  process.exit(failed.length ? 1 : 0);
}

// ---------- selftest: prove every gate can fail ----------
function selftest() {
  const base = loadDocs(CONTENT);
  let allOk = true;
  const check = (name, res, broke) => {
    const ok = !res.pass; allOk = allOk && ok;
    console.log(`  ${ok ? 'OK  ' : 'BAD '} ${name}: fixture => ${res.pass ? 'PASS (gate did NOT catch it!)' : 'FAIL (caught)'}  | ${broke}`);
  };

  // 1 similarity: duplicate one doc's sections onto another
  let d = JSON.parse(JSON.stringify(base));
  d[1].tryTuesday = d[0].tryTuesday; d[1].aiFailsHere = d[0].aiFailsHere;
  d[1].replaces = d[0].replaces; d[1].rubric = d[0].rubric;
  check('similarity', similarityGate(d), `copied ${base[0].slug} sections onto ${base[1].slug}`);

  // 2 link integrity: fake dist with a dangling href
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'vtest-'));
  fs.writeFileSync(path.join(tmp, 'index.html'), '<a href="nope/missing.html">x</a>');
  check('link-integrity', linkGate(tmp, []), 'href to nope/missing.html');
  fs.rmSync(tmp, { recursive: true, force: true });

  // 3 reciprocity: A lists B, B does not list A
  d = JSON.parse(JSON.stringify(base));
  d[0].related = [{ slug: d[5].slug, reason: 'x' }];
  d[5].related = (d[5].related || []).filter(r => r.slug !== d[0].slug);
  check('reciprocity', reciprocityGate(d), `${base[0].slug} -> ${base[5].slug} one-way`);

  // 4 contrast: light-grey text on white
  check('contrast', contrastGate(':root{--paper:#FFFFFF}\n.x{color:#CCCCCC;background:#FFFFFF;font-size:14px}'),
    '#CCCCCC text on #FFFFFF (~1.6:1)');

  // 5 offline: a demo that calls fetch
  check('offline', offlineGate([{ name: 'evil/index.html', text: 'const x = fetch("https://api.example.com/x");' }]),
    'demo containing fetch( + https://');

  // 6 completeness: blank a required field + duplicate promptOutput
  d = JSON.parse(JSON.stringify(base));
  d[2].tryTuesday = '';
  check('completeness', completenessGate(d), `emptied ${base[2].slug}.tryTuesday`);

  // 6b plan-length vs scales prose: a five-week plan still calling itself four-week
  d = JSON.parse(JSON.stringify(base));
  d[0].plan = d[0].plan.concat([{ wk: 'Wk 5', txt: 'added a fifth week' }]);
  d[0].scales.fourWeeks = 'The seeded four-week plan: still claims four weeks.';
  check('completeness (plan length vs scales prose)', completenessGate(d),
    `${base[0].slug} plan grown to 5 weeks while scales.fourWeeks still says "four-week"`);

  // 7 claim audit — three separate failure modes, each on its own fixture
  const ctmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ctest-'));
  fs.mkdirSync(path.join(ctmp, 'fake'), { recursive: true });
  fs.writeFileSync(path.join(ctmp, 'fake', 'index.html'),
    '<p>the moon is made of green cheese</p><p>roughly $99 per student in unobtanium</p>');

  check('claim-audit (refuted survived)', claimGate(
    { claims: [{ id: 'FIX-A', file: 'content/fake.json', field: 'hook', status: 'refuted', claim: 'the moon is made of green cheese' }] },
    [{ slug: 'fake' }], ctmp), 'refuted claim still rendered verbatim in dist/');

  check('claim-audit (marker missing)', claimGate(
    { claims: [{ id: 'FIX-B', file: 'content/fake.json', field: 'budget.perStudentCost', status: 'unverifiable', marker: true,
      markedSpans: [{ file: 'content/fake.json', text: 'roughly $99 per student in unobtanium' }] }] },
    [{ slug: 'fake' }], ctmp), 'unverifiable claim rendered with no `unverified` marker');

  check('claim-audit (verified, no source)', claimGate(
    { claims: [{ id: 'FIX-D', file: 'content/fake.json', field: 'hook', status: 'verified',
      claim: 'the sky is blue', verifiedAgainst: null }] },
    [{ slug: 'fake' }], ctmp), 'claim marked verified with no verifiedAgainst URL');

  check('claim-audit (transcript unannotated)', claimGate(
    { claims: [{ id: 'FIX-C', file: 'content/fake.json', field: 'promptOutput.output', status: 'refuted',
      claim: 'HRS §999-99 requires it', inTranscript: true, annotationMustContain: '§999-99' }] },
    [{ slug: 'fake', promptOutput: { annotations: [{ marker: 'unrelated', note: 'says nothing about it' }] } }], ctmp),
    'refuted transcript claim with no annotation naming it');

  fs.rmSync(ctmp, { recursive: true, force: true });

  // 8 handout artifacts — two failure modes: missing entirely, and present but
  // truncated (a renderer that wrote a file and then died)
  const htmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'htest-'));
  fs.mkdirSync(path.join(htmp, 'ghost'), { recursive: true });
  fs.writeFileSync(path.join(htmp, 'all-handouts.html'), 'x'.repeat(4096));
  check('handouts (missing artifact)', handoutGate(htmp, [{ slug: 'ghost' }]),
    'discipline directory with no handout.md and no rendered handout');

  fs.writeFileSync(path.join(htmp, 'ghost', 'handout.md'), 'x'.repeat(4096));
  fs.writeFileSync(path.join(htmp, 'ghost', 'handout.pdf'), '%PDF-1.4 truncated');
  check('handouts (artifact under 2KB)', handoutGate(htmp, [{ slug: 'ghost' }]),
    `handout.pdf of 18B against the ${MIN_HANDOUT}B floor`);

  fs.rmSync(path.join(htmp, 'all-handouts.html'));
  fs.writeFileSync(path.join(htmp, 'ghost', 'handout.pdf'), 'x'.repeat(4096));
  check('handouts (no combined handout)', handoutGate(htmp, [{ slug: 'ghost' }]),
    'per-discipline handouts fine, combined all-handouts.* absent');
  fs.rmSync(htmp, { recursive: true, force: true });

  // 9 presenter kit — the ways it silently stops being what it claims:
  // indexable, discoverable, network-dependent, or missing its fallbacks
  const ptmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ptest-'));
  fs.mkdirSync(path.join(ptmp, 'presenter'), { recursive: true });
  const P = path.join(ptmp, 'presenter', 'index.html');
  const good = '<meta name="robots" content="noindex, nofollow">' +
    '<svg viewBox="0 0 27 27"></svg><a href="../demos/only-demo/index.html">d</a>' +
    '<img src="data:image/png;base64,AAAA">';
  const oneDemo = [{ slug: 'x', demo: 'only-demo' }];

  fs.writeFileSync(P, good.replace(/<meta[^>]*>/, ''));
  check('presenter (not noindex)', presenterGate(ptmp, oneDemo), 'robots meta removed');

  fs.writeFileSync(P, good + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">');
  check('presenter (CDN font)', presenterGate(ptmp, oneDemo), 'a CDN stylesheet added to the page');

  fs.writeFileSync(P, good);
  fs.writeFileSync(path.join(ptmp, 'index.html'), '<a href="presenter/index.html">psst</a>');
  check('presenter (linked from the public site)', presenterGate(ptmp, oneDemo),
    'the hub linking to the presenter page');
  fs.rmSync(path.join(ptmp, 'index.html'));

  fs.writeFileSync(P, good.replace('<img src="data:image/png;base64,AAAA">', ''));
  check('presenter (missing fallback still)', presenterGate(ptmp, oneDemo),
    'a linked demo with no embedded still');
  fs.rmSync(ptmp, { recursive: true, force: true });

  // 10 session-day artifacts — the stale-URL failure modes, which are the ones
  // that survive testing and then break in the room
  const stmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'stest-'));
  const URL_OK = 'https://el3vate.vercel.app';
  const mkSession = (cardUrl, mailto) => {
    fs.rmSync(stmp, { recursive: true, force: true });
    fs.mkdirSync(path.join(stmp, 'demo-disc'), { recursive: true });
    fs.writeFileSync(path.join(stmp, 'qr.svg'), '<svg viewBox="0 0 27 27"></svg>');
    fs.writeFileSync(path.join(stmp, 'closing-card.html'),
      `<svg viewBox="0 0 27 27"></svg><p>${cardUrl}</p>`);
    fs.writeFileSync(path.join(stmp, 'demo-disc', 'index.html'), `<a href="${mailto}">fb</a>`);
  };
  const goodMailto = 'mailto:tclum@hawaii.edu?subject=EL3vate%20Day%208%20%E2%80%94%20Demo&amp;' +
    'body=What%20I%20tried%3A%20what%20happened%3F';
  const oneDisc = [{ slug: 'demo-disc', name: 'Demo' }];

  mkSession('https://el3vate-9f3a1c7-tclum-4994s-projects.vercel.app', goodMailto);
  check('session (deployment-frozen hostname)', sessionGate(stmp, oneDisc, URL_OK, 'tclum@hawaii.edu'),
    'closing card pointing at el3vate-<hash>-tclum-4994s-projects.vercel.app');

  mkSession(URL_OK, 'mailto:someone-else@example.com?subject=EL3vate%20Day%208%20%E2%80%94%20Demo&amp;body=what%20happened');
  check('session (feedback bypasses the constant)', sessionGate(stmp, oneDisc, URL_OK, 'tclum@hawaii.edu'),
    'a discipline mailing someone other than FEEDBACK_EMAIL');

  mkSession(URL_OK, 'mailto:tclum@hawaii.edu?subject=Feedback&amp;body=what%20happened');
  check('session (subject does not name the discipline)', sessionGate(stmp, oneDisc, URL_OK, 'tclum@hawaii.edu'),
    'a generic "Feedback" subject line');

  mkSession(URL_OK, goodMailto);
  fs.rmSync(path.join(stmp, 'closing-card.html'));
  check('session (no closing card)', sessionGate(stmp, oneDisc, URL_OK, 'tclum@hawaii.edu'),
    'closing-card.html absent');
  fs.rmSync(stmp, { recursive: true, force: true });

  console.log('\n' + (allOk ? 'SELFTEST PASS: every gate rejected its broken fixture.' : 'SELFTEST FAILED: a gate did not catch its fixture.'));
  process.exit(allOk ? 0 : 1);
}

if (process.argv.includes('--selftest')) selftest(); else runAll();
