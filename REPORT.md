# BUILD REPORT — EL3vate Day 8 site

Built unattended from `AGENT-BRIEF.md` against the toplevel
`~/Desktop/Developer/el3vate-site`. Reproduce the whole site with:

```
node src/build.js        # emits dist/
node src/validate.js     # runs the six gates, exits non-zero on failure
node src/validate.js --selftest   # proves each gate can fail
```

Last build stamped `0681fbf` at `2026-07-28T06:03Z` (19:56 HST, 27 July). Every
generated page carries that stamp as its first line after `<!DOCTYPE html>`.

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
- **Validator** (`src/validate.js`): six gates, all currently green, each proven
  failable via `--selftest`.
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
0.359** — comfortably clear. The ranked list (useful even on a pass):

| # | score | field | pair |
|---|------|-------|------|
| 1 | 0.359 | tryTuesday | finance ~ planetary-science |
| 2 | 0.350 | tryTuesday | nutrition ~ marriage-family-therapy |
| 3 | 0.339 | tryTuesday | entrepreneurship ~ marketing |
| 4 | 0.325 | rubric | political-science ~ finance |
| 5 | 0.310 | rubric | finance ~ planetary-science |
| 6 | 0.308 | tryTuesday | political-science ~ comparative-philosophy |
| 7 | 0.307 | rubric | nutrition ~ marriage-family-therapy |
| 8 | 0.280 | rubric | law ~ marriage-family-therapy |
| 9 | 0.271 | tryTuesday | law ~ nutrition |
| 10 | 0.268 | tryTuesday | urban-planning ~ finance |

The clusters are unsurprising and real: the "build a model then break its
assumptions" disciplines (finance, planetary-science, urban-planning) share
method vocabulary; the counseling/intake disciplines (nutrition, MFT, law) share
listening-and-disclosure language. None approaches the threshold.

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
- **Some prompt fills are fictional specifics** (e.g., SB1421 is an invented
  bill). This is intentional and the annotations say so, but a reader skimming
  could mistake the fiction for a real bill.
- **`tryTuesday` clusters** (finance/planetary/urban) share method language; well
  under threshold, but they are the closest pairs and the first place templating
  would show if content were later edited carelessly.
