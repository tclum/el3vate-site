# BUILD REPORT — EL3vate Day 8 site

Built unattended against the toplevel `~/Desktop/Developer/el3vate-site`, from
`AGENT-BRIEF.md` (phases 1–6) and `AGENT-BRIEF-2.md` (phases 7–12). Reproduce
everything with one command:

```
npm run check     # build -> handout PDFs -> 10 gates -> gate selftest -> interaction tests
```

or a stage at a time:

```
node src/build.js       # emits dist/  (zero dependencies)
node src/pdf.js         # renders the handout PDFs   (needs playwright)
node src/validate.js    # the 10 gates, exits non-zero on failure  (zero dependencies)
node src/validate.js --selftest   # feeds every gate a broken fixture, proves it fails
node src/interact.js    # drives the 8 demos + presenter kit for real  (needs playwright)
node src/screens.js     # re-captures assets/screens/*.png after a demo changes
node src/qr.js          # regenerates assets/qr.svg after SITE_URL changes
```

Every generated page carries the build stamp as its first line after
`<!DOCTYPE html>`.

**`SITE_URL` = `https://el3vate.vercel.app`** — the stable production alias, not
a per-deployment hostname. Defined once at the top of `src/build.js`, echoed by
every build, printed by gate 10, encoded in the QR, and cross-checked against
`assets/qr.json` at build time (the build **throws** if they disagree).
**`FEEDBACK_EMAIL` = `tclum@hawaii.edu`.**

---

# SECOND RUN — phases 8 through 12

Four commits: `c5402fe` (8), `3ce83f6` (9), `f944f08` (10), `4f7a7e4` (11), plus
this report (12). Phase 7 and its corrections were already complete and
committed (`1ee9b94`, `a396207`) and were **not** redone.

## Phase status — and what actually executed

Nothing below is called complete unless its gate ran and I read its output.

| Phase | Status | Gate that proves it | Ran? |
|---|---|---|---|
| 7 — claim audit | complete (previous run) | GATE 7 | ✅ re-ran, PASS |
| 8 — demo interaction tests | **complete** | `src/interact.js`, 212 assertions | ✅ PASS |
| 9 — print + handouts | **complete** | GATE 8 | ✅ PASS |
| 10 — presenter kit | **complete** | GATE 9 + 55 interaction assertions | ✅ PASS |
| 11 — session-day artifacts | **complete** | GATE 10 + 10 interaction assertions | ✅ PASS |
| 12 — verify and report | **complete** | this document | ✅ |

### What I ran and saw output for

- `npm run check` end-to-end, exit code 0. All five stages green.
- All **10 gates** against the real build (not fixtures).
- `--selftest`: **22 fixtures**, every one caught.
- `src/interact.js`: **212 assertions across 10 pages**, 0 failures, 0 console
  or page errors.
- PDF rendering: 16 real PDFs, page counts read out of the PDF objects.
- The QR: rasterised and **scanned back with a real decoder**, reads as
  `https://el3vate.vercel.app`.
- The presenter page and closing card driven with **every http(s) request
  aborted at the network layer** — zero requests attempted.
- Print stylesheet: verified in Chromium under `emulateMedia({media:'print'})`
  on pages with and without a demo, in both directions (screen ↔ print).

### What I could NOT run

- **No human has looked at any of it.** Everything below is machine-verified.
- **No real screen reader, no axe-core.** The contrast gate is still a CSS
  heuristic (see "Where this is weak"); the `a11y-audit` demo's own checker is
  now proven to compute rather than decorate, but neither is assistive-tech
  testing.
- **No print on paper.** Print layout was verified by rendering to PDF at Letter
  size, not by printing.
- **No deployment.** `SITE_URL` was never fetched; the site was tested from
  `file://` throughout. Nobody has confirmed `https://el3vate.vercel.app` serves
  this build.
- **No phone camera scanned the QR.** It was decoded programmatically from a
  512px raster, which is strong evidence but is not a phone in a room.
- **No second opinion on any content claim.** Per instruction, this run did not
  audit, re-verify or rewrite existing prose, and did not touch
  `content/claims.json` or any deadline.

