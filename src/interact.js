// Phase 8 — demo interaction tests.
//
// The first run verified demos by page load, console errors and screenshot only.
// That proves a demo does not crash; it does not prove it does anything. These
// tests drive the actual interaction and assert on the RESULT — the output text,
// the readout, the score — not on the absence of errors.
//
// Every demo is additionally checked for keyboard-only operability by *parity*:
// perform the interaction with the mouse, read the resulting state, reload,
// perform the same interaction with the keyboard alone, and require the two
// states to be identical. A control that is reachable by Tab but does nothing
// when actuated fails this, which is the point.
//
//   node src/interact.js            run against dist/demos/
//   node src/interact.js --headed   same, with a visible browser
//
// Plain Node + playwright. Exits non-zero if any assertion fails.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const HEADED = process.argv.includes('--headed');

const demoUrl = slug => 'file://' + path.join(DIST, 'demos', slug, 'index.html');

// ---------- assertion harness ----------
const RESULTS = [];
function suite(demo) {
  const rec = { demo, checks: [], pass: 0, fail: 0, consoleErrors: [] };
  RESULTS.push(rec);
  return {
    rec,
    ok(label, cond, detail) {
      if (cond) { rec.pass++; rec.checks.push({ label, ok: true, detail: detail || '' }); }
      else { rec.fail++; rec.checks.push({ label, ok: false, detail: detail || '' }); }
    },
    eq(label, actual, expected) {
      this.ok(label, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    ne(label, a, b) {
      this.ok(label, a !== b, `both sides were ${JSON.stringify(a)}`);
    },
  };
}

// A readout is only useful if it says something. Empty, NaN, undefined and
// Infinity are all ways a demo can look alive while being broken.
const BAD = /\bNaN\b|\bundefined\b|\bInfinity\b|\bnull\b/;
const sane = s => typeof s === 'string' && s.trim().length > 0 && !BAD.test(s);

async function texts(page, ids) {
  return page.evaluate(list => {
    const o = {};
    for (const id of list) { const el = document.getElementById(id); o[id] = el ? el.textContent : null; }
    return o;
  }, ids);
}

// ---------- keyboard helpers ----------
// Tab forward from the top of the document, recording what receives focus, and
// stop when focus leaves the document (activeElement falls back to body).
async function tabOrder(page, limit = 80) {
  const seen = [];
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    const sig = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body || e === document.documentElement) return null;
      const cls = typeof e.className === 'string' && e.className.trim()
        ? '.' + e.className.trim().split(/\s+/).join('.') : '';
      // Document-order position, not just id+class: six sibling `button.s`
      // elements are otherwise indistinguishable, and a signature that collides
      // makes the "wrapped around" check fire on the second control and silently
      // under-report how far Tab actually reaches.
      const pos = Array.prototype.indexOf.call(document.querySelectorAll('*'), e);
      return (e.id ? '#' + e.id : '') + cls + '[' + e.tagName + ']@' + pos;
    });
    if (sig === null) break;
    if (seen.includes(sig)) break;   // wrapped around
    seen.push(sig);
  }
  return seen;
}

// Count of controls that ought to be reachable by Tab.
function focusableCount(page) {
  return page.evaluate(() => {
    const sel = 'a[href],button,input:not([type=hidden]),select,textarea,[tabindex]';
    return Array.prototype.filter.call(document.querySelectorAll(sel),
      el => el.tabIndex >= 0 && !el.disabled).length;
  });
}

// Tab until the predicate matches the focused element, then leave it focused.
async function tabUntil(page, predicate, limit = 80) {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate(fn => {
      // eslint-disable-next-line no-new-func
      return new Function('el', 'return (' + fn + ')(el)')(document.activeElement);
    }, predicate);
    if (hit) return true;
  }
  return false;
}

