# BUILD REPORT — EL3vate Day 8 site

Built unattended from `AGENT-BRIEF.md` against the toplevel
`~/Desktop/Developer/el3vate-site`. Reproduce the whole site with:

```
node src/build.js        # emits dist/
node src/validate.js     # runs the seven gates, exits non-zero on failure
node src/validate.js --selftest   # proves each gate can fail
```

Every generated page carries the build stamp as its first line after
`<!DOCTYPE html>`.

---

## Rev 2.1 corrections (three fixes to the phase-7 output)

All seven gates pass after these. Not committed — shown as a diff first.

### (1) Schedule arithmetic — re-derived every fabrication calendar

The phase-7 fix changed "7–10 day" to "7–10 **business** days" in prose but did
not re-derive the calendars. 7–10 business days is **9–14 calendar days**, so a
fabrication file must be submitted **≥14 calendar days** before the session that
uses the part. Modelling weekly class meetings (Wk1 = day 0 … Wk4 = day 21), the
latest compliant submission for a part used in the week-4 session is the **first
day of week 2** (day 7 = 14 days of clearance).

Every week-3 deadline was moved to week 1 / first day of week 2, **except** the
two where the artifact genuinely cannot be designed until week 3 because it
depends on a week-2 output — those were **extended to five weeks** and say so in
`calendarNote`. The four already-week-2 deadlines were pinned to "first day of
Week 2" so the ≥14-day clearance is explicit rather than ambiguous. `law` and
`english-literature` have no fabrication dependency and were left unchanged.

| File | plan wks | `fileDueWeek` before → after | fix |
|---|---|---|---|
| political-science | 4 | Week 3 → **first day of Week 2** | move (tiles derive from wk-1 district) |
| urban-planning | 4 | Week 3 → **first day of Week 2** | move (model from wk-1 record) |
| nutrition | 4 | Week 3 → **first day of Week 2** | move (model from wk-1 community) |
| learning-design | 4 | Week 3 → **first day of Week 2** | move (manipulative from wk-1 concept) |
| family-business | 4 | Week 3 → **first day of Week 2** | move (board from wk-1 stake map) |
| teacher-education | 4 | Week 3 → **first day of Week 2** | move (cardboard-prototype in wk 1) |
| marriage-family-therapy | 4 | Week 3 → **first day of Week 1** | move (generic genogram kit) |
| comparative-philosophy | **5** | Week 3 → **first day of Week 3, five-week plan** | extend (apparatus needs wk-2 failure log) |
| finance | **5** | Week 3 → **first day of Week 3, five-week plan** | extend (cards render wk-2 model output) |
| bioinformatics | 4 | Week 2 → **first day of Week 2** | pin (make ≥14-day clearance explicit) |
| entrepreneurship | 4 | Week 2 → **first day of Week 2** | pin |
| marketing | 4 | Week 2 → **first day of Week 2** | pin |
| planetary-science | 4 | Week 2 → **first day of Week 2** | pin |

13 files changed; `budget.fileDueWeek`, `budget.calendarNote` and `plan[].txt`
were all re-derived together so prose and calendar agree. The two five-week plans
gained a Wk-4 "while it fabricates" step and pushed the part-using session to Wk5
(day 28 − 14 = day 14 = the Wk-3 cut-file deadline).

**Three deadlines failed the arithmetic on re-derivation and were corrected a
second time.** Extending to five weeks is not by itself sufficient: a cut file due
*end* of week 3 (day 20) leaves only **8** calendar days before a week-5 session
(day 28), not 14. Both five-week plans were therefore re-pinned to the **first
day of week 3** (day 14 → day 28 = exactly 14), with the artifact designed at the
close of week 2 while the week-2 output is fresh. Separately,
`marriage-family-therapy` said only "during week 1" — worst case day 6, which
leaves 8 days before its week-**3** role-play — and was pinned to day one. Final
state, checked mechanically: all 13 fabrication deadlines clear ≥14 calendar days,
and each `fileDueWeek` string was cross-checked against the arithmetic so the
prose cannot drift from the calendar.

