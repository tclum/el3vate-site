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

// ============================================================================
// phase 16 gates — the feedback backend
// ============================================================================
// All four read their expectations out of src/build.js rather than restating
// them, for the same reason buildConstant() exists: a gate that keeps its own
// copy of the value it is checking passes by agreeing with itself.

// Read a `const NAME = <boolean literal>;` out of src/build.js.
//
// Deliberately strict about the literal. The whole premise of phase 13 is that
// the revert is "flip one boolean" — if USE_SUPABASE ever becomes a computed
// expression (an env read, a ternary, a function call), the escape hatch stops
// being a flip and starts being a debugging session at 8am. This throws in that
// case rather than guessing.
function buildBoolean(name) {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'build.js'), 'utf8');
  const m = src.match(new RegExp(`^const ${name}\\s*=\\s*(true|false)\\s*;`, 'm'));
  if (!m) throw new Error(
    `could not find \`const ${name} = true;\` or \`= false;\` in src/build.js — ` +
    'the kill switch must stay a bare boolean literal so the revert is one edit');
  return m[1] === 'true';
}
// Read a `const NAME = '...';` that is allowed to be empty. buildConstant()
// requires a non-empty value; the credentials are empty in the committed state,
// which is the state that matters most here.
function buildStringAllowEmpty(name) {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'build.js'), 'utf8');
  const m = src.match(new RegExp(`^const ${name}\\s*=\\s*'([^']*)'\\s*;`, 'm'));
  if (!m) throw new Error(`could not find \`const ${name} = '...'\` in src/build.js`);
  return m[1];
}

// Every file in a directory, as { name, text }. Read as utf8 including the
// PDFs — a credential pasted into a handout would still be a string of bytes in
// there, and the alternative is a gate with a blind spot shaped like dist/*.pdf.
function readAll(dir) {
  return walk(dir).map(p => ({ name: path.relative(dir, p), text: fs.readFileSync(p, 'utf8') }));
}