// Every demo runs the same shape: mouse pass -> state, reload, keyboard pass ->
// state, require identical. `reach` additionally proves every control is
// Tab-reachable in the first place.
async function keyboardParity(t, page, url, { mouse, keys, read, label }) {
  await page.goto(url);
  await mouse(page);
  const viaMouse = await read(page);
  await page.goto(url);
  await keys(page);
  const viaKeys = await read(page);
  t.ok(`keyboard parity — ${label}`, JSON.stringify(viaMouse) === JSON.stringify(viaKeys),
    `mouse=${JSON.stringify(viaMouse)} keyboard=${JSON.stringify(viaKeys)}`);
  return { viaMouse, viaKeys };
}

async function reachability(t, page, url) {
  await page.goto(url);
  const order = await tabOrder(page);
  const expected = await focusableCount(page);
  t.ok('every control reachable by Tab', order.length >= expected,
    `tab reached ${order.length} of ${expected} focusable controls`);
  return order;
}

// ============================================================
// slider demos: zoning-tradeoffs, break-even, crater-sim
// ============================================================
// Each: drive every slider to its own min and to its own max, and require the
// outputs to be non-empty, free of NaN/undefined/Infinity, and *different*
// between the two extremes. A readout that never changes is not a model.
async function sliderDemo(page, { slug, sliders, outputs, extraCases }) {
  const t = suite(slug);
  const url = demoUrl(slug);
  await page.goto(url);

  const bounds = await page.evaluate(ids => ids.map(id => {
    const el = document.getElementById(id);
    return { id, min: el.min, max: el.max };
  }), sliders);

  const setAll = async which => {
    for (const b of bounds) await page.locator('#' + b.id).fill(which === 'min' ? b.min : b.max);
  };

  await setAll('min');
  const atMin = await texts(page, outputs);
  await setAll('max');
  const atMax = await texts(page, outputs);

  for (const id of outputs) {
    t.ok(`#${id} sane at slider minimum`, sane(atMin[id]), JSON.stringify(atMin[id]));
    t.ok(`#${id} sane at slider maximum`, sane(atMax[id]), JSON.stringify(atMax[id]));
    t.ne(`#${id} changes between extremes`, atMin[id], atMax[id]);
  }

  for (const c of (extraCases || [])) {
    await page.goto(url);
    for (const [id, v] of Object.entries(c.set)) await page.locator('#' + id).fill(String(v));
    const got = await texts(page, outputs);
    for (const id of outputs) t.ok(`${c.label} — #${id} sane`, sane(got[id]), JSON.stringify(got[id]));
    if (c.assert) c.assert(t, got);
  }

  await reachability(t, page, url);

  // Keyboard parity: Home/End are the native keyboard actuation for a range
  // input. Tab to each slider in turn and press End; compare against fill().
  await keyboardParity(t, page, url, {
    label: 'all sliders to maximum',
    mouse: async p => { for (const b of bounds) await p.locator('#' + b.id).fill(b.max); },
    keys: async p => {
      for (const b of bounds) {
        const found = await tabUntil(p, `el => el.id === ${JSON.stringify(b.id)}`);
        if (!found) throw new Error(`could not Tab to #${b.id} in ${slug}`);
        await p.keyboard.press('End');
      }
    },
    read: p => texts(p, outputs),
  });

  await keyboardParity(t, page, url, {
    label: 'all sliders to minimum',
    mouse: async p => { for (const b of bounds) await p.locator('#' + b.id).fill(b.min); },
    keys: async p => {
      for (const b of bounds) {
        const found = await tabUntil(p, `el => el.id === ${JSON.stringify(b.id)}`);
        if (!found) throw new Error(`could not Tab to #${b.id} in ${slug}`);
        await p.keyboard.press('Home');
      }
    },
    read: p => texts(p, outputs),
  });
}

