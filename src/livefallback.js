// CONSTRAINT B, exercised rather than asserted.
//
//   node src/livefallback.js      exit 0 if every branch behaves, non-zero if not
//
// The brief's CONSTRAINT B says the fallback chain is three deep and EVERY STEP
// MUST BE EXERCISED. GATE 19 in src/validate.js proves the served markup is
// complete before any script runs, which is the static half. This is the runtime
// half: it takes the live-build script OUT OF A REAL BUILT PAGE — it is not
// retyped here, and it cannot drift from what ships — and runs it against a stub
// DOM and a stub fetch, once per branch, asserting what the section shows
// afterwards.
//
// Zero dependencies, same rule as src/validate.js. The DOM stub is two objects
// with a textContent and a style, because two objects with a textContent and a
// style are the entire DOM surface the script touches. The clock is fake so the
// 15-minute and 5-minute stop conditions can be observed in milliseconds.
//
// WHAT THIS IS NOT: a test against a real Supabase endpoint. No request in here
// leaves the machine. See "What could not be run" in REPORT.md.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_URL = 'https://fixture-project.example-backend.co';
const FIXTURE_KEY = 'fixture-anon-key-not-a-real-credential';
const BAKED_TEXT = 'Baked by ./fill.sh at 08:52 — the room asked for a rubric row.';
const TAG_FILLED = 'Built live in session';
const TAG_RESERVED = 'Reserved · live build';

// ---------- build a variant, without writing anything into the repo ----------
// content/ is COPIED rather than symlinked so a baked `liveBuild` can be injected
// for the test without ever touching a tracked file.
function buildVariant(useLive, bakedText) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lfb-'));
  fs.mkdirSync(path.join(tmp, 'src'));
  for (const d of ['demos', 'assets']) fs.symlinkSync(path.join(ROOT, d), path.join(tmp, d));
  fs.mkdirSync(path.join(tmp, 'content'));
  for (const f of fs.readdirSync(path.join(ROOT, 'content'))) {
    let txt = fs.readFileSync(path.join(ROOT, 'content', f), 'utf8');
    if (bakedText && f === 'law.json') {
      const o = JSON.parse(txt);
      o.liveBuild = bakedText;
      txt = JSON.stringify(o, null, 2) + '\n';
    }
    fs.writeFileSync(path.join(tmp, 'content', f), txt);
  }
  let src = fs.readFileSync(path.join(ROOT, 'src', 'build.js'), 'utf8');
  const sub = (name, literal) => {
    const re = new RegExp(`^const ${name}\\s*=\\s*[^;]*;`, 'm');
    if (!re.test(src)) throw new Error(`no \`const ${name} = ...;\` in src/build.js`);
    src = src.replace(re, `const ${name} = ${literal};`);
  };
  sub('USE_SUPABASE', 'false');
  sub('USE_LIVE_FETCH', String(useLive));
  sub('SUPABASE_URL', `'${FIXTURE_URL}'`);
  sub('SUPABASE_ANON_KEY', `'${FIXTURE_KEY}'`);
  fs.writeFileSync(path.join(tmp, 'src', 'build.js'), src);
  execFileSync(process.execPath, [path.join(tmp, 'src', 'build.js')], { stdio: 'pipe' });
  const html = fs.readFileSync(path.join(tmp, 'dist', 'law', 'index.html'), 'utf8');
  fs.rmSync(tmp, { recursive: true, force: true });
  return html;
}

const BEGIN = '/* live-build fetch: begin */';
const END = '/* live-build fetch: end */';
function extractScript(html) {
  const a = html.indexOf(BEGIN);
  if (a === -1) return null;
  const b = html.indexOf(END, a);
  return b === -1 ? null : html.slice(a, b + END.length);
}
function sectionOf(html) {
  const m = html.match(/<section class="sec" id="live-build">[\s\S]*?<\/section>/);
  if (!m) throw new Error('no live-build section in the built page');
  const strip = s => s.replace(/<[^>]*>/g, '').replace(/&middot;/g, '·')
    .replace(/&mdash;/g, '—').replace(/&rsquo;/g, '’').replace(/\s+/g, ' ').trim();
  return {
    tag: strip(m[0].match(/id="lb-tag"[^>]*>([\s\S]*?)<\/p>/)[1]),
    body: strip(m[0].match(/id="lb-body"[^>]*>([\s\S]*?)<\/p>/)[1]),
  };
}

// ---------- stubs ----------
function stubDom(initial) {
  const mk = t => ({ textContent: t, style: {} });
  const els = { 'lb-tag': mk(initial.tag), 'lb-body': mk(initial.body) };
  return { document: { getElementById: id => els[id] || null }, els };
}