---

## Gate results (real build, not fixtures)

```
[1]  SIMILARITY             PASS   max 0.354, threshold 0.45
[2]  LINK INTEGRITY         PASS
[3]  RECIPROCITY            PASS
[4]  CONTRAST               PASS   68 fg/bg pairs checked
[5]  OFFLINE (demos)        PASS   8 demo files
[6]  COMPLETENESS           PASS
[7]  CLAIM AUDIT            PASS   36 verified, 9 refuted, 10 unverifiable
[8]  HANDOUT ARTIFACTS      PASS   15/15 disciplines, 15 as PDF, combined: pdf + html
[9]  PRESENTER KIT          PASS   8 demos linked, 8 stills embedded, 916 KB self-contained
[10] SESSION-DAY ARTIFACTS  PASS   qr.svg + closing-card.html, 15/15 feedback links
```

Gates 8, 9 and 10 are new this run. Each is proven failable:

| Gate | Fixtures that made it fail |
|---|---|
| 8 handouts | missing artifact; an 18-byte truncated `handout.pdf` against the 2KB floor; combined handout absent |
| 9 presenter | `noindex` meta removed; a CDN stylesheet added; the hub linking to it; a linked demo with no embedded still |
| 10 session-day | closing card pointing at `el3vate-<hash>-tclum-4994s-projects.vercel.app`; feedback mailing an address other than `FEEDBACK_EMAIL`; a generic "Feedback" subject that does not name the discipline; `closing-card.html` absent |

**22 of 22 selftest fixtures caught.**

---

## Claim audit — full result by status (phase 7, re-verified this run)

55 claims extracted from `content/*.json` into `content/claims.json`.

| Status | Count | What it means here |
|---|---|---|
| **verified** | **36** | Checked against a live source; the URL is recorded in `claims.json` and rendered on `dist/audit.html`. Gate 7 **fails the build** if anything is marked `verified` without a `verifiedAgainst` URL. |
| **refuted** | **9** | The claim is wrong. Either rewritten out of the prose, or — where it sits inside a `promptOutput` transcript, which is never edited — named explicitly in that transcript's annotations. |
| **unverifiable** | **10** | No independent source found. Either rewritten to drop the specific citation, or kept behind a visible `unverified` marker (13 pages carry one, all on per-student cost figures). |
| **total** | **55** | |

The count moved from the phase-7 commit's 37/9/9 to **36/9/10** because the
corrections commit (`a396207`) downgraded POL-02 from `verified` to
`unverifiable` — a non-existence claim about SB1421 that cannot be sourced.

### The nine refuted claims, and every rewrite with before and after

Four of the nine sit **inside** `promptOutput` transcripts. Those transcripts are
real, unedited model output and their value depends entirely on staying that way,
so **not one character of any transcript was changed**. The correction lives in
the annotation instead — and gate 7 fails the build if a refuted in-transcript
claim has no annotation naming it.

**LAW-03** — *transcript, not rewritten.* Model asserted HRS §521-73 conditions
lease termination. It does not: §521-73 is damages liability for abuse of access
and says nothing about ending a lease; the tenant's termination remedy is
§521-63. Source: `cca.hawaii.gov/ocp/hrs-chapter-521/`.

**LAW-04** — *annotation rewritten.*
- **Before:** "A student MUST pull §521-73 and confirm it conditions termination
  as implied; the confident citation is precisely what the assignment teaches
  students never to trust unverified."