// ============================================================
// district-redraw — drag, deviation readout, ±5% red state
// ============================================================
async function districtRedraw(page) {
  const t = suite('district-redraw');
  const url = demoUrl('district-redraw');
  await page.goto(url);

  const readDev = p => p.evaluate(() => ['A', 'B', 'C'].map(n => {
    const el = document.getElementById('dev' + n);
    return { name: n, text: el.textContent, cls: el.className, num: parseFloat(el.textContent) };
  }));

  const before = await readDev(page);
  t.ok('deviation readout populated on load', before.every(d => sane(d.text) && Number.isFinite(d.num)),
    JSON.stringify(before.map(d => d.text)));

  // Drag across the right two-thirds of row 0 with District A selected. Those
  // cells start as B and C, so the drag moves population between districts.
  const box = i => page.locator('.cell').nth(i).boundingBox();
  const b2 = await box(2), b3 = await box(3), b4 = await box(4), b5 = await box(5);
  const mid = b => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
  await page.mouse.move(mid(b2).x, mid(b2).y);
  await page.mouse.down();
  for (const b of [b3, b4, b5]) { const m = mid(b); await page.mouse.move(m.x, m.y, { steps: 6 }); }
  await page.mouse.up();

  const dragged = await page.evaluate(() =>
    [2, 3, 4, 5].map(i => document.querySelectorAll('.cell')[i].textContent));
  t.ok('drag repainted every precinct it crossed', dragged.every(x => x === 'A'),
    `cells 2-5 read ${JSON.stringify(dragged)} (expected all "A")`);

  const after = await readDev(page);
  t.ne('deviation readout changed after the drag',
    JSON.stringify(before.map(d => d.text)), JSON.stringify(after.map(d => d.text)));

  const worst = after.reduce((m, d) => Math.abs(d.num) > Math.abs(m.num) ? d : m, after[0]);
  t.ok('drag pushed a district past ±5%', Math.abs(worst.num) > 5,
    `worst deviation is ${worst.text} on district ${worst.name}`);
  t.ok('red state triggers on the district that broke ±5%', /\bbad\b/.test(worst.cls),
    `district ${worst.name} at ${worst.text} has class "${worst.cls}"`);

  // The red state must be a function of the number, not decoration: every
  // district over ±5% is red and every district inside it is not.
  const consistent = after.every(d => (Math.abs(d.num) > 5) === /\bbad\b/.test(d.cls));
  t.ok('red/green state agrees with the computed deviation for all three districts', consistent,
    JSON.stringify(after.map(d => `${d.name} ${d.text} ${d.cls}`)));

  await reachability(t, page, url);

  // Keyboard parity: clicking precinct 0 with brush C vs. Tab to precinct 0 and
  // press 3. Both must land on the identical map + readout.
  const readAll = p => p.evaluate(() => ({
    cells: Array.prototype.map.call(document.querySelectorAll('.cell'), c => c.textContent).join(''),
    devs: ['A', 'B', 'C'].map(n => document.getElementById('dev' + n).textContent).join('|'),
    score: document.getElementById('score').textContent,
  }));
  await keyboardParity(t, page, url, {
    label: 'assign precinct 1 to district C',
    mouse: async p => {
      await p.locator('.brush button').nth(2).click();   // select District C
      await p.locator('.cell').nth(0).click();
    },
    keys: async p => {
      await tabUntil(p, 'el => el.classList && el.classList.contains("cell") && el.dataset.i === "0"');
      await p.keyboard.press('3');
    },
    read: readAll,
  });
}