// A controllable clock. advance() fires due timers in order without waiting.
function makeClock() {
  let now = 1000000, seq = 0;
  const q = new Map();
  return {
    Date: { now: () => now },
    setTimeout: (fn, ms) => { const k = ++seq; q.set(k, { at: now + ms, fn }); return k; },
    clearTimeout: k => q.delete(k),
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let pick = null;
        for (const [k, v] of q) if (v.at <= target && (!pick || v.at < pick[1].at)) pick = [k, v];
        if (!pick) break;
        now = pick[1].at; q.delete(pick[0]); pick[1].fn();
      }
      now = target;
    },
    pending: () => q.size,
  };
}

// An AbortController on the fake clock, so the 8s ceiling can be seen firing.
function FakeAbortController() {
  const self = this;
  this.signal = { aborted: false, _cbs: [] };
  this.abort = function () {
    if (self.signal.aborted) return;
    self.signal.aborted = true;
    self.signal._cbs.slice().forEach(f => f());
  };
}
function abortError() { const e = new Error('aborted'); e.name = 'AbortError'; return e; }

const flush = () => new Promise(r => setImmediate(r));

async function drive(script, startState, responder, opts) {
  const dom = stubDom(startState);
  const clock = makeClock();
  const debugs = [];
  let calls = 0;
  const fetchStub = (url, init) => { calls++; return responder(url, init, calls); };
  const fn = new Function('document', 'fetch', 'console', 'Date', 'setTimeout', 'clearTimeout',
    'AbortSignal', 'AbortController', script);
  // AbortSignal is left undefined throughout, so the AbortController fallback
  // path is the one under test. opts.abort decides whether even that exists.
  fn(dom.document, fetchStub, { debug: m => debugs.push(String(m)) },
    clock.Date, clock.setTimeout, clock.clearTimeout,
    undefined, opts.abort ? FakeAbortController : undefined);
  await flush();
  for (let i = 0; i < (opts.polls || 0); i++) { clock.advance(20000); await flush(); await flush(); }
  if (opts.advance) { clock.advance(opts.advance); await flush(); await flush(); }
  return {
    tag: dom.els['lb-tag'].textContent,
    body: dom.els['lb-body'].textContent,
    calls, debugs, pending: clock.pending(),
  };
}

// ---------- the cases ----------
const ok = body => () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([{ body }]) });
const FETCHED = 'Live from the dashboard: the room asked for a two-week variant.';

function cases(states) {
  const A = states.placeholder;   // nothing baked
  const B = states.baked;         // ./fill.sh ran
  return [
    { n: '1  200 + text, nothing baked      -> shows FETCHED text',
      from: A, r: ok(FETCHED), o: {}, want: { tag: TAG_FILLED, body: FETCHED } },

    { n: '2  200 + text, text WAS baked     -> FETCHED text replaces baked',
      from: B, r: ok(FETCHED), o: {}, want: { tag: TAG_FILLED, body: FETCHED } },

    { n: '3  non-200 (500)                  -> keeps BAKED text',
      from: B, r: () => Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error('x')) }),
      o: {}, want: { same: true, debugs: 1 } },

    { n: '4  network error                  -> keeps BAKED text',
      from: B, r: () => Promise.reject(new TypeError('Failed to fetch')),
      o: {}, want: { same: true, debugs: 1 } },

    { n: '5  hang, no abort available       -> keeps BAKED text, no stacked requests',
      from: B, r: () => new Promise(() => {}), o: { polls: 2 },
      want: { same: true, calls: 1 } },

    { n: '5b hang, 8s abort available       -> aborts and polling resumes',
      from: B, r: (url, init) => new Promise((_, rej) => {
        const s = init.signal;
        if (s && s._cbs) s._cbs.push(() => rej(abortError()));
      }), o: { polls: 2, abort: true },
      want: { same: true, calls: 2, debugs: 1 } },

    { n: '6  200 + empty array (no row)     -> keeps BAKED text',
      from: B, r: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) }),
      o: {}, want: { same: true, debugs: 1 } },

    { n: '7  200 + body null (seeded row)   -> keeps RESERVED placeholder',
      from: A, r: ok(null), o: {}, want: { same: true, debugs: 1 } },

    { n: '8  200 + whitespace-only body     -> keeps RESERVED placeholder',
      from: A, r: ok('   \n\t  '), o: {}, want: { same: true, debugs: 1 } },

    { n: '9  200 + unreadable JSON          -> keeps BAKED text',
      from: B, r: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('bad')) }),
      o: {}, want: { same: true, debugs: 1 } },

    { n: '10 empty twice, text on poll 3    -> appears with no reload',
      from: A, r: (() => { let n = 0; return () => { n++; return Promise.resolve({ ok: true, status: 200,
        json: () => Promise.resolve([{ body: n >= 3 ? 'Arrived on the third poll.' : null }]) }); }; })(),
      o: { polls: 3 }, want: { tag: TAG_FILLED, body: 'Arrived on the third poll.' } },

    { n: '11 nothing lands, past 15 minutes -> hard stop, timer disarmed',
      from: B, r: ok(null), o: { advance: 16 * 60 * 1000 },
      want: { same: true, pending: 0 } },

    { n: '12 one hit, then 5 quiet minutes  -> quiet stop, timer disarmed',
      from: B, r: ok('Landed once and never changed.'), o: { advance: 6 * 60 * 1000 },
      want: { tag: TAG_FILLED, body: 'Landed once and never changed.', pending: 0 } },
  ];
}