- **After** (marker: *"VERIFIED WRONG: §521-73 does not condition termination —
  that is §521-63"*): "We pulled the statute. §521-73, 'Landlord's and tenant's
  remedies for abuse of access,' supplies damages liability only… It says nothing
  about ending a lease and imposes no precondition on doing so. The tenant's
  termination remedy is §521-63… So opposing counsel's question… is anchored to
  the wrong section, and a student who accepts the framing argues the wrong
  statute. This is the assignment in miniature: the citation is real, the section
  number is real, and the proposition it is cited for is still false. That is far
  harder to catch than an invented case name, and it is exactly why the rubric
  grades citation verification."
- **Why it matters:** the before left the question open and told the student to
  go check. The after answers it. The Law page's own `aiFailsHere` warns that
  LLMs fabricate citations with correct-looking formatting — leaving an unchecked
  citation on that page was the specific risk phase 7 existed to remove.

**CP-03** — *transcript, not rewritten.* The Chinese of *Analects* 13.18 is
corrupted: the transcript reads 子為子隱 ("the son conceals for the son") where the
received text is 子為父隱 ("the son conceals for the father"), collapsing the
reciprocity the passage turns on. The English gloss one line above it is correct,
which is what makes it skimmable past.

**CP-04** — *annotation rewritten.*
- **Before:** "An accurate rendering of the Analects passage; a student should
  still verify the character text and translation against their own edition
  rather than trust it."
- **After** (marker: *"VERIFIED WRONG: the Chinese quotation is corrupted —
  子為子隱 should read 子為父隱"*): "…Note what makes this dangerous: the English
  gloss one line above it is correct, so the error is visible only to a reader
  who actually reads the characters. A student quoting this in a paper would be
  quoting a sentence Confucius never said, in a passage they cited correctly."
- **Why it matters:** the before **asserted the Chinese was accurate.** It was
  not. This is the single most dangerous line the audit found: the site was
  vouching for a corrupted primary-source quotation.

**CP-05** — *transcript, not rewritten.* *Analects* 1.2 names 孝弟 (filial piety
**and** fraternal respect) as the root of *ren*, not *xiao* alone, and the line is
spoken by the disciple Youzi, not Confucius.

**CP-07** — *transcript, not rewritten.* Shun's father is Gusou (瞽瞍), not
"Gushou". Both CP-05 and CP-07 are now named in the CP annotation at index 2.

**TE-05** — *annotation rewritten, and this one was a retraction.*
- **Before:** "Despite the caveat, it still produced specific Ilocano words; a
  teacher who skims past the warning could print an error — the subtle-wrongness
  failure in miniature."
- **After** (marker: *"We checked the Ilocano: all four words are correct"*):
  "danum (water), ulep (cloud), tudo (rain) and init (sun) are all attested
  Ilocano… Worth sitting with: the model was right, and it was still right to
  refuse to vouch for itself. The rubric grades the verification, not the
  outcome — a teacher who printed these unchecked got lucky, and would have no
  way of knowing which time was the unlucky one."
- **Why it matters:** the site was **asserting an error that did not exist.** The
  audit disproved our own annotation. The pedagogical point survives and is
  sharper.

**LD-03** — *annotation rewritten, also a retraction.*
- **Before:** "These are the values a student must run through a checker; the
  a11y-audit demo exists precisely to catch a claim like 'both exceed 4.5:1'
  stated without measurement."
- **After** (marker: *"We ran the numbers: #1a1a1a on white = 17.40:1, white on
  #005a9c = 7.14:1, #d40000 on white = 5.53:1"*): "Every contrast claim in this
  output holds… The lesson survives intact and gets sharper: the model asserted
  'both exceed 4.5:1' having measured nothing, and happened to be right. A
  student cannot tell a lucky assertion from a checked one by reading it, which
  is why the audit log, not the claim, is the graded artifact."

**OPS-01** — *prose rewritten in 14 places across all 15 content files and
`src/build.js`.*
- **Before:** "7–10 day turnaround"
- **After:** "7–10 **business** days — about two calendar weeks"
- **Why it matters:** PACE publishes 7–10 **business** days for both 3D printing
  and laser cutting. That is 9–14 calendar days. A faculty member planning a
  four-week module against a 7–10 *calendar*-day estimate can miss the return
  date by up to a week — enough to break the module. Source:
  `pace.shidler.hawaii.edu/maker/`.

---

## Interaction test results, per demo

`node src/interact.js` — real interactions, asserting on the **result** (output
text, readouts, scores), not on the absence of errors. **212 assertions, 0
failures, 0 console or page errors.**

| Page | Assertions | What was actually driven |
|---|---|---|
| `zoning-tradeoffs` | 27 ✅ | All 4 sliders to their own min and max; 4 outcome readouts + 4 value labels required non-empty, NaN/undefined/Infinity-free, and **different** at the two extremes. |
| `break-even` | 21 ✅ | Same, plus a negative-margin case (price below unit cost → reports "Never", not `Infinity`) and a profitable case. |
| `crater-sim` | 24 ✅ | Same, plus a flagged-physics case (5° impact angle) where the readout must still resolve. |
| `district-redraw` | 8 ✅ | A real **mouse drag** across four precincts: cells repaint, the deviation readout changes, a district crosses **±5%**, the red state fires, and red/green agrees with the computed number for all three districts. |
| `variant-explainer` | 23 ✅ | All 5 variants toggled: distinct explanatory text for each, nonsense truncates at STOP, silent leaves the protein identical while changing the sequence, frameshift scrambles downstream. |
| `a11y-audit` | 15 ✅ | An injected `#EFEFEF` fixture is reported **FAIL at the ratio actually measured** (~1.1:1, not a canned number) and named in the detail; the **same checker reports PASS** once the page is made compliant; both shipped break-switches produce real failures. |
| `intake-branching` | 19 ✅ | An advice path and a reflective path walked to completion, reaching **different** end states at different trust levels. |
| `tradition-critique` | 10 ✅ | A correct highlight (3 of 3 departures) and an incorrect one (0 of 3, 1 false alarm) — different scores, correct hit/false-alarm marking. |
| `presenter-kit` | 55 ✅ | Loaded with **every http request aborted**; timer arithmetic against a frozen clock in all three states (on plan / running long / ahead); pause, two-click reset, keyboard control; 8 demo links resolve on disk; 8 stills decode to real images. |
| `closing-card` | 10 ✅ | Renders offline; shows URL, QR and challenge; fits 1920×1080, 1280×800 and 1024×768 with **no scrolling in either axis**. |

**Keyboard operability is checked by parity, not presence** — for every demo the
interaction is performed with the mouse, the resulting state recorded, the page
reloaded, the same interaction performed with Tab + Enter/Home/End/digit keys
alone, and the two states required to be **identical**. Every demo also asserts
every control is Tab-reachable.

### Two real bugs the interaction tests caught

**1. `intake-branching` could never be won.** The end screen branched on
`trust >= 55`, but trust starts at 40 and the four reflective options are worth
+2, +2, +3, +3 — capping any playthrough at **50**. The "she opened up" branch
was unreachable dead code: *every* session ended in failure however well it was
played, and a faculty member who played it perfectly was told "too few of your
responses reflected what she said." Threshold moved to 48, inside the reachable
band. **This was completely invisible to the first run's load-and-screenshot
verification** and is the strongest argument for phase 8 existing.

**2. The presenter page's keyboard shortcuts died on first use.** The `keydown`
handler ignored events whose target was a `BUTTON`, so N and P went silently dead
the moment anyone pressed Start with a trackpad — i.e. from the first ten seconds
of the session. Space still defers to a focused control (its native activation
key), but N/P/arrows now work regardless of focus.

---

## What was built this run

- **`src/interact.js`** — 212-assertion interaction suite over 8 demos, the
  presenter kit and the closing card.
- **`src/check.js`** — the whole validation run in one command. Deliberately
  separate from `validate.js` so that file stays zero-dependency; the interaction
  stage is always attempted and **fails loudly** when playwright is absent rather
  than skipping to a false green.
- **`src/pdf.js`** — 16 PDFs: 15 discipline handouts at **3 pages** each and
  `all-handouts.pdf` at **46 pages** (cover + contents + 15 handouts), 516 KB.
- **`src/screens.js`** — the 8 fallback stills, committed to `assets/screens/`
  as reproducible input so `build.js` stays zero-dependency.
- **`src/qr.js`** — `assets/qr.svg`, 27×27 modules, self-verified by rasterising
  and scanning back.
- **Print stylesheet** on every discipline page: no navigation, no iframes, demo
  sections replaced by a line naming the demo and its URL, black on white, page
  breaks between major sections (12 sheets per discipline — see BLOCKERS.md for
  the one line to change if that is too many).
- **`dist/presenter/index.html`** — 916 KB, one file, zero subresources.
- **`dist/closing-card.html`**, **`dist/qr.svg`**, and a **feedback `mailto:`**
  on all 15 discipline pages.
- **Hub access detail** (per Tim): fabrication files go through the PACE request
  form from a UH email address; in-person access is by appointment and separate
  from submitting a file; Tim has the form link.

---

## What a human must review before Wednesday (prioritized)

1. **The Day 10 challenge sentence on the closing card was written by me, not
   supplied.** Nothing in the repo records what the challenge is. What ships:
   *"Before Day 10: run one starter prompt from your own discipline's page
   against your own course material, and bring back the place where the model was
   confidently wrong."* It is one string, `DAY10_CHALLENGE`, at the top of
   `src/build.js`. **Confirm or replace it.**
2. **Confirm the two rehearsed prompts are the ones actually rehearsed.** The
   brief said "the two rehearsed starter prompts" without saying which. I chose
   `learning-design` (0:30 live build) and `finance` (0:50 challenge exercise) —
   both real prompts from the site, both domain-neutral, both with a demo on the
   page showing what they produced. Two slugs in `REHEARSED` in `src/build.js`.
3. **Verify `https://el3vate.vercel.app` actually serves this build.** Nothing in
   this run touched the network. The QR, the closing card and all 15 feedback
   links point at it. If it is wrong, `src/qr.js` must be re-run or the QR is
   wrong on a shared screen in front of the room.
4. **PACE 3D printing was listed as closed for the summer** as of the phase-7
   audit, and every multi-week plan depends on fabrication. Confirm the reopening
   date before faculty leave the room, or the multi-week version is not runnable
   this fall. *(Carried forward from the first run — still open.)*
5. **The three transcripts whose annotations now say the model was wrong** — law
   (§521-73 vs §521-63), comparative-philosophy (the corrupted 13.18 characters,
   the 1.2 attribution, Gusou) — should be read by a domain expert. They are the
   most valuable content on those pages and the most embarrassing if the
   *correction* is itself wrong.
6. **Sanity-check the `intake-branching` scoring gradient.** 48 was chosen to
   keep exactly one non-reflective-but-harmless move survivable. That is a
   pedagogical judgement about how forgiving the exercise should be, not just a
   number.
7. **Decide whether 12 printed pages per discipline is acceptable.** The literal
   reading of "page breaks between major sections" shipped. One line changes it.
8. **`assets/screens/*.png` will go stale silently** if anyone edits a demo
   without re-running `node src/screens.js`. It is the one staleness path in the
   kit that is not gated.

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
  *Superseded: the second run added gates 8, 9 and 10 — **ten** gates and 22
  fixtures. See the phases 8–12 section above.*
- **Screenshots** in `dist/_screens/` (hub + political-science, urban-planning,
  finance) captured with headless Chrome.

`dist/` is generated and git-ignored; it is not committed.

## What was skipped, and why

- **Nothing material was skipped.** All 8 demos were built (the brief allowed
  dropping the last four under time pressure); all 15 disciplines are complete;
  `promptOutput` is genuine and non-null for all 15.
- ~~**Not automated:** full click-through interaction testing of the demos.~~
  **Closed in phase 8.** Playwright + chromium installed cleanly;
  `src/interact.js` drives all eight demos through real interactions and asserts
  on the results, 212 assertions passing, plus keyboard-parity checks. It found
  a bug that made `intake-branching` unwinnable. See the phases 8–12 section.

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

All six pass on the real build. *Superseded by the second run: there are now ten
gates and 22 fixtures, and the current contrast count is 68 fg/bg pairs — the
full current table is in the phases 8–12 section above.*

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
- ~~**Demo interaction is not automated end-to-end.**~~ **Fixed in phase 8** —
  and the intake-branching tree, one of the two things this line asked a human to
  click through, turned out to be unwinnable. Both named paths are now covered
  automatically.
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