// ============================================================
// variant-explainer — toggling the variant must change the explanation
// ============================================================
async function variantExplainer(page) {
  const t = suite('variant-explainer');
  const url = demoUrl('variant-explainer');
  await page.goto(url);

  const KEYS = ['wt', 'silent', 'missense', 'nonsense', 'frameshift'];
  const read = p => p.evaluate(() => ({
    eff: document.getElementById('eff').textContent,
    explain: document.getElementById('explain').textContent,
    chain: document.getElementById('chain').textContent,
    seq: document.getElementById('seq').textContent,
  }));

  const states = {};
  for (const k of KEYS) {
    await page.locator(`.controls button[data-k="${k}"]`).click();
    states[k] = await read(page);
    t.ok(`${k}: explanatory text renders`, sane(states[k].explain), JSON.stringify(states[k].explain).slice(0, 90));
    t.ok(`${k}: effect label renders`, sane(states[k].eff), JSON.stringify(states[k].eff));
    t.ok(`${k}: protein chain renders`, sane(states[k].chain), JSON.stringify(states[k].chain));
  }

  const explanations = KEYS.map(k => states[k].explain);
  t.ok('all five variants render different explanatory text',
    new Set(explanations).size === KEYS.length,
    `${new Set(explanations).size} distinct explanations across ${KEYS.length} variants`);

  // The biology the demo teaches has to actually show up in the output.
  t.ne('nonsense truncates the protein relative to healthy', states.wt.chain, states.nonsense.chain);
  t.ok('nonsense chain ends at a STOP', /STOP/.test(states.nonsense.chain), states.nonsense.chain);
  t.eq('silent change leaves the protein identical', states.silent.chain, states.wt.chain);
  t.ne('silent change is still visible in the sequence', states.silent.seq, states.wt.seq);
  t.ne('frameshift scrambles the downstream protein', states.frameshift.chain, states.wt.chain);

  await reachability(t, page, url);

  await keyboardParity(t, page, url, {
    label: 'select the nonsense variant',
    mouse: p => p.locator('.controls button[data-k="nonsense"]').click(),
    keys: async p => {
      await tabUntil(p, 'el => el.dataset && el.dataset.k === "nonsense"');
      await p.keyboard.press('Enter');
    },
    read,
  });
}

// ============================================================
// a11y-audit — the checker must be able to report a real failure
// ============================================================
async function a11yAudit(page) {
  const t = suite('a11y-audit');
  const url = demoUrl('a11y-audit');

  // rows render in a fixed order: contrast, keyboard, reduced motion
  const rows = p => p.evaluate(() => Array.prototype.map.call(
    document.querySelectorAll('#audit .check'), r => ({
      name: r.querySelector('.t').textContent,
      verdict: r.querySelector('.badge').textContent,
      detail: r.querySelector('.d').textContent,
    })));
  const contrastRatio = detail => { const m = detail.match(/is\s+([0-9.]+):1/); return m ? parseFloat(m[1]) : NaN; };

  // --- 1. a genuinely low-contrast fixture element is detected ---
  await page.goto(url);
  await page.evaluate(() => {
    const p = document.createElement('p');
    p.id = 'contrastFixture';
    p.textContent = 'Injected fixture text at deliberately insufficient contrast.';
    p.style.color = '#EFEFEF';          // ~1.1:1 on the white module card
    document.getElementById('module').appendChild(p);
  });
  await page.locator('#run').click();
  let r = await rows(page);
  t.eq('audit renders all three checks', r.length, 3);
  const cf = r[0];
  t.eq('injected low-contrast fixture is reported as a FAILURE', cf.verdict, 'FAIL');
  const ratio = contrastRatio(cf.detail);
  t.ok('reported ratio is the injected element, not a canned number', ratio > 1 && ratio < 1.5,
    `reported ${ratio}:1 — expected ~1.1:1 for #EFEFEF on #FFFFFF`);
  t.ok('failure detail names the injected fixture', /Injected fixture/.test(cf.detail), cf.detail);

  // --- 2. the same checker reports PASS once the page is actually accessible ---
  // A checker that always says FAIL is decoration in the other direction. Remove
  // the fixture, raise the deliberately-faint hint to full ink, re-run.
  await page.evaluate(() => {
    document.getElementById('contrastFixture').remove();
    document.getElementById('hint').style.color = '#15211C';
  });
  await page.locator('#run').click();
  r = await rows(page);
  t.eq('contrast check reports PASS on a compliant page', r[0].verdict, 'PASS');
  t.ok('PASS ratio clears the 4.5:1 threshold it cites', contrastRatio(r[0].detail) >= 4.5, r[0].detail);

  // --- 3. the shipped "break it" switch also produces a real failure ---
  await page.goto(url);
  await page.locator('#run').click();
  const baseline = contrastRatio((await rows(page))[0].detail);
  await page.locator('#brkContrast').check();
  await page.locator('#run').click();
  const broken = await rows(page);
  t.eq('"low-contrast hint" switch produces a FAIL', broken[0].verdict, 'FAIL');
  t.ok('switch measurably lowers the reported ratio', contrastRatio(broken[0].detail) < baseline,
    `baseline ${baseline}:1 -> broken ${contrastRatio(broken[0].detail)}:1`);

  // --- 4. keyboard-trap switch is detected by the keyboard check ---
  await page.goto(url);
  await page.locator('#run').click();
  t.eq('keyboard check passes before the trap is introduced', (await rows(page))[1].verdict, 'PASS');
  await page.locator('#brkTrap').check();
  await page.locator('#run').click();
  const trapped = await rows(page);
  t.eq('keyboard trap switch produces a FAIL', trapped[1].verdict, 'FAIL');
  t.ok('trap failure explains itself', /positive tabindex|off-screen/.test(trapped[1].detail), trapped[1].detail);

  // --- 5. the lesson itself responds ---
  await page.goto(url);
  await page.locator('#ans2').click();
  const right = await page.locator('#quizResult').textContent();
  await page.locator('#ans1').click();
  const wrong = await page.locator('#quizResult').textContent();
  t.ok('correct answer is acknowledged', /Correct/.test(right), right);
  t.ne('right and wrong answers give different feedback', right, wrong);

  await reachability(t, page, url);

  await keyboardParity(t, page, url, {
    label: 'answer the quiz and run the audit',
    mouse: async p => { await p.locator('#ans2').click(); await p.locator('#run').click(); },
    keys: async p => {
      await tabUntil(p, 'el => el.id === "ans2"');
      await p.keyboard.press('Enter');
      await tabUntil(p, 'el => el.id === "run"');
      await p.keyboard.press('Enter');
    },
    read: async p => ({ quiz: await p.locator('#quizResult').textContent(), audit: await rows(p) }),
  });
}