### (2) Restored the minute-by-minute `tryTuesday` structure

`finance` and `planetary-science` had lost the explicit minute markers the other
13 disciplines carry. Both were rewritten to reinsert markers
(`Minutes 0–5:` … / `Minutes 0–10:` …) **without changing the assignment
content** — only the timing scaffold was added. As expected and permitted, the
shared scaffold nudged similarity, but nothing near the gate: `finance ~
planetary-science` on `tryTuesday` is **0.302** (max across the whole site is
now **0.354**, nutrition ~ MFT). New scores are in the similarity table below.

### (3) Fixed the dead `content/claims.json` reference

The on-page "unverified marks" note pointed readers to `content/claims.json`, a
repo path absent from `dist/`. The generator now emits **`dist/audit.html`** — a
human-readable page listing all 55 claims (refuted first), each with its status
badge, source file/field, audit note, and clickable verification URL — and the
note links to it with a relative `../audit.html` href. Because that page quotes
every claim (including refuted text) by design, GATE 7's "no refuted text in
`dist/`" scan now skips `audit.html`; the gate still enforces the rule everywhere
else and still passes `--selftest`.

### (4) POL-02 downgraded, and the gate tightened twice

POL-02 (`SB1421, a fictional Hawaiʻi bill`) was `verified` with no
`verifiedAgainst`. It could **not** be re-verified and was changed to
`unverifiable`. The reason is structural, not effort: the assertion is a
*negative* — that no Hawaiʻi SB1421 matches this description — and a search
returning nothing does not establish one. Worse, Senate bill numbers are reused
every biennium, so a real SB1421 on some unrelated subject very likely exists in
some session; and `capitol.hawaii.gov` returns HTTP 403 to the fetch tool, so the
authoritative bill-status system could not be queried. It is handled under the
existing transcript rule rather than with a visible badge: `promptFilled` already
tells the reader the bill is invented, and the transcript's first annotation names
it as a prompt fiction, which the gate now enforces.

Two gate conditions were added to `src/validate.js` GATE 7:

1. **`verified` with no `verifiedAgainst` fails the build.** A claim is not
   verified until a source says so; the label without the URL is an unexamined
   claim wearing the word, which is the exact failure this phase exists to catch.
2. **Any `inTranscript` claim — `refuted` *or* `unverifiable` — must be named in
   its transcript's annotations.** The original gate only checked this for
   `refuted`, so downgrading POL-02 would have moved it into a branch nothing
   checked.

**The second condition immediately caught seven real holes.** BIO-07, PS-02,
PS-06, POL-03, POL-04, POL-05 and UP-01 were all `unverifiable + inTranscript`
and none was machine-bound to an annotation. Five turned out to be genuinely
covered by existing annotation text and only needed the binding key. **Two were
not covered at all** — the CFTR residue context `…Ile-Phe-Gly-Val…` (BIO-07) and
the assumed impactor/target densities (PS-06) — meaning the previous report's
claim that every transcript-side unverifiable was annotated was wrong. Both now
have annotations naming them explicitly.

Also removed: a duplicate `renderAudit()` and a duplicate
`fs.writeFileSync(dist/audit.html)`. Two definitions existed; JS hoisting meant
the later one silently won and the earlier one was dead code writing a file that
was immediately overwritten. Only one remains.

---

## What was built

- **15 content files** (`content/*.json`) parsed from `seed/el3vate-day8.html`
  (Phase 1) and expanded with nine new sections each (Phase 2): `tryTuesday`,
  `replaces`, `aiFailsHere`, weighted `rubric`, `budget`, `scales`,
  `promptOutput`, `related`, and a reserved `liveBuild` field.