(async () => {
  console.log('CONSTRAINT B — the three-deep fallback chain, exercised branch by branch');
  console.log('The script under test is extracted from a real built page, not retyped here.\n');

  const problems = [];
  const need = (cond, msg) => { if (!cond) problems.push(msg); return cond; };

  const htmlOn = buildVariant(true, null);
  const htmlOnBaked = buildVariant(true, BAKED_TEXT);
  const htmlOff = buildVariant(false, BAKED_TEXT);

  const script = extractScript(htmlOn);
  if (!script) {
    console.error('FAIL: the USE_LIVE_FETCH=true build emitted no fetch script — nothing to exercise.');
    process.exit(1);
  }

  const states = { placeholder: sectionOf(htmlOn), baked: sectionOf(htmlOnBaked) };
  console.log(`  build-time state, nothing baked : "${states.placeholder.tag}" / "${states.placeholder.body.slice(0, 58)}…"`);
  console.log(`  build-time state, ./fill.sh ran : "${states.baked.tag}" / "${states.baked.body}"`);
  need(states.placeholder.tag === TAG_RESERVED,
    `the unfilled heading reads "${states.placeholder.tag}", expected "${TAG_RESERVED}"`);
  need(states.baked.tag === TAG_FILLED,
    `the baked heading reads "${states.baked.tag}", expected "${TAG_FILLED}"`);
  need(states.baked.body === BAKED_TEXT, 'the baked body is not the text ./fill.sh would have written');
  console.log('');

  for (const c of cases(states)) {
    const got = await drive(script, c.from, c.r, c.o);
    const errs = [];
    if (c.want.same) {
      if (got.tag !== c.from.tag) errs.push(`heading changed to "${got.tag}"`);
      if (got.body !== c.from.body) errs.push(`body changed to "${got.body.slice(0, 50)}…"`);
    }
    if (c.want.tag !== undefined && got.tag !== c.want.tag) errs.push(`heading is "${got.tag}", expected "${c.want.tag}"`);
    if (c.want.body !== undefined && got.body !== c.want.body) errs.push(`body is "${got.body.slice(0, 50)}", expected "${c.want.body.slice(0, 50)}"`);
    if (c.want.calls !== undefined && got.calls !== c.want.calls) errs.push(`${got.calls} fetch call(s), expected ${c.want.calls}`);
    if (c.want.debugs !== undefined && got.debugs.length !== c.want.debugs) errs.push(`${got.debugs.length} console.debug line(s), expected ${c.want.debugs}`);
    if (c.want.pending !== undefined && got.pending !== c.want.pending) errs.push(`${got.pending} timer(s) still armed, expected ${c.want.pending}`);
    // Global invariant, checked on every case: at most one console.debug for the
    // whole lifetime of the page, whatever happened and however many polls ran.
    if (got.debugs.length > 1) errs.push(`${got.debugs.length} console.debug lines — the ceiling is one per page`);

    console.log(`  ${errs.length ? 'FAIL' : 'ok  '} ${c.n}`);
    console.log(`         ${got.calls} fetch call(s), ${got.debugs.length} debug line(s)` +
      `${got.debugs.length ? ' ' + JSON.stringify(got.debugs) : ''}, ${got.pending} timer(s) armed`);
    if (errs.length) { errs.forEach(e => console.log(`         -> ${e}`)); problems.push(`${c.n}: ${errs.join('; ')}`); }
  }

  console.log('\n  switch OFF:');
  const offScript = extractScript(htmlOff);
  const offSection = sectionOf(htmlOff);
  console.log(`  ${offScript ? 'FAIL' : 'ok  '} no fetch script emitted at all`);
  need(!offScript, 'USE_LIVE_FETCH=false still emitted a fetch script');
  console.log(`  ${offSection.body === BAKED_TEXT ? 'ok  ' : 'FAIL'} the section is still complete: "${offSection.tag}" / "${offSection.body}"`);
  need(offSection.body === BAKED_TEXT, 'with the switch off the baked text is not what the section shows');

  console.log('');
  if (problems.length) {
    console.log('LIVE-FALLBACK FAILED:');
    problems.forEach(p => console.log('  ' + p));
    process.exit(1);
  }
  console.log('LIVE-FALLBACK PASS: every branch of the fallback chain behaves, and no branch ' +
    'clears the section, shows a spinner or changes the layout.');
})().catch(e => { console.error('LIVE-FALLBACK ERRORED: ' + (e && e.stack || e)); process.exit(1); });