// ============================================================
// intake-branching — an advice-giving path and a reflective path
// ============================================================
async function intakeBranching(page) {
  const t = suite('intake-branching');
  const url = demoUrl('intake-branching');

  // Options render in a fixed order [0,2,1,3], so DOM position 0 is always the
  // reflective option and position 2 is always the advice option. The fragments
  // assert that mapping still holds before each click, so a reordering breaks
  // the test loudly instead of silently walking the wrong path.
  const REFLECT = { pos: 0, frag: ['It sounds like coming here', 'Tired, not sleeping', 'So the tiredness started', "It's the first time you've let yourself"] };
  const ADVICE = { pos: 2, frag: ["let's set some goals", 'cut out caffeine', 'share the caregiving load', 'schedule time for yourself'] };

  const readEnd = p => p.evaluate(() => {
    const h = document.querySelector('#scene .end h2');
    return {
      heading: h ? h.textContent : null,
      body: Array.prototype.map.call(document.querySelectorAll('#scene .end p'), p => p.textContent).join(' '),
      trust: document.getElementById('trustPct').textContent,
      ended: !!h,
    };
  });

  async function walk(p, path) {
    await p.goto(url);
    for (let turn = 0; turn < 4; turn++) {
      const btn = p.locator('#scene .opts button').nth(path.pos);
      const label = await btn.textContent();
      t.ok(`${path === REFLECT ? 'reflective' : 'advice'} path — turn ${turn + 1} option is the expected one`,
        label.includes(path.frag[turn]), `button read: ${JSON.stringify(label.slice(0, 70))}`);
      await btn.click();
    }
    return readEnd(p);
  }

  const advice = await walk(page, ADVICE);
  const reflect = await walk(page, REFLECT);

  t.ok('advice path reaches an end state', advice.ended, JSON.stringify(advice));
  t.ok('reflective path reaches an end state', reflect.ended, JSON.stringify(reflect));
  t.ne('the two paths reach DIFFERENT end states', advice.heading, reflect.heading);
  t.eq('advice path ends guarded', advice.heading, 'She stayed guarded.');
  t.eq('reflective path ends opened up', reflect.heading, 'She opened up.');
  t.ne('the two paths end on different trust levels', advice.trust, reflect.trust);
  t.ok('reflective path scores higher trust than the advice path',
    parseInt(reflect.trust, 10) > parseInt(advice.trust, 10),
    `reflective ${reflect.trust} vs advice ${advice.trust}`);
  t.ok('advice path names the turn where it lost her',
    /You lost her at turn \d+, when you jumped to advice/.test(advice.body || ''),
    JSON.stringify(advice.body).slice(0, 160));
  t.ok('reflective path is not told it under-reflected',
    !/too few of your responses reflected/.test(reflect.body || ''),
    JSON.stringify(reflect.body).slice(0, 160));

  await reachability(t, page, url);

  await keyboardParity(t, page, url, {
    label: 'walk the full reflective path',
    mouse: async p => { for (let i = 0; i < 4; i++) await p.locator('#scene .opts button').nth(0).click(); },
    keys: async p => {
      for (let i = 0; i < 4; i++) {
        await tabUntil(p, 'el => el.closest && el.closest(".opts") && el.dataset.i === "0"');
        await p.keyboard.press('Enter');
      }
    },
    read: readEnd,
  });
}