- **8 interactive demos** (`demos/*/index.html`), all built (not just the
  priority four): zoning-tradeoffs, crater-sim, district-redraw, break-even,
  variant-explainer, a11y-audit, intake-branching, tradition-critique. Each is a
  single dependency-free file, 5–9 KB, fully offline, keyboard-operable, in the
  seed's cutting-mat palette.
- **Generator** (`src/build.js`): emits the hub, 15 discipline pages in the
  brief's exact section order plus a reserved `id="live-build"` section, a
  "steal this" `handout.md` per discipline, and copies the demos into
  `dist/demos/` so iframes resolve from `file://` and GitHub Pages alike.
- **Validator** (`src/validate.js`): seven gates, all currently green, each proven
  failable via `--selftest` (GATE 7, the claim audit, carries four fixtures).
- **Screenshots** in `dist/_screens/` (hub + political-science, urban-planning,
  finance) captured with headless Chrome.

`dist/` is generated and git-ignored; it is not committed.

## What was skipped, and why

- **Nothing material was skipped.** All 8 demos were built (the brief allowed
  dropping the last four under time pressure); all 15 disciplines are complete;
  `promptOutput` is genuine and non-null for all 15.
- **Not automated:** full click-through interaction testing of the demos. No
  Puppeteer/Playwright is installed. Demos were verified by (a) loading each from
  `file://` in headless Chrome, (b) asserting the JS-generated DOM content
  appears, (c) capturing and finding zero console/JS errors, and (d) visual
  screenshot review of the pages that embed them. See BLOCKERS.md.

## The `promptOutput` field — provenance (read this)