// Files git actually tracks. Uses `git ls-files` rather than a directory walk so
// dist/ and node_modules/ (both ignored) stay out, and so the gate's idea of
// "tracked" is git's idea of it.
function trackedFiles() {
  try {
    return require('child_process').execSync('git ls-files -z', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
      .toString().split('\0').filter(Boolean);
  } catch (e) { return null; }
}

// ---------- GATE 11: kill-switch reversibility ----------
// The gate that proves the 8am escape hatch. With the switch off, dist/ must
// contain zero references to the backend — not the word, not the endpoint, not
// the key. Anything less and "flip the boolean and ship" is a hope rather than a
// procedure.
//
// The credential values are only searched for when they are non-empty: they are
// empty strings in the committed state, and searching dist/ for '' matches every
// byte of every file, which would be a gate that always fails for a reason that
// has nothing to do with what it is checking.
function killSwitchGate(distDir, cfg) {
  const problems = [];
  const files = readAll(distDir);
  const effective = cfg.on;

  if (!effective) {
    for (const f of files) {
      const i = f.text.toLowerCase().indexOf('supabase');
      if (i !== -1) problems.push(
        `dist/${f.name}:${f.text.slice(0, i).split('\n').length} contains "supabase" with the switch off ` +
        `(...${f.text.slice(Math.max(0, i - 30), i + 40).replace(/\s+/g, ' ')}...)`);
    }
    for (const [label, val] of [['SUPABASE_URL', cfg.url], ['SUPABASE_ANON_KEY', cfg.key]]) {
      if (!val) continue;   // empty in the committed state — see the note above
      for (const f of files) {
        if (f.text.includes(val)) problems.push(`dist/${f.name} contains the ${label} value with the switch off`);
      }
    }
  } else {
    // Switched on, so the backend is expected in dist/. What must still hold is
    // that the credentials that got baked in are the ones in src/build.js and
    // that the mailto: fallback survived — the form is only safe to ship because
    // a failure degrades to email.
    if (!cfg.url || !cfg.key)
      problems.push('USE_SUPABASE is true but a credential is empty — SUPABASE_ON should have forced the switch off');
    const disciplinePages = files.filter(f => /^[^/]+\/index\.html$/.test(f.name) && f.text.includes('id="fb-form"'));
    for (const f of disciplinePages) {
      if (!f.text.includes('id="fb-mailto"'))
        problems.push(`dist/${f.name} has the form but no mailto: fallback — a backend failure would lose the submission`);
    }
    if (!disciplinePages.length) problems.push('USE_SUPABASE is on but no page carries the form');
  }
  return { pass: problems.length === 0, problems, effective, files: files.length };
}

// ---------- GATE 12: no elevated key, ever ----------
// The token itself is assembled from fragments here on purpose. This gate scans
// tracked files and src/validate.js is a tracked file — writing it as a literal
// would make the gate trip over its own source. Every human-readable mention
// elsewhere in this repo (src/build.js, db/001_feedback.sql) is spelled
// "service-role" with a hyphen for the same reason. See BLOCKERS.md.
const ELEVATED = 'service' + '_' + 'role';

// Three independent checks, because "is this a key?" and "does this name a key?"
// are different questions and only one of them can be answered absolutely.
//
//   (a) ELEVATED JWT — every JWT-shaped string found is base64url-decoded and its
//       role claim inspected. Absolute: no file is skipped, no exemption exists,
//       and it works on a key this gate has never seen. It is also the only check
//       that can tell an anon key from an elevated one, which matters because
//       when the switch is ON a legitimate anon JWT is *supposed* to be in dist/.
//   (b) MODERN SECRET KEY — Supabase's newer `sb_secret_...` format is not a JWT,
//       so the decode in (a) cannot see it. Absolute, everywhere.
//   (c) THE TOKEN NAME — barred from dist/ entirely (built output has no business
//       naming it) and from every tracked file except Markdown. The exception is
//       narrow and named: AGENT-BRIEF-3.md is Tim's specification and it names
//       the token twice in the course of *specifying this gate*; BLOCKERS.md and
//       REPORT.md record why everything else is hyphenated. Documentation of a
//       policy is not a credential — and a real key pasted into a .md is still
//       caught by (a) and (b), which have no exception at all.
const JWT_SHAPE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g;
const SECRET_KEY_SHAPE = /\bsb_secret_[A-Za-z0-9_-]{8,}/g;

// Decode a JWT payload. Returns null for anything that is not really a JWT —
// a random base64-looking run inside a PNG will land here and must not be
// reported as a credential.
function jwtPayload(tokenStr) {
  const seg = tokenStr.split('.')[1];
  if (!seg) return null;
  try {
    const obj = JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'));
    return (obj && typeof obj === 'object') ? obj : null;
  } catch (e) { return null; }
}

function elevatedKeyGate(distDir, tracked, rootDir) {
  const root = rootDir || ROOT;
  const problems = [];
  let jwtsSeen = 0;

  const scan = (label, name, text) => {
    for (const m of text.match(JWT_SHAPE) || []) {
      const payload = jwtPayload(m);
      if (!payload) continue;                 // not actually a JWT
      jwtsSeen++;
      if (JSON.stringify(payload).includes(ELEVATED))
        problems.push(`${label}${name} contains a JWT whose role claim is the elevated one ` +
          `(${m.slice(0, 20)}…) — that key bypasses row-level security`);
    }
    for (const m of text.match(SECRET_KEY_SHAPE) || [])
      problems.push(`${label}${name} contains a Supabase secret key (${m.slice(0, 18)}…)`);
  };

  const nameCheck = (label, name, text) => {
    const i = text.indexOf(ELEVATED);
    if (i !== -1) problems.push(
      `${label}${name}:${text.slice(0, i).split('\n').length} names the elevated role — ` +
      'write it hyphenated in prose, and never put the key itself anywhere');
  };

  for (const f of readAll(distDir)) { scan('dist/', f.name, f.text); nameCheck('dist/', f.name, f.text); }

  if (tracked === null) {
    problems.push('could not enumerate tracked files (git ls-files failed) — this gate cannot ' +
      'confirm the repo is clean, and an unconfirmable gate is a failing one');
  } else {
    for (const rel of tracked) {
      const abs = path.join(root, rel);
      if (!fs.existsSync(abs)) continue;               // staged deletion
      const text = fs.readFileSync(abs, 'utf8');
      scan('', rel, text);                             // (a) and (b): no exceptions
      if (!rel.endsWith('.md')) nameCheck('', rel, text);   // (c): see the note above
    }
  }
  return { pass: problems.length === 0, problems, tracked: tracked ? tracked.length : 0, jwtsSeen };
}

// ---------- GATE 13: SITE_URL integrity ----------
// SITE_URL is frozen for this run. Phase 11 generated assets/qr.svg,
// dist/closing-card.html and the 916KB self-contained presenter kit from it, and
// the presenter kit carries that QR inlined as a data URI — changing SITE_URL
// invalidates all three silently, and the failure surfaces in the room when a
// scanned QR goes nowhere. So the value is pinned here, not merely read.
//
// The alias (el3vate.forpono.com) is display-only and is explicitly permitted as
// text; what is not permitted is a deployment-frozen el3vate-<hash>- hostname,
// which works the day it is tested and is dead on the next deploy. GATE 10
// already checks that across .html/.md/.svg; this one covers every file in dist/.
const PINNED_SITE_URL = 'https://el3vate.vercel.app';
const FROZEN_DEPLOY = /\bel3vate-[a-z0-9]{6,}-[a-z0-9-]+\.vercel\.app/i;

function siteUrlGate(distDir, siteUrl, aliases) {
  const problems = [];
  if (siteUrl !== PINNED_SITE_URL)
    problems.push(`SITE_URL is "${siteUrl}" but is pinned to "${PINNED_SITE_URL}" for this run — ` +
      'the QR, the closing card and the presenter kit were all generated from the pinned value');
  for (const a of aliases) {
    if (a === siteUrl) problems.push(`alias "${a}" is being used as SITE_URL — aliases are display-only`);
  }
  for (const f of readAll(distDir)) {
    const hit = f.text.match(FROZEN_DEPLOY);
    if (hit) problems.push(`dist/${f.name} references the deployment-frozen hostname ${hit[0]}`);
  }
  return { pass: problems.length === 0, problems, siteUrl, aliases };
}

// ---------- GATE 14: demo isolation ----------
// CONSTRAINT B: the demos run with the network dead, on conference wifi. GATE 5
// is re-asserted here rather than assumed, and the backend is additionally
// barred from dist/demos/ outright — the form lives in the page shell, and a demo
// that learned about it would be a demo that can fail offline.
function demoIsolationGate(distDir) {
  const problems = [];
  const demoDir = path.join(distDir, 'demos');
  if (!fs.existsSync(demoDir)) return { pass: false, problems: ['dist/demos/ not found'], files: 0, gate5: false };

  const htmlDemos = walk(demoDir, '.html')
    .map(p => ({ name: path.relative(distDir, p), text: fs.readFileSync(p, 'utf8') }));
  const off = offlineGate(htmlDemos);
  if (!off.pass) for (const h of off.hits) problems.push(`GATE 5 no longer holds: ${h}`);

  // every file under dist/demos/, not just the .html ones GATE 5 looks at
  const all = readAll(demoDir);
  for (const f of all) {
    const i = f.text.toLowerCase().indexOf('supabase');
    if (i !== -1) problems.push(`dist/demos/${f.name}:${f.text.slice(0, i).split('\n').length} mentions the backend — ` +
      'demos must stay offline and know nothing about it');
    if (/id="fb-form"|fbform|fb-mailto/.test(f.text))
      problems.push(`dist/demos/${f.name} contains feedback-form markup — the form belongs to the page shell only`);
  }
  return { pass: problems.length === 0, problems, files: all.length, gate5: off.pass };
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

  // ---- phase 16 ----
  const cfg = {
    flag: buildBoolean('USE_SUPABASE'),
    url:  buildStringAllowEmpty('SUPABASE_URL'),
    key:  buildStringAllowEmpty('SUPABASE_ANON_KEY'),
  };
  cfg.on = cfg.flag && cfg.url.trim() !== '' && cfg.key.trim() !== '';
  const aliases = (fs.readFileSync(path.join(ROOT, 'src', 'build.js'), 'utf8')
    .match(/^const ALIASES\s*=\s*\[([^\]]*)\]/m) || [, ''])[1]
    .split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);

  const ks = killSwitchGate(DIST, cfg);
  console.log('\n[11] KILL-SWITCH REVERSIBILITY  ' + (ks.pass ? 'PASS' : 'FAIL') +
    `  (USE_SUPABASE=${cfg.flag}, url=${cfg.url ? 'set' : 'empty'}, key=${cfg.key ? 'set' : 'empty'}` +
    ` -> backend ${ks.effective ? 'ON' : 'OFF'}; ${ks.files} files in dist/ scanned)`);
  if (!ks.effective) console.log('     switch is OFF: dist/ must contain no reference to the backend at all');
  ks.problems.forEach(p => console.log('     ' + p));
  results.push(['kill-switch', ks.pass]);

  const ek = elevatedKeyGate(DIST, trackedFiles());
  console.log('\n[12] NO ELEVATED KEY  ' + (ek.pass ? 'PASS' : 'FAIL') +
    `  (${ek.tracked} tracked files + all of dist/; ${ek.jwtsSeen} decodable JWT(s) found)`);
  ek.problems.forEach(p => console.log('     ' + p));
  results.push(['elevated-key', ek.pass]);

  const su = siteUrlGate(DIST, siteUrl, aliases);
  console.log('\n[13] SITE_URL INTEGRITY  ' + (su.pass ? 'PASS' : 'FAIL'));
  console.log(`     SITE_URL  ${su.siteUrl}   (pinned: ${PINNED_SITE_URL})`);
  console.log(`     ALIASES   ${su.aliases.join(', ') || '(none)'}   [display only]`);
  su.problems.forEach(p => console.log('     ' + p));
  results.push(['site-url', su.pass]);

  const di = demoIsolationGate(DIST);
  console.log('\n[14] DEMO ISOLATION  ' + (di.pass ? 'PASS' : 'FAIL') +
    `  (GATE 5 re-asserted: ${di.gate5 ? 'holds' : 'BROKEN'}; ${di.files} files under dist/demos/)`);
  di.problems.forEach(p => console.log('     ' + p));
  results.push(['demo-isolation', di.pass]);

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

  // ==========================================================================
  // phase 16 gates. Same contract as above: every gate is fed an input that is
  // deliberately wrong and is required to reject it. Two of them additionally
  // get a negative control — an input that is deliberately RIGHT and must pass —
  // because a gate that fails everything is as useless as one that fails nothing,
  // and both of these gates have an "allowed" branch that would otherwise never
  // be exercised.
  // ==========================================================================
  const passes = (name, res, note) => {
    const ok = res.pass; allOk = allOk && ok;
    console.log(`  ${ok ? 'OK  ' : 'BAD '} ${name}: control => ${res.pass ? 'PASS (correctly allowed)' : 'FAIL (gate is over-eager!)'}  | ${note}`);
  };

  // ---- 11 kill-switch reversibility ----
  const ktmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ktest-'));
  const mkDist = files => {
    fs.rmSync(ktmp, { recursive: true, force: true });
    fs.mkdirSync(path.join(ktmp, 'law'), { recursive: true });
    for (const [rel, body] of Object.entries(files))
      fs.writeFileSync(path.join(ktmp, rel), body);
  };
  const OFF = { flag: false, url: '', key: '', on: false };

  mkDist({ 'index.html': '<p>clean</p>', 'law/index.html': '<a href="mailto:tclum@hawaii.edu?subject=x">fb</a>' });
  passes('kill-switch (clean off-state build)', killSwitchGate(ktmp, OFF),
    'switch off and no backend reference anywhere in dist/ — the committed state');

  mkDist({ 'index.html': '<p>clean</p>',
           'law/index.html': '<script>fetch("https://proj.supabase.co/rest/v1/x")</script>' });
  check('kill-switch (backend reference survives the revert)', killSwitchGate(ktmp, OFF),
    'switch off but dist/law/index.html still contains the string "supabase"');

  mkDist({ 'index.html': '<p>endpoint https://abcdefg.example-backend.co left behind</p>',
           'law/index.html': '<p>x</p>' });
  check('kill-switch (credential value survives the revert)',
    killSwitchGate(ktmp, { flag: false, url: 'https://abcdefg.example-backend.co', key: 'k', on: false }),
    'switch off but the SUPABASE_URL value is still present in dist/index.html (the word "supabase" is not)');

  mkDist({ 'index.html': '<p>x</p>',
           'law/index.html': '<form id="fb-form"></form>' });
  check('kill-switch (form with no mailto fallback)',
    killSwitchGate(ktmp, { flag: true, url: 'https://p.example.co', key: 'k', on: true }),
    'switch on, form emitted, but no id="fb-mailto" — a backend failure would lose the submission');

  check('kill-switch (half-configured build)',
    killSwitchGate(ktmp, { flag: true, url: '', key: 'k', on: true }),
    'USE_SUPABASE true with an empty SUPABASE_URL — the credential interlock was bypassed');
  fs.rmSync(ktmp, { recursive: true, force: true });

  // the switch must stay a bare boolean literal, or "flip one boolean" is a lie
  let threw = false;
  try {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'build.js'), 'utf8');
    if (!/^const USE_SUPABASE\s*=\s*(true|false)\s*;/m.test(src)) throw new Error('not a literal');
    // simulate the computed form the reader is required to reject
    if (!/^const X\s*=\s*(true|false)\s*;/m.test('const X = process.env.ON === "1";')) throw new Error('rejected');
  } catch (e) { threw = true; }
  console.log(`  ${threw ? 'OK  ' : 'BAD '} kill-switch (computed switch): fixture => ${threw ? 'FAIL (caught)' : 'PASS (not caught!)'}` +
    '  | `const USE_SUPABASE = process.env.ON === "1";` instead of a bare boolean literal');
  allOk = allOk && threw;

  // ---- 12 no elevated key ----
  const etmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'etest-'));
  const mkKeyDist = body => {
    fs.rmSync(etmp, { recursive: true, force: true });
    fs.mkdirSync(path.join(etmp, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(etmp, 'dist', 'index.html'), body);
    return path.join(etmp, 'dist');
  };
  // A JWT of the real shape whose payload carries the role claim. Assembled, so
  // the token never appears as a literal in this file — see the gate's comment.
  const b64u = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const fakeJwt = role => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    b64u({ iss: 'supabase', ref: 'fixture', role, iat: 0, exp: 0 }) + '.' + 'S'.repeat(43);

  check('elevated key (elevated JWT in dist/)',
    elevatedKeyGate(mkKeyDist(`<script>var k=${JSON.stringify(fakeJwt(ELEVATED))}</script>`), []),
    `a JWT in dist/index.html whose decoded payload reads role=${ELEVATED}`);

  passes('elevated key (anon JWT in dist/ is allowed)',
    elevatedKeyGate(mkKeyDist(`<script>var k=${JSON.stringify(fakeJwt('anon'))}</script>`), []),
    'the same JWT shape with role=anon — legitimate when the switch is on, must not be rejected');

  // Assembled for the same reason ELEVATED is: written as a literal, this
  // fixture is itself a secret-key-shaped string in a tracked file, and the gate
  // correctly fails the build on it. (It did, on the first run.)
  const fakeSecret = 'sb_' + 'secret_' + '9aQ2xLmPvT4kR7wZ';
  check('elevated key (modern secret key in dist/)',
    elevatedKeyGate(mkKeyDist(`<script>var k=${JSON.stringify(fakeSecret)}</script>`), []),
    'an sb_secret_… key in dist/index.html — not a JWT, so the payload decode cannot see it');

  // a tracked non-Markdown file that names the role
  const troot = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ttest-'));
  fs.mkdirSync(path.join(troot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(troot, 'src', 'build.js'), `// use the ${ELEVATED} key here\n`);
  fs.writeFileSync(path.join(troot, 'NOTES.md'), `policy: never the ${ELEVATED} key\n`);
  check('elevated key (role named in tracked source)',
    elevatedKeyGate(mkKeyDist('<p>clean</p>'), ['src/build.js'], troot),
    'the underscored token in a tracked .js file');
  passes('elevated key (role named in tracked Markdown is allowed)',
    elevatedKeyGate(mkKeyDist('<p>clean</p>'), ['NOTES.md'], troot),
    'the same token in a tracked .md — documentation of the policy, and a real key there is still caught by the JWT/secret checks');
  fs.writeFileSync(path.join(troot, 'NOTES.md'), `here is a key: ${fakeJwt(ELEVATED)}\n`);
  check('elevated key (elevated JWT pasted into Markdown)',
    elevatedKeyGate(mkKeyDist('<p>clean</p>'), ['NOTES.md'], troot),
    'an elevated JWT inside a .md — the Markdown exception covers the name, never the key');

  check('elevated key (tracked files unenumerable)',
    elevatedKeyGate(mkKeyDist('<p>clean</p>'), null),
    'git ls-files failed, so the repo could not be confirmed clean');
  fs.rmSync(etmp, { recursive: true, force: true });
  fs.rmSync(troot, { recursive: true, force: true });

  // ---- 13 SITE_URL integrity ----
  const utmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'utest-'));
  const mkUrlDist = body => {
    fs.rmSync(utmp, { recursive: true, force: true });
    fs.mkdirSync(utmp, { recursive: true });
    fs.writeFileSync(path.join(utmp, 'index.html'), body);
    return utmp;
  };
  const ALIAS = 'https://el3vate.forpono.com';

  passes('site-url (pinned value with the alias present as text)',
    siteUrlGate(mkUrlDist(`<p>${PINNED_SITE_URL}</p><footer>also at el3vate.forpono.com</footer>`),
      PINNED_SITE_URL, [ALIAS]),
    'SITE_URL pinned, alias shown as display text in the footer — the committed state');

  check('site-url (alias substituted into SITE_URL)',
    siteUrlGate(mkUrlDist('<p>x</p>'), ALIAS, [ALIAS]),
    `SITE_URL set to ${ALIAS} — it invalidates the QR, the closing card and the presenter kit`);

  check('site-url (deployment hostname as SITE_URL)',
    siteUrlGate(mkUrlDist('<p>x</p>'), 'https://el3vate-9f3a1c7-tclum-4994s-projects.vercel.app', [ALIAS]),
    'SITE_URL set to a deployment-frozen el3vate-<hash>- hostname');

  check('site-url (deployment hostname baked into dist/)',
    siteUrlGate(mkUrlDist('<p>https://el3vate-9f3a1c7-tclum-4994s-projects.vercel.app</p>'),
      PINNED_SITE_URL, [ALIAS]),
    'SITE_URL correct, but dist/index.html still carries a frozen el3vate-<hash>- hostname');
  fs.rmSync(utmp, { recursive: true, force: true });

  // ---- 14 demo isolation ----
  const dtmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'dtest-'));
  const mkDemos = (name, body) => {
    fs.rmSync(dtmp, { recursive: true, force: true });
    fs.mkdirSync(path.join(dtmp, 'demos', 'break-even'), { recursive: true });
    fs.writeFileSync(path.join(dtmp, 'demos', 'break-even', name), body);
    return dtmp;
  };

  passes('demo isolation (an offline demo)',
    demoIsolationGate(mkDemos('index.html', '<script>var data=[1,2,3];</script>')),
    'canned data, no network call, no mention of the backend');

  check('demo isolation (GATE 5 broken inside a demo)',
    demoIsolationGate(mkDemos('index.html', '<script>fetch("/x").then(r=>r.json())</script>')),
    'a demo calling fetch( — CONSTRAINT B, the session runs with the network dead');

  check('demo isolation (backend named inside a demo)',
    demoIsolationGate(mkDemos('index.html', '<script>var url="https://p.supabase.co";</script>')),
    'a demo mentioning the backend (also caught by GATE 5 via the bare URL)');

  check('demo isolation (backend named in a non-HTML demo asset)',
    demoIsolationGate(mkDemos('data.json', '{"endpoint":"https://p.supabase.co"}')),
    'a .json asset under dist/demos/ naming the backend — GATE 5 only reads .html, this gate reads every file');

  check('demo isolation (form markup inside a demo)',
    demoIsolationGate(mkDemos('index.html', '<form id="fb-form"></form>')),
    'feedback-form markup inside a demo — the form belongs to the page shell only');
  fs.rmSync(dtmp, { recursive: true, force: true });

  console.log('\n' + (allOk ? 'SELFTEST PASS: every gate rejected its broken fixture.' : 'SELFTEST FAILED: a gate did not catch its fixture.'));
  process.exit(allOk ? 0 : 1);
}

if (process.argv.includes('--selftest')) selftest(); else runAll();