// ============================================================
// tradition-critique — a correct highlight and an incorrect one must score differently
// ============================================================
async function traditionCritique(page) {
  const t = suite('tradition-critique');
  const url = demoUrl('tradition-critique');

  const DEPARTS = [2, 3, 5];     // the three sentences that leave the tradition
  const FAITHFUL = [0, 1, 4];

  const readScore = p => p.evaluate(() => {
    const r = document.getElementById('result');
    const s = r.querySelector('.score');
    return { hidden: r.hidden, score: s ? s.textContent : null, items: r.querySelectorAll('li').length };
  });

  async function highlightAndScore(p, indices) {
    await p.goto(url);
    for (const i of indices) await p.locator('#arg button.s').nth(i).click();
    await p.locator('#run').click();
    return readScore(p);
  }

  const correct = await highlightAndScore(page, DEPARTS);
  const incorrect = await highlightAndScore(page, [FAITHFUL[0]]);

  t.ok('scoring a correct highlight renders a result', !correct.hidden && sane(correct.score), JSON.stringify(correct));
  t.ok('scoring an incorrect highlight renders a result', !incorrect.hidden && sane(incorrect.score), JSON.stringify(incorrect));
  t.ne('correct and incorrect highlights produce DIFFERENT scores', correct.score, incorrect.score);
  t.eq('a fully correct reading catches all three departures', correct.score, '3 of 3 departures caught');
  t.ok('an incorrect reading is scored as a miss plus a false alarm',
    /^0 of 3 departures caught, 1 false alarm$/.test(incorrect.score || ''), incorrect.score);
  t.eq('every sentence is explained in the key', correct.items, 6);

  // marks land on the right sentences
  await page.goto(url);
  for (const i of DEPARTS) await page.locator('#arg button.s').nth(i).click();
  await page.locator('#run').click();
  const marks = await page.evaluate(() =>
    Array.prototype.map.call(document.querySelectorAll('#arg button.s'), b => b.className));
  t.ok('caught departures are marked as hits', DEPARTS.every(i => /\bhit\b/.test(marks[i])), JSON.stringify(marks));
  t.ok('faithful sentences left alone are not marked', FAITHFUL.every(i => !/hit|miss|fp/.test(marks[i])), JSON.stringify(marks));

  await reachability(t, page, url);

  await keyboardParity(t, page, url, {
    label: 'highlight all three departures and score',
    mouse: async p => {
      for (const i of DEPARTS) await p.locator('#arg button.s').nth(i).click();
      await p.locator('#run').click();
    },
    keys: async p => {
      for (const i of DEPARTS) {
        await tabUntil(p, `el => el.classList && el.classList.contains("s") &&
          Array.prototype.indexOf.call(el.parentNode.children, el) === ${i}`);
        await p.keyboard.press('Enter');
      }
      await tabUntil(p, 'el => el.id === "run"');
      await p.keyboard.press('Enter');
    },
    read: readScore,
  });
}