The brief demands genuine, unedited model output and forbids fabrication. These
outputs are **real model output**: each starter prompt (with concrete bracket
fills, listed in each file's `promptFilled`) was run in an **isolated fresh
sub-session of Claude** with no knowledge of this build, and the reply was stored
**verbatim** and then annotated. The model is Claude (Anthropic), not a distinct
third-party model — noted here for full transparency. Several outputs are notably
strong teaching material because the model corrected the prompt's own premise
(e.g., bioinformatics: "F508del is not a single-nucleotide variant"; teacher-ed:
caught the NGSS grade mismatch; law: named the real HRS §521-73 precondition).
The completeness gate confirms no two `promptOutput`s are identical.

---

## Similarity gate — top 10 most-similar pairs

TF-IDF cosine across `tryTuesday`, `replaces`, `aiFailsHere`, `rubric`.
Threshold **0.45**; the build fails if any pair exceeds it. **Max observed:
0.354** — comfortably clear. Scores below are current after the rev-2.1 timing
restore (see the corrections section); restoring the shared minute-marker
scaffold to `finance` and `planetary-science` moved a few pairs but nothing near
the gate. The ranked list (useful even on a pass):

| # | score | field | pair |
|---|------|-------|------|
| 1 | 0.354 | tryTuesday | nutrition ~ marriage-family-therapy |
| 2 | 0.331 | tryTuesday | entrepreneurship ~ marketing |
| 3 | 0.306 | rubric | nutrition ~ marriage-family-therapy |
| 4 | 0.305 | tryTuesday | political-science ~ comparative-philosophy |
| 5 | 0.302 | tryTuesday | finance ~ planetary-science |
| 6 | 0.286 | tryTuesday | marketing ~ planetary-science |
| 7 | 0.284 | rubric | law ~ marriage-family-therapy |
| 8 | 0.280 | rubric | comparative-philosophy ~ finance |
| 9 | 0.271 | tryTuesday | law ~ nutrition |
| 10 | 0.270 | tryTuesday | comparative-philosophy ~ finance |

The clusters are unsurprising and real: the counseling/intake disciplines
(nutrition, MFT, law) share listening-and-disclosure language; the "build then
break/reconcile" disciplines (finance, planetary-science, marketing) share
method vocabulary. `finance ~ planetary-science` on `tryTuesday` is **0.302**
after the timing restore — the shared "Minutes 0–X:" scaffold is structure the
other 13 disciplines already carry, not duplicated substance, and it stays well
under threshold. None approaches 0.45.

## Every gate's demonstrated failure input

From `node src/validate.js --selftest` — each gate was fed a deliberately broken
fixture, confirmed to fail, then the fixture discarded:

| Gate | Broken fixture that made it fail |
|------|--------------------------------|
| 1 similarity | Copied `political-science`'s tryTuesday/replaces/aiFailsHere/rubric onto `entrepreneurship` → pair hit 1.0, over 0.45. |
| 2 link integrity | A page with `href="nope/missing.html"` pointing at a non-existent file. |
| 3 reciprocity | Made `political-science` list `nutrition` while `nutrition` did not list it back. |
| 4 contrast | `#CCCCCC` text on `#FFFFFF` (~1.6:1, below 4.5). |
| 5 offline | A demo file containing `fetch("https://api.example.com/x")`. |
| 6 completeness | Emptied `law.tryTuesday`; also detects two identical `promptOutput`s. |

All six pass on the real build (53 fg/bg contrast pairs checked, 8 demo files
scanned, 0 problems).

---

## What a human should review first (prioritized)

1. **The `promptOutput` annotations, per discipline.** These are the highest-value
   and highest-risk content. The outputs are genuine, but the *annotations* are my
   interpretation of where the model was strong/hedged/invented. A domain expert
   should sanity-check the law, bioinformatics, and comparative-philosophy ones in
   particular — those make specific factual claims (HRS §521-73, F508del biology,
   Analects/Mengzi citations) that a scholar should confirm.
2. **`aiFailsHere` for the three "credibility with skeptics" fields** — Law,
   English Literature, Bioinformatics, Comparative Philosophy. If any of these
   reads as boilerplate to a specialist, it undercuts the whole pitch.
3. **`replaces` accuracy.** Each names a specific standard assignment in that
   field. A faculty member in the discipline should confirm the named assignment
   is the real one their department uses.
4. **Budget calendar dependencies.** The fabrication-file due weeks assume the
   7–10 day turnaround; confirm they land before the stated deadlines in a real
   term calendar.
5. **The `a11y-audit` demo's claims.** It genuinely evaluates the DOM, but a human
   using a real screen reader should confirm its keyboard/motion findings match
   assistive-tech behavior.

## Where this is weak (blunt)

- **Annotations are single-author judgment.** No second reviewer checked whether
  each "the model invented X" call is fair. The factual citations inside the
  outputs (statutes, gene biology, primary-source line numbers) were produced by a
  model and are flagged in-page as needing verification, but they are not
  independently verified here.
- **Contrast gate pairs by CSS-context heuristic, not a real render.** It infers
  dark vs. light background from selector names (`hero`/`tt` → mat, else paper)
  and strips `@media` blocks. It is conservative (tests dark text against the
  darker of the two light backgrounds) and demonstrably failable, but it is not a
  substitute for an axe-core/browser audit.
- **Demo interaction is not automated end-to-end.** Load + JS-error + screenshot
  verification only; a human should click through district-redraw's keyboard path
  and the intake-branching tree.
- **We cannot prove SB1421 is fictional** (POL-02, now `unverifiable`). It is
  invented *for this prompt*, but bill numbers recycle every biennium and
  `capitol.hawaii.gov` blocks automated fetches, so a real SB1421 on some other
  subject may well exist. The page says the bill is invented; nobody has
  confirmed no same-numbered real bill exists.
- **Some prompt fills are fictional specifics** (e.g., SB1421 is an invented
  bill). This is intentional and the annotations say so, but a reader skimming
  could mistake the fiction for a real bill.
- **`tryTuesday` clusters** (finance/planetary/urban) share method language; well
  under threshold, but they are the closest pairs and the first place templating
  would show if content were later edited carelessly.
