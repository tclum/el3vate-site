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
  const files = walk(distDir, '.html').concat(walk(distDir, '.md'))
    .map(p => ({ name: path.relative(distDir, p), text: fs.readFileSync(p, 'utf8') }));

  for (const c of (claims.claims || [])) {
    if (counts[c.status] === undefined) { problems.push(`${c.id}: unknown status "${c.status}"`); continue; }
    counts[c.status]++;

    if (c.status === 'refuted') {
      if (c.inTranscript) {
        const slug = path.basename(String(c.file).split(',')[0].trim(), '.json');
        const d = bySlug[slug];
        const ann = d && d.promptOutput ? JSON.stringify(d.promptOutput.annotations || []) : '';
        if (!c.annotationMustContain)
          problems.push(`${c.id}: refuted + inTranscript but declares no annotationMustContain`);
        else if (!ann.includes(c.annotationMustContain))
          problems.push(`${c.id}: refuted claim preserved in ${slug} transcript, but no annotation names it (looking for "${c.annotationMustContain}")`);
      } else {
        for (const f of files) {
          if (f.text.includes(c.claim) || f.text.includes(escHtml(c.claim)))
            problems.push(`${c.id}: refuted claim still appears verbatim in dist/${f.name}`);
        }
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

  check('claim-audit (transcript unannotated)', claimGate(
    { claims: [{ id: 'FIX-C', file: 'content/fake.json', field: 'promptOutput.output', status: 'refuted',
      claim: 'HRS §999-99 requires it', inTranscript: true, annotationMustContain: '§999-99' }] },
    [{ slug: 'fake', promptOutput: { annotations: [{ marker: 'unrelated', note: 'says nothing about it' }] } }], ctmp),
    'refuted transcript claim with no annotation naming it');

  fs.rmSync(ctmp, { recursive: true, force: true });

  console.log('\n' + (allOk ? 'SELFTEST PASS: every gate rejected its broken fixture.' : 'SELFTEST FAILED: a gate did not catch its fixture.'));
  process.exit(allOk ? 0 : 1);
}

if (process.argv.includes('--selftest')) selftest(); else runAll();