// ============================================================
// runner
// ============================================================
async function main() {
  if (!fs.existsSync(path.join(DIST, 'demos'))) {
    console.error('dist/demos not found — run `node src/build.js` first.');
    process.exit(2);
  }
  const browser = await chromium.launch({ headless: !HEADED });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });

  // console errors are still worth catching, but they are no longer the test
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  try {
    await sliderDemo(page, {
      slug: 'zoning-tradeoffs',
      sliders: ['h', 'u', 'p', 'o'],
      outputs: ['rShadow', 'rTraffic', 'rAfford', 'rDemo', 'hV', 'uV', 'pV', 'oV'],
    });

    await sliderDemo(page, {
      slug: 'break-even',
      sliders: ['fixed', 'price', 'varc', 'vol'],
      outputs: ['be', 'beNote', 'profit'],
      extraCases: [{
        label: 'negative margin (price below unit cost)',
        set: { fixed: 4000, price: 2, varc: 20, vol: 900 },
        assert: (t, got) => {
          t.eq('negative margin reports "Never" rather than Infinity', got.be, 'Never');
          t.ok('negative margin explains the loss', /lose/.test(got.profit), got.profit);
        },
      }, {
        label: 'profitable configuration',
        set: { fixed: 500, price: 30, varc: 0.5, vol: 3000 },
        assert: (t, got) => {
          t.ok('profitable configuration reports a profit', /profit a month/.test(got.profit), got.profit);
        },
      }],
    });

    await sliderDemo(page, {
      slug: 'crater-sim',
      sliders: ['L', 'v', 'a', 'g'],
      outputs: ['read', 'LV', 'vV', 'aV', 'gV'],
      extraCases: [{
        label: 'implausible shallow angle',
        set: { L: 100, v: 20, a: 5, g: 9.8 },
        assert: (t, got) => t.ok('crater readout still resolves at a flagged setting',
          /diameter/.test(got.read), got.read),
      }],
    });

    await districtRedraw(page);
    await variantExplainer(page);
    await a11yAudit(page);
    await intakeBranching(page);
    await traditionCritique(page);
  } finally {
    await browser.close();
  }

  // ---- report ----
  let totalPass = 0, totalFail = 0;
  console.log('\n=== DEMO INTERACTION TESTS ===');
  for (const r of RESULTS) {
    totalPass += r.pass; totalFail += r.fail;
    console.log(`\n[${r.fail ? 'FAIL' : 'PASS'}] ${r.demo}  (${r.pass} passed, ${r.fail} failed)`);
    for (const c of r.checks) {
      if (c.ok) console.log(`    ok   ${c.label}`);
      else console.log(`    FAIL ${c.label}\n         ${c.detail}`);
    }
  }
  if (errors.length) {
    console.log('\nconsole / page errors observed:');
    errors.forEach(e => console.log('    ' + e));
  } else {
    console.log('\nno console or page errors across any demo.');
  }
  console.log(`\n${totalFail ? 'INTERACTION TESTS FAILED' : 'ALL INTERACTION TESTS PASS'} — ` +
    `${totalPass} passed, ${totalFail} failed across ${RESULTS.length} demos.`);

  const jsonPath = path.join(ROOT, 'dist', '_interaction-results.json');
  try { fs.writeFileSync(jsonPath, JSON.stringify({ results: RESULTS, errors }, null, 2)); } catch (e) {}

  process.exit(totalFail || errors.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
