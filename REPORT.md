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

---

# THIRD RUN — phases 13 through 17

_Run 2026-07-28. Five phases, five commits, explicit file lists throughout._

| Phase | Commit | What it did |
|---|---|---|
| 13 | `84c3343` | Kill switch (`USE_SUPABASE`) + display-only `ALIASES` |
| 14 | `0802827` | `db/001_feedback.sql`, authored and **not applied** |
| 15 | `cd3c141` | Feedback form, gated entirely behind the phase-13 switch |
| 16 | `51b3601` | Gates 11–14, each proven failable |
| 17 | this commit | This report |

## The bottom line, from build output rather than intent

```
$ node src/build.js
built 15 discipline pages + hub into dist/ (build 51b3601 2026-07-29T02:34:18.009Z)
SITE_URL = https://el3vate.vercel.app
FEEDBACK_EMAIL = tclum@hawaii.edu
ALIASES = https://el3vate.forpono.com  [display only — never SITE_URL]
USE_SUPABASE = false  url=empty  key=empty  ->  feedback backend OFF (mailto only)
```

```
$ node src/validate.js
[11] KILL-SWITCH REVERSIBILITY  PASS  (USE_SUPABASE=false, url=empty, key=empty -> backend OFF; 59 files in dist/ scanned)
     switch is OFF: dist/ must contain no reference to the backend at all
[12] NO ELEVATED KEY  PASS  (51 tracked files + all of dist/; 0 decodable JWT(s) found)
[13] SITE_URL INTEGRITY  PASS
     SITE_URL  https://el3vate.vercel.app   (pinned: https://el3vate.vercel.app)
     ALIASES   https://el3vate.forpono.com   [display only]
[14] DEMO ISOLATION  PASS  (GATE 5 re-asserted: holds; 8 files under dist/demos/)

ALL GATES PASS
```

```
$ grep -n "^const USE_SUPABASE" src/build.js
45:const USE_SUPABASE = false;              // master switch for everything in phases 13-17

$ grep -ril "supabase" dist/ ; echo "exit=$?"
exit=1                     # no output, no match, anywhere in dist/
```

`USE_SUPABASE` is committed `false`. Both credentials are committed as empty
strings. GATE 11 scanned all **59 files** in `dist/` and found no occurrence of
`supabase` in any of them. **That is the state Tim presents from tomorrow, and
it is byte-for-byte the phase-12 site plus one line of footer text.**

Both hard constraints held:

- **CONSTRAINT A** — `SITE_URL` is unchanged at `https://el3vate.vercel.app`.
  `assets/qr.svg`, `assets/qr.json`, `dist/closing-card.html` and the 916 KB
  presenter kit were not regenerated and did not need to be. The forpono domain
  appears in exactly one place, as plain text in the hub footer, and GATE 13 now
  fails the build if it is ever substituted into `SITE_URL`.
- **CONSTRAINT B** — GATE 5 is unchanged; not one character of it was relaxed,
  weakened or scoped. GATE 14 re-runs it and additionally bars the backend from
  every file under `dist/demos/`. No demo file gained a network call. The 212
  phase-8 interaction assertions still pass.

## What shipped

### Phase 13 — the kill switch

Five constants at the top of `src/build.js`, next to `SITE_URL`:

```js
const ALIASES = ['https://el3vate.forpono.com'];   // display only; never SITE_URL

const USE_SUPABASE = false;              // master switch for everything in phases 13-17
const SUPABASE_URL = '';                 // filled by Tim
const SUPABASE_ANON_KEY = '';            // filled by Tim — anon key ONLY, never the service-role key

const SUPABASE_ON =
  USE_SUPABASE && String(SUPABASE_URL).trim() !== '' && String(SUPABASE_ANON_KEY).trim() !== '';
```

`SUPABASE_ON` is the predicate every phase-15 emission is gated on — never
`USE_SUPABASE` alone. The two credentials are a second, independent interlock: if
either is blank the switch counts as off whatever the boolean says, so a
half-configured build cannot ship a form that posts nowhere. GATE 11 has a
fixture for exactly that case.

With the switch off the build emits **nothing** — not the form markup, not the
script, not a dead CSS selector. `FBFORM_CSS` and `FBFORM_PRINT_CSS` are
interpolated into the stylesheet only when `SUPABASE_ON`. That is stricter than
the brief asked for and it is what makes GATE 11 a clean binary rather than a
list of exceptions.

`ALIASES` renders as plain text in the hub footer and nowhere else:

```html
<footer><div class="wrap">EL3vate 2026 · Day 8 session resource · Prepared for the
faculty cohort · Build 51b3601 · also at el3vate.forpono.com</div></footer>
```

Not an `<a href>`, deliberately — the canonical address stays `SITE_URL`.

### Phase 15 — the form

Replaces the `mailto:` link on each discipline page **when and only when the
switch is on**. Three fields: what you tried (required), what happened
(optional), contact email (optional, and the label, the hint text and the SQL
comment all say so). Discipline is filled from the page automatically and posted
as the slug, which is what the `CHECK` constraint validates against.

One inline `fetch` to the REST endpoint with the anon key. No SDK, no
dependency, nothing added to `package.json`.

**Failure is visible and lossless.** On a network error, a 12-second timeout, or
any non-2xx status, the `mailto:` fallback is revealed with the discipline
already in the subject *and what they typed spliced into the body*, so a broken
backend degrades to the phase-11 behaviour instead of eating the submission. The
`mailto:` anchor is present in the markup in both switch states, which is why
GATE 10's per-discipline feedback-link check keeps passing either way.

The form is in the page shell. It is not in any demo, not in the demo iframe, and
not autofocused — it sits at the bottom of a long page and stealing focus on load
breaks screen-reader flow.

## Phase 14 — the migration SQL, authored and NOT applied

**Nothing was applied.** No database credentials were requested, obtained or
held, and no migration was run. No Postgres is installed on this machine
(`psql`, `postgres` and `pg_ctl` are all absent), so this file is
syntax-reviewed, not executed — see "what could not be run" below. Tim applies
it himself in the Supabase SQL editor and runs the verification query after.

### The full migration

```sql
-- ============================================================================
-- 001_feedback.sql — EL3vate 2026 Day 8 session feedback
-- ============================================================================
-- Authored 2026-07-28 for the EL3vate Day 8 site (https://el3vate.vercel.app).
--
-- THIS FILE HAS NOT BEEN APPLIED. It was written to be read line by line and
-- run by hand in the Supabase SQL editor. Nothing in the site's build or deploy
-- path executes it, and no automated process holds credentials for this project.
-- Run the verification query at the bottom of this file immediately afterwards;
-- it is the only thing that confirms the applied state matches the intent here.
--
-- WHAT THIS BACKS
-- One form, at the bottom of each of the fifteen discipline pages, asking a
-- faculty member what they tried and what happened. The page is public static
-- HTML served from a CDN, so the anonymous (publishable) key is embedded in it
-- in plain sight. Everything below follows from that single fact.
--
-- THE SECURITY MODEL, STATED PLAINLY
--   * Row-level security is ENABLED, and there is exactly ONE policy: anonymous
--     INSERT. No select, update or delete policy exists for `anon`, and none may
--     be added. With RLS on and no matching policy, those commands return zero
--     rows / affect nothing for `anon` — that is the whole protection.
--   * Anything `anon` can read, the entire internet can read, because the key
--     that authorises `anon` ships inside a public web page. `contact_email` is
--     a real email address volunteered by a colleague; a select policy on this
--     table would publish those addresses.
--   * Tim reads submissions through the Supabase dashboard, authenticated as
--     himself. Reads never go through `anon`.
--   * The key in the page is the anonymous/publishable key ONLY. The elevated
--     key — written here as "service-role", hyphenated, because GATE 12 in
--     src/validate.js fails the build on the underscored spelling appearing in
--     any tracked file — bypasses RLS entirely and must never be pasted into
--     src/build.js, a demo, an env file under dist/, or anything else that
--     reaches a browser.
--
-- ABUSE CONTROL — READ THIS BEFORE ASSUMING YOU HAVE ANY
-- The CHECK constraints below are the ONLY abuse control available at the
-- database layer. They bound how large a single row can be and restrict
-- `discipline` to the fifteen known slugs, which stops a junk row from carrying
-- a megabyte of text or naming a page that does not exist.
--
--   THEY ARE NOT RATE LIMITING. They do not stop the same client from inserting
--   ten thousand well-formed rows in a minute. Postgres cannot express that
--   constraint here, and this project has no server of its own to enforce it.
--
-- Configure the actual limits in the Supabase dashboard, separately, before the
-- form is switched on:
--   * Project Settings -> API -> rate limiting on the REST endpoint.
--   * A CAPTCHA/attestation provider on the project if the volume warrants it.
--   * If a flood happens mid-session, the fastest kill is not in this file at
--     all: flip USE_SUPABASE back to false in src/build.js and run
--     `./ship.sh prod`. That removes the form and the key from the site inside
--     two minutes and the mailto: fallback takes over.
--
-- RUN ONCE
-- The whole migration is wrapped in begin/commit. `create table if not exists`
-- is idempotent but `alter table ... add constraint` is not — Postgres has no
-- `add constraint if not exists` — so a second run errors on the first
-- constraint and the transaction rolls back whole. That is a safe failure, not
-- a partial apply, but it means the right response to "did that go through?" is
-- the verification query below, not running the file again.
--
-- REVERSIBILITY
--   drop table if exists public.el3vate_feedback;   -- takes the policy with it
-- ============================================================================

begin;

-- gen_random_uuid() lives in pgcrypto. Supabase enables it by default; this is
-- here so the file also applies cleanly to a bare Postgres.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- table
-- ---------------------------------------------------------------------------
create table if not exists public.el3vate_feedback (
  id               uuid        primary key default gen_random_uuid(),
  created_at       timestamptz not null     default now(),
  discipline       text        not null,
  what_they_tried  text        not null,
  what_happened    text,
  contact_email    text,
  user_agent       text
);

comment on table public.el3vate_feedback is
  'EL3vate 2026 Day 8 session feedback. Anonymous insert only; RLS on; no anon read. Read via the dashboard.';
comment on column public.el3vate_feedback.discipline is
  'Discipline page slug the submission came from. Filled automatically by the form, constrained to the 15 known slugs.';
comment on column public.el3vate_feedback.contact_email is
  'Optional and nullable. Only present if the submitter wants a reply. Never exposed to anon — see the RLS policy.';
comment on column public.el3vate_feedback.user_agent is
  'Optional. Browser UA string, for telling a phone submission from a laptop one. Not an identifier.';

-- ---------------------------------------------------------------------------
-- check constraints — bounded size, known slugs. NOT rate limiting; see header.
-- ---------------------------------------------------------------------------
-- Added separately (rather than inline) so each one has its own name and can be
-- dropped or adjusted without rewriting the table definition.

alter table public.el3vate_feedback
  add constraint el3vate_feedback_tried_len
  check (char_length(what_they_tried) between 1 and 4000);

alter table public.el3vate_feedback
  add constraint el3vate_feedback_happened_len
  check (what_happened is null or char_length(what_happened) <= 4000);

alter table public.el3vate_feedback
  add constraint el3vate_feedback_email_len
  check (contact_email is null or char_length(contact_email) <= 254);

alter table public.el3vate_feedback
  add constraint el3vate_feedback_ua_len
  check (user_agent is null or char_length(user_agent) <= 512);

-- The fifteen slugs are the fifteen files in content/ (excluding claims.json,
-- which is the claim audit, not a discipline). If a sixteenth discipline is ever
-- added, this list must be extended or its submissions will be rejected.
alter table public.el3vate_feedback
  add constraint el3vate_feedback_discipline_known
  check (discipline in (
    'bioinformatics',
    'comparative-philosophy',
    'english-literature',
    'entrepreneurship',
    'family-business',
    'finance',
    'law',
    'learning-design',
    'marketing',
    'marriage-family-therapy',
    'nutrition',
    'planetary-science',
    'political-science',
    'teacher-education',
    'urban-planning'
  ));

-- ---------------------------------------------------------------------------
-- row-level security
-- ---------------------------------------------------------------------------
alter table public.el3vate_feedback enable row level security;

-- Belt and braces: `enable` leaves the table owner and any BYPASSRLS role able
-- to skip policies. `force` makes the policy apply to the owner too, so a future
-- connection as the owning role cannot quietly read the table through the API.
alter table public.el3vate_feedback force row level security;

-- EXACTLY ONE POLICY. Anonymous insert, nothing else.
--
-- There is deliberately no policy for select, update or delete, for `anon` or
-- for `authenticated`. Do not add one. With RLS enabled and no matching policy,
-- a select through the anon key returns an empty set rather than the table.
--
-- `with check (true)` is correct here and is not a hole: it is the row-level
-- predicate for the row being inserted, and the column-level CHECK constraints
-- above are what bound its contents. There is no per-row ownership concept on
-- this table — every row is an anonymous submission — so there is nothing else
-- to predicate on.
drop policy if exists el3vate_feedback_anon_insert on public.el3vate_feedback;
create policy el3vate_feedback_anon_insert
  on public.el3vate_feedback
  for insert
  to anon
  with check (true);

-- The REST endpoint needs the schema and the insert privilege on top of the
-- policy: RLS filters, grants admit. `anon` gets INSERT and nothing more — no
-- SELECT grant, so even a mistakenly added select policy would still be blocked
-- by the missing privilege.
grant usage  on schema public              to anon;
grant insert on table  public.el3vate_feedback to anon;

revoke select, update, delete, truncate, references, trigger
  on table public.el3vate_feedback from anon;

-- Reading is by dashboard, authenticated as a real person, so nothing is granted
-- to `authenticated` either.
revoke all on table public.el3vate_feedback from authenticated;

-- ---------------------------------------------------------------------------
-- index: submissions are read newest-first in the dashboard
-- ---------------------------------------------------------------------------
create index if not exists el3vate_feedback_created_at_idx
  on public.el3vate_feedback (created_at desc);

commit;
```

### The verification query Tim runs after applying

```sql
-- ============================================================================
-- VERIFICATION — run this after the migration, in the same SQL editor.
-- ============================================================================
-- It returns one row per check with a PASS/FAIL verdict and the actual observed
-- value, so it is readable rather than silent. FIVE rows should come back, and
-- every `verdict` must read PASS. An empty result is itself a failure: it means
-- the table is not there at all.
--
-- Expected output (5 rows, every verdict PASS):
--
--   check                                       verdict  observed
--   ------------------------------------------  -------  --------------------------------------------------
--   1. table exists                             PASS     public.el3vate_feedback
--   2. RLS enabled                              PASS     relrowsecurity=true relforcerowsecurity=true
--   3. exactly one policy                       PASS     1 policy/policies: el3vate_feedback_anon_insert
--   4. that policy is INSERT for anon           PASS     el3vate_feedback_anon_insert cmd=INSERT roles={anon}
--   5. no select/update/delete policy for anon  PASS     0 non-INSERT policy/policies reachable by anon: none
--
-- Anything other than five PASS rows means STOP: leave USE_SUPABASE false and do
-- not ship the form.
--
-- ("check" is quoted throughout because it is a reserved word in Postgres and an
-- unquoted column alias by that name is a syntax error.)

select '1. table exists' as "check",
       case when count(*) = 1 then 'PASS' else 'FAIL' end as verdict,
       coalesce(string_agg(schemaname || '.' || tablename, ', '), '(no such table)') as observed
from pg_tables
where schemaname = 'public' and tablename = 'el3vate_feedback'

union all

select '2. RLS enabled',
       case when bool_and(c.relrowsecurity) then 'PASS' else 'FAIL' end,
       coalesce(string_agg('relrowsecurity=' || c.relrowsecurity ||
                           ' relforcerowsecurity=' || c.relforcerowsecurity, ', '),
                '(no such table)')
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'el3vate_feedback'

union all

select '3. exactly one policy',
       case when count(*) = 1 then 'PASS' else 'FAIL' end,
       count(*) || ' policy/policies: ' ||
         coalesce(string_agg(policyname, ', '), '(none)')
from pg_policies
where schemaname = 'public' and tablename = 'el3vate_feedback'

union all

select '4. that policy is INSERT for anon',
       case when count(*) = 1 then 'PASS' else 'FAIL' end,
       coalesce(string_agg(policyname || ' cmd=' || cmd || ' roles=' || roles::text, ', '),
                '(no INSERT policy for anon)')
from pg_policies
where schemaname = 'public'
  and tablename  = 'el3vate_feedback'
  and cmd        = 'INSERT'
  and roles::text[] = array['anon']

union all

select '5. no select/update/delete policy for anon',
       case when count(*) = 0 then 'PASS' else 'FAIL' end,
       count(*) || ' non-INSERT policy/policies reachable by anon: ' ||
         coalesce(string_agg(policyname || ' (' || cmd || ')', ', '), 'none')
from pg_policies
where schemaname = 'public'
  and tablename  = 'el3vate_feedback'
  and cmd       <> 'INSERT'
  and (roles::text[] && array['anon', 'public'])

order by 1;

-- Optional second check, once the form has been switched on and one real
-- submission has been made. Run it as yourself in the dashboard; it should show
-- the row. If it shows nothing, the insert path is broken and the form is
-- silently dropping submissions.
--
--   select id, created_at, discipline, left(what_they_tried, 60) as tried
--   from public.el3vate_feedback
--   order by created_at desc
--   limit 20;
```

### Why there is exactly one policy

The anon key ships inside a public HTML page served from a CDN. Anything `anon`
can read, the entire internet can read — including `contact_email`, which is a
real address volunteered by a colleague. So `anon` gets `INSERT` and nothing
else: no select/update/delete policy, and no `SELECT` grant either, so even a
mistakenly added policy would still hit a missing privilege. Reads go through the
Supabase dashboard, authenticated as Tim.

`force row level security` is on as well as `enable`, so a future connection as
the owning role cannot quietly read the table through the API.

### The `CHECK` constraints are not rate limiting

Stated in the file header and repeated here because it is the easiest thing to
misread as protection. The constraints bound row size (4000 chars on each text
field, 254 on the email, 512 on the UA) and restrict `discipline` to the fifteen
known slugs. They stop one junk row from carrying a megabyte or naming a page
that does not exist. **They do not stop ten thousand well-formed rows in a
minute.** Configure the real limits in the dashboard before switching the form
on — Project Settings → API rate limiting, and a CAPTCHA/attestation provider if
volume warrants. If a flood happens mid-session, the fastest kill is not in the
database at all: flip `USE_SUPABASE` to `false` and run `./ship.sh prod`.

## Phase 16 — every new gate's demonstrated failure input

Each gate was fed a deliberately broken fixture, confirmed to reject it, and the
fixture deleted. Four gates additionally got a **negative control** — an input
that is deliberately *right* and must pass — because a gate that fails everything
is as useless as one that fails nothing, and gates 11, 12 and 14 all have an
"allowed" branch that would otherwise never be exercised.

`node src/validate.js --selftest`, verbatim:

```
OK   kill-switch (clean off-state build): control => PASS (correctly allowed)  | switch off and no backend reference anywhere in dist/ — the committed state
OK   kill-switch (backend reference survives the revert): fixture => FAIL (caught)  | switch off but dist/law/index.html still contains the string "supabase"
OK   kill-switch (credential value survives the revert): fixture => FAIL (caught)  | switch off but the SUPABASE_URL value is still present in dist/index.html (the word "supabase" is not)
OK   kill-switch (form with no mailto fallback): fixture => FAIL (caught)  | switch on, form emitted, but no id="fb-mailto" — a backend failure would lose the submission
OK   kill-switch (half-configured build): fixture => FAIL (caught)  | USE_SUPABASE true with an empty SUPABASE_URL — the credential interlock was bypassed
OK   kill-switch (computed switch): fixture => FAIL (caught)  | `const USE_SUPABASE = process.env.ON === "1";` instead of a bare boolean literal
OK   elevated key (elevated JWT in dist/): fixture => FAIL (caught)  | a JWT in dist/index.html whose decoded payload reads role=<the elevated role>
OK   elevated key (anon JWT in dist/ is allowed): control => PASS (correctly allowed)  | the same JWT shape with role=anon — legitimate when the switch is on, must not be rejected
OK   elevated key (modern secret key in dist/): fixture => FAIL (caught)  | an sb_secret_… key in dist/index.html — not a JWT, so the payload decode cannot see it
OK   elevated key (role named in tracked source): fixture => FAIL (caught)  | the underscored token in a tracked .js file
OK   elevated key (role named in tracked Markdown is allowed): control => PASS (correctly allowed)  | the same token in a tracked .md — documentation of the policy, and a real key there is still caught by the JWT/secret checks
OK   elevated key (elevated JWT pasted into Markdown): fixture => FAIL (caught)  | an elevated JWT inside a .md — the Markdown exception covers the name, never the key
OK   elevated key (tracked files unenumerable): fixture => FAIL (caught)  | git ls-files failed, so the repo could not be confirmed clean
OK   site-url (pinned value with the alias present as text): control => PASS (correctly allowed)  | SITE_URL pinned, alias shown as display text in the footer — the committed state
OK   site-url (alias substituted into SITE_URL): fixture => FAIL (caught)  | SITE_URL set to https://el3vate.forpono.com — it invalidates the QR, the closing card and the presenter kit
OK   site-url (deployment hostname as SITE_URL): fixture => FAIL (caught)  | SITE_URL set to a deployment-frozen el3vate-<hash>- hostname
OK   site-url (deployment hostname baked into dist/): fixture => FAIL (caught)  | SITE_URL correct, but dist/index.html still carries a frozen el3vate-<hash>- hostname
OK   demo isolation (an offline demo): control => PASS (correctly allowed)  | canned data, no network call, no mention of the backend
OK   demo isolation (GATE 5 broken inside a demo): fixture => FAIL (caught)  | a demo calling fetch( — CONSTRAINT B, the session runs with the network dead
OK   demo isolation (backend named inside a demo): fixture => FAIL (caught)  | a demo mentioning the backend (also caught by GATE 5 via the bare URL)
OK   demo isolation (backend named in a non-HTML demo asset): fixture => FAIL (caught)  | a .json asset under dist/demos/ naming the backend — GATE 5 only reads .html, this gate reads every file
OK   demo isolation (form markup inside a demo): fixture => FAIL (caught)  | feedback-form markup inside a demo — the form belongs to the page shell only

SELFTEST PASS: every gate rejected its broken fixture.
```

### The one gate failure that was not a fixture

GATE 12's `sb_secret_…` selftest fixture was first written as a plain string
literal in `src/validate.js`. `src/validate.js` is a tracked file, so on the very
next run **the gate failed the real build on it**:

```
[12] NO ELEVATED KEY  FAIL  (51 tracked files + all of dist/; 0 decodable JWT(s) found)
     src/validate.js contains a Supabase secret key (sb_secret_<8 chars>…)
```

That is the strongest evidence available that this check works on real input and
not only on fixtures: it caught a secret-key-shaped string that nobody planted
for it to find. The fixture is now assembled from fragments, and the failure is
recorded here rather than quietly fixed.

**And then it happened again, writing this report.** The line above was first
pasted in verbatim, with the fixture's real characters. `REPORT.md` is tracked,
the key-shape check has no Markdown exception, and the gate failed the build a
second time:

```
[12] NO ELEVATED KEY  FAIL  (51 tracked files + all of dist/; 0 decodable JWT(s) found)
     REPORT.md contains a Supabase secret key (sb_secret_<8 chars>…)
```

Which is the point. The `.md` exception covers the *name* of the role and nothing
else; a key-shaped string in documentation is still a key-shaped string in the
repo, and the gate does not care that it was only ever meant as an example. The
value is redacted above.

### A note on GATE 12's one exception

Phase 13 of the brief specifies a comment containing the underscored
`service`+`_role` token in `src/build.js`. Phase 16 gate 2 specifies a gate that
fails on that token in **any tracked file**. `src/build.js` is tracked, so the
mandated comment is exactly the input the mandated gate rejects — and it is worse
than that, because `AGENT-BRIEF-3.md` is itself tracked and names the token twice
while specifying this gate.

The gate splits the question in two:

- **Is this a key?** Every JWT-shaped string in `dist/` *and every tracked file*
  is base64url-decoded and its role claim read; the newer non-JWT `sb_secret_…`
  format is matched separately. **No exceptions, no skipped file, no file-type
  carve-out.** This is the check that would catch an actual leak, and it has no
  holes. It also tells an anon JWT from an elevated one, which matters because
  with the switch on a legitimate anon key is *supposed* to be in `dist/`.
- **Does this name the role?** Barred from `dist/` outright, and from every
  tracked file **except `.md`**. That is the whole of the exception. Markdown here
  is specification and record — the brief, `BLOCKERS.md`, this report — and a real
  key pasted into a `.md` is still caught by the checks above.

Everything that is not Markdown spells it `service-role` with a hyphen. It reads
identically. `src/validate.js` assembles its needles from fragments because the
gate scans the file it lives in. If Tim wants the underscored spelling in the
`src/build.js` comment, the name check has to grow a per-file exemption list; the
key checks would be unaffected, but an exemption list is the thing that
eventually lets a real key through. Recorded in `BLOCKERS.md`.

## What Tim does to turn this on

Four steps, in this order. Do not reorder them — the gates will stop you, but the
reason to do it in this order is that each step is verifiable before the next.

1. **Fill three constants** at the top of `src/build.js` (lines 45–47):

   ```js
   const USE_SUPABASE = true;
   const SUPABASE_URL = 'https://<your-project-ref>.supabase.co';
   const SUPABASE_ANON_KEY = '<the anon / publishable key>';
   ```

   The **anon** key, from Project Settings → API. Not the elevated one. GATE 12
   fails the build if an elevated JWT or an `sb_secret_…` key lands here.

2. **Apply the migration.** Paste `db/001_feedback.sql` into the Supabase SQL
   editor and run it. Then run the verification query from the bottom of the same
   file. **Five rows, every verdict `PASS`.** Anything else — including an empty
   result, which means the table is not there — means stop: set `USE_SUPABASE`
   back to `false` and do not ship the form.

3. **Configure rate limiting in the dashboard.** The `CHECK` constraints are not
   rate limiting. See above.

4. **Ship it:** `./ship.sh prod`. The script builds, restores the Vercel link,
   runs all 14 gates, scrubs any `.env*` from the deploy root, deploys, and then
   polls the live site until it serves this build's stamp. Gates 11–14 run as
   part of that, so a build with a bad key or a broken fallback never reaches
   Vercel.

Then submit one real test row from a discipline page and confirm it appears via
the optional second query at the bottom of the SQL file. If it does not, the form
is silently dropping submissions.

## What Tim does to turn it off — the 8am escape hatch

Two steps. Under two minutes.

1. **Set `USE_SUPABASE = false`** in `src/build.js` (line 45). Leave the two
   credential strings alone; they are inert with the flag off, and blanking them
   is a second edit for no benefit.
2. **`./ship.sh prod`.**

The site returns to `mailto:` feedback links. GATE 11 runs inside `ship.sh` and
fails the deploy if any trace of the backend survived into `dist/`, so the revert
is checked rather than trusted. Nothing needs to be undone in the database —
`el3vate_feedback` can sit there with rows in it and nothing on the public site
knows it exists.

If the panic is worse than that and even the flag edit feels risky:
`git checkout 51b3601 -- src/build.js && ./ship.sh prod` restores the exact
committed off-state file.

## What was actually run, and what could not be

### Ran, with output seen

| Check | Result |
|---|---|
| `node src/build.js`, switch **off** | Built 15 pages + hub. Output quoted above. |
| `node src/build.js`, switch **on** (temporary, fake credentials) | Built; form on all 15 discipline pages, on none of the hub/audit/presenter/demo files. |
| `node src/validate.js`, off-state build | **All 14 gates pass.** |
| `node src/validate.js`, on-state build | **All 14 gates pass.** Contrast checks 78 pairs with the switch on against 68 with it off — the form's colours are gate-checked, not asserted. |
| `node src/validate.js --selftest` | **38 fixtures**, all correct: 34 broken inputs rejected, 4 negative controls allowed. |
| `node src/pdf.js` | 16 handout PDFs. GATE 8 passes; GATE 12 reads them as bytes and finds 0 JWT-shaped strings, so the PDFs are not a blind spot. |
| `node src/interact.js` | **212 assertions, 0 failed, across 10 demos.** No console or page errors. |
| `npm run check` (all five stages) | **CHECK PASSED: every stage green.** |
| Headless Chromium, form ON-state, 13 assertions | All pass — see below. |
| `git diff src/build.js` after restoring | Empty. The temporary on-state edit was reverted byte-identical. |

The browser check drove a real ON-state build in headless Chromium:

- Nothing focused on load (`document.activeElement` is `BODY`).
- Exactly one form in the page shell, **zero** in the demo iframe.
- Empty submit refused with a message, focus moved to the required field.
- Full keyboard tab order: tried → happened → email → send.
- **Network failure path**: the fake host does not resolve, the fallback appears,
  the status reads "That could not reach the server — the wifi, most likely. Use
  the email link below", the fallback `mailto:` keeps `subject=EL3vate Day 8 —
  Law` *and* carries both typed fields in its body, and the send button is
  re-enabled so a retry is possible.
- **HTTP error path** (mocked 401): "That came back as an error (401)." Same
  fallback, same recovery.
- **Success path** (mocked 201): fields hide, fallback stays hidden, status reads
  "Thank you — that is in." The POST body was captured and matches the table
  columns exactly:
  `{"discipline":"finance","what_they_tried":"…","what_happened":"…","contact_email":null,"user_agent":"…"}`
  with `apikey`, `Authorization: Bearer …` and `Prefer: return=minimal` headers.
- 2px focus outline on the fields; **0px horizontal overflow at 375px**.

### Could NOT be run — stated plainly

- **The migration was not applied and the verification query was not executed.**
  By instruction. No database credentials were requested, obtained or held. The
  SQL is authored for Tim to review line by line and run himself. Its correctness
  against a live Postgres is therefore **unverified**.
- **No Postgres is installed on this machine** (`psql`, `postgres`, `pg_ctl` all
  absent), so the SQL was not even parsed by a real server. What was checked:
  balanced parentheses, even quoting, `begin`/`commit` present, no underscored
  role token, and a manual review that caught two real defects before commit —
  `check` is a reserved word and needed quoting as a column alias, and the
  `roles` array comparisons were rewritten to `roles::text[]` to avoid depending
  on `text`/`name` operator resolution. **A syntax error surviving that review is
  possible.** Run it in the SQL editor, which will say so immediately, and note
  that the whole file is wrapped in `begin`/`commit` — a failure rolls back
  whole rather than leaving a partial apply.
- **The form has never posted to a real Supabase endpoint.** Success was verified
  against a mocked 201 with the request captured and inspected; failure was
  verified against a real DNS failure and a mocked 401. What is unverified is the
  live round trip: CORS on the real project, whether the anon key is accepted,
  and whether the `CHECK` constraints accept a real submission. Step 4 of the
  enable procedure — submit one real row and confirm it appears — is what closes
  that, and it is the one step nobody can do for him.
- **No screen-reader pass.** The form is keyboard-operable and correctly
  labelled by construction (`<label for>`, `aria-describedby` hints,
  `role="status" aria-live="polite"` on the status line), and the contrast gate
  checks its colour pairs. Nobody drove it with VoiceOver or NVDA. Same caveat
  the rest of the site carries.
- **Contrast remains a CSS-context heuristic, not a browser render.** Unchanged
  from prior runs. The form's pairs are checked the same way everything else is.

### Phase completion, honestly

All five phases are complete and every phase's gate executed. Phase 14 is the one
that needs qualifying: its deliverable was *authored SQL*, which exists and is
committed, but "the migration works" is not a claim this run can make, and
nothing in this report should be read as making it.

---

# FOURTH RUN — phases 18 through 21

From `AGENT-BRIEF-4.md` rev 4.0. One capability added: the live-build section on
each discipline page can fetch its content at page load, so Tim can change what
the room sees by editing a database row instead of running a deploy.

Reproduce the whole thing with one command:

```
npm run check     # build -> handout PDFs -> 19 gates -> gate selftest -> fallback chain -> demo interaction tests
```

or a stage at a time (the new one is `fallback`):

```
node src/build.js                 # emits dist/                       (zero dependencies)
node src/validate.js              # the 19 gates                      (zero dependencies)
node src/validate.js --selftest   # 73 fixtures, proves every gate can fail
node src/livefallback.js          # CONSTRAINT B, branch by branch    (zero dependencies)
node src/interact.js              # drives the 8 demos + presenter kit (needs playwright)
```

## The bottom line, from build output rather than intent

Both switches are committed `false`, both credentials are committed empty, and
`dist/` contains no backend reference of any kind. That is not a claim about
what the code intends — it is what the build printed and what a scan of all 59
files in `dist/` found:

```
$ grep -nE "^const (USE_SUPABASE|USE_LIVE_FETCH|SUPABASE_URL|SUPABASE_ANON_KEY) " src/build.js
45:const USE_SUPABASE = false;              // master switch for everything in phases 13-17
46:const SUPABASE_URL = '';                 // filled by Tim
47:const SUPABASE_ANON_KEY = '';            // filled by Tim — anon key ONLY, never the service-role key
80:const USE_LIVE_FETCH = false;   // independent of USE_SUPABASE; controls only the live-build fetch

$ node src/build.js
built 15 discipline pages + hub into dist/ (build 76d397d 2026-07-29T10:00:58.719Z)
SITE_URL = https://el3vate.vercel.app
FEEDBACK_EMAIL = tclum@hawaii.edu
ALIASES = https://el3vate.forpono.com  [display only — never SITE_URL]
USE_SUPABASE = false  url=empty  key=empty  ->  feedback backend OFF (mailto only)
USE_LIVE_FETCH = false  (same two credentials, independent switch)  ->  live-build fetch OFF (build-time liveBuild only)
liveBuild baked at build time: 0/15 disciplines  (15 showing the reserved placeholder)
```

Every string that could betray a backend, counted across all 59 files in `dist/`:

| searched for | files in `dist/` |
|---|---|
| `supabase` | 0 |
| `el3vate_live` | 0 |
| `rest/v1` | 0 |
| `SUPABASE_URL` | 0 |
| `SUPABASE_ANON_KEY` | 0 |
| `el3vate_feedback` | 0 |
| `fb-form` | 0 |
| `live-build fetch` (the script sentinel) | 0 |

Gate results on that build: **19/19 PASS**. Selftest: **73 cases, 0 BAD**.
`npm run check`: **6/6 stages green**, including the 212 real browser
interaction tests, which are unchanged from the third run.

## The four constraints, and how each is held

**CONSTRAINT A — `./fill.sh` keeps working, unchanged.** `fill.sh` is not
touched by this run; `git log` shows its last change was the previous commit.
The build-time `liveBuild` field is read and rendered exactly as before, and the
fetch is a layer on top: `sectionLiveBuild()` emits complete markup for the
baked state whether or not the switch is on, and the script can only ever
*replace* that text with something non-empty. Proven by the last two lines of
`node src/livefallback.js`, which build with `USE_LIVE_FETCH=false` and a baked
`liveBuild`, then assert the section still shows the baked text and that no
fetch script was emitted at all.

**CONSTRAINT B — three-deep fallback, every step exercised.** GATE 19 proves the
static half (the section is complete in the served HTML before any script runs).
`src/livefallback.js` proves the runtime half by extracting the emitted script
out of a real built page — it is not retyped — and driving it through fourteen
branches against a stub DOM and a stub fetch. Full output below.

**CONSTRAINT C — demos and presenter kit untouched.** GATE 18 re-asserts GATE 5
and GATE 14 and additionally bars `el3vate_live`, the REST path and the script
sentinel from `dist/demos/` and `dist/presenter/`. GATE 16 re-checks both
directories in all four switch combinations. The presenter kit is still 916 KB
self-contained with zero subresources (GATE 9, unchanged).

**CONSTRAINT D — `SITE_URL` does not change.** Still
`https://el3vate.vercel.app`, still pinned by GATE 13, still the value
`assets/qr.json` encodes. Not edited this run.

## What shipped

### `db/002_live_build.sql` — authored, NOT applied

One table, `el3vate_live`, with fifteen rows seeded `body` NULL so that during
the session Tim only ever *edits* a row and never creates one. RLS enabled with
exactly one policy: **anonymous SELECT** — deliberately the inverse of
`el3vate_feedback`. The full file and its verification query are reproduced
below.

### `USE_LIVE_FETCH` in `src/build.js` — a second, independent switch

```js
const USE_LIVE_FETCH = false;   // independent of USE_SUPABASE; controls only the live-build fetch

const LIVE_FETCH_ON =
  USE_LIVE_FETCH && String(SUPABASE_URL).trim() !== '' && String(SUPABASE_ANON_KEY).trim() !== '';
```

It shares the two credentials with `USE_SUPABASE` and the same interlock — an
empty `SUPABASE_URL` or `SUPABASE_ANON_KEY` forces it off regardless of the flag
— and shares nothing else. GATE 16 builds all four combinations and confirms it.
The combination Tim is most likely to want, `USE_SUPABASE=false` with
`USE_LIVE_FETCH=true`, produces a build with the live fetch and no feedback form:

```
[16] SWITCH INDEPENDENCE  PASS  (4/4 combinations built and inspected)
     USE_SUPABASE=false USE_LIVE_FETCH=false  ->  neither backend, nothing baked in
     USE_SUPABASE=true USE_LIVE_FETCH=false  ->  the feedback form (id="fb-form") + the feedback endpoint (/rest/v1/el3vate_feedback)
     USE_SUPABASE=false USE_LIVE_FETCH=true  ->  the live-fetch script (sentinel) + the live table (el3vate_live) + the live endpoint (/rest/v1/el3vate_live)
     USE_SUPABASE=true USE_LIVE_FETCH=true  ->  the feedback form (id="fb-form") + the feedback endpoint (/rest/v1/el3vate_feedback) + the live-fetch script (sentinel) + the live table (el3vate_live) + the live endpoint (/rest/v1/el3vate_live)
```

### The fetch itself

One inline script per discipline page, no SDK and no dependency. It:

- `GET`s `<SUPABASE_URL>/rest/v1/el3vate_live?slug=eq.<slug>&select=body` with
  the anon key in both `apikey` and `Authorization: Bearer`, and
  `Accept: application/json`.
- Applies an 8-second per-request ceiling via `AbortSignal.timeout`, falling back
  to `AbortController` + `setTimeout` where that is missing, plus an `inflight`
  guard so a hung request cannot stack up behind itself.
- On a 200 with a non-empty `body`, replaces the section's text via
  `textContent`. **Never** `innerHTML`, `outerHTML`, `insertAdjacentHTML` or
  `document.write` — GATE 17 fails the build on any of them.
- On anything else, leaves the build-time content untouched: no error text, no
  layout change, and **at most one `console.debug` for the whole lifetime of the
  page**, however many polls fail.
- Polls every 20 s, hard-stops at 15 minutes, and quiet-stops 5 minutes after the
  last change once something has landed.
- Does not animate. The swap is a `textContent` assignment with no class change,
  no transition and no `requestAnimationFrame`, so there is nothing for
  `prefers-reduced-motion` to suppress; the site-wide
  `@media (prefers-reduced-motion:reduce)` rule covers the section regardless.
  GATE 17 fails the build if an animation primitive appears in the emitted
  script, so this is enforced rather than promised.

**A faculty member cannot tell which path produced the text.** The heading string
and the body colour are single constants, `LIVE_TAG_FILLED = 'Built live in
session'` and `LIVE_BODY_COLOR = '#2A3A33'`, used by *both* the markup builder
and the emitted script. They cannot drift because there is only one of each.

## Phase 18 — the full migration SQL

`db/002_live_build.sql`, exactly as committed. **It has not been applied.** No
credentials were requested, held or used at any point in this run.

```sql
-- ============================================================================
-- 002_live_build.sql — EL3vate 2026 Day 8 live-build content
-- ============================================================================
-- Authored 2026-07-28 for the EL3vate Day 8 site (https://el3vate.vercel.app).
--
-- THIS FILE HAS NOT BEEN APPLIED. Like 001_feedback.sql it was written to be
-- read line by line and run by hand in the Supabase SQL editor. Nothing in the
-- site's build or deploy path executes it, and no automated process holds
-- credentials for this project. Run the verification query at the bottom
-- immediately afterwards; it is the only thing that confirms the applied state
-- matches the intent here.
--
-- WHAT THIS BACKS
-- Each of the fifteen discipline pages has a "live build" section. Today its
-- text is baked in at build time from the `liveBuild` field in
-- content/<slug>.json — `./fill.sh <slug> "text"` sets that field and ships.
-- That path does not change and is not replaced.
--
-- This table adds a second, faster path on top of it: with USE_LIVE_FETCH true
-- in src/build.js, each discipline page fetches its own row from here at page
-- load and every 20 seconds after, so Tim can change what the room is looking
-- at by editing one row in the dashboard instead of running a deploy. If the
-- fetch fails, times out, errors, or comes back empty, the page keeps showing
-- what was baked at build time. If nothing was baked, it keeps showing the
-- reserved placeholder. A faculty member never sees a spinner or an error.
--
-- ============================================================================
-- THE SECURITY MODEL — DELIBERATELY THE OPPOSITE OF 001_feedback.sql
-- ============================================================================
-- 001 is INSERT-ONLY for `anon` and has no select policy, because it holds
-- `contact_email` — a real address volunteered by a colleague — and anything
-- `anon` can read, the entire internet can read, since the key authorising
-- `anon` ships inside a public web page.
--
-- This table is SELECT-ONLY for `anon`, and that is correct rather than a
-- relaxation, for one reason:
--
--   THIS TABLE HOLDS CONTENT TIM WROTE, FOR THE EXPLICIT PURPOSE OF DISPLAYING
--   IT ON A PUBLIC PAGE. World-readable is the intended property, not a leak.
--   Publishing it is the whole feature. There is no version of this working
--   where the text stays private.
--
-- Two obligations follow from that, and they are the reason this paragraph
-- exists rather than a one-line comment:
--
--   * IT CONTAINS NO PERSONAL DATA AND NONE MAY EVER BE ADDED TO IT. No email
--     addresses, no names of attendees, no free-text a third party gave Tim in
--     confidence. If something like that ever needs storing, it goes in a
--     different table with 001's shape, not this one. Adding a column here is
--     the moment to re-read this paragraph.
--   * Whatever is typed into `body` is on the public internet the moment it is
--     saved. There is no draft state and no preview. The dashboard editor IS
--     the publish button.
--
-- `el3vate_feedback` is entirely unaffected by this file. It remains
-- insert-only, RLS on and forced, with no select policy for `anon`. Nothing
-- below touches it, and the two tables share no privileges.
--
-- NO WRITE POLICY FOR `anon`, EVER
-- There is no insert, update or delete policy for `anon`, and none may be
-- added. Tim writes rows through the Supabase dashboard, authenticated as
-- himself. A write policy here would let anyone on conference wifi retype what
-- fifteen faculty pages say, live, during the session.
--
-- WHY `force row level security` IS NOT USED HERE, THOUGH 001 USES IT
-- A deliberate difference, called out so it does not read as an oversight.
-- On 001, FORCE is protective: it stops a future connection as the owning role
-- from reading email addresses through the API. Here there is nothing to
-- protect — the table is world-readable by design — and FORCE would subject the
-- owning role to a policy set that contains no UPDATE policy at all. The single
-- operation this whole feature depends on is Tim updating a row at 9am. FORCE
-- buys nothing here and puts that operation one role-configuration surprise
-- away from failing in the room. Enabled, not forced, is the right setting for
-- a table whose contents are intended to be public.
--
-- WHY THE GRANTS ARE STATED AND THEN REVOKED EXPLICITLY
-- Supabase ships ALTER DEFAULT PRIVILEGES for the `public` schema that grant
-- `anon` and `authenticated` full table privileges on newly created tables.
-- So a bare `create table` here may arrive with INSERT, UPDATE and DELETE
-- already granted to `anon`. RLS with no matching policy would still block
-- those, but relying on one layer when two are available is not a security
-- model. The revoke below removes the privilege as well as the policy, so an
-- accidentally added write policy in future still hits a missing grant.
--
-- ABUSE CONTROL
-- `anon` can only read. There is no insert path for `anon` to flood, which is
-- the one respect in which this table is materially safer than 001. Read volume
-- is bounded by the dashboard's REST rate limiting (Project Settings -> API),
-- which should be reviewed before the session the same way it is for 001.
--
-- If something goes wrong mid-session, the fastest kill is not in this file at
-- all: set USE_LIVE_FETCH back to false in src/build.js and run
-- `./ship.sh prod`. That removes the fetch and the key from the site inside two
-- minutes and every page falls back to its baked `liveBuild` text. `./fill.sh`
-- keeps working throughout, unchanged, and is unaffected by the state of this
-- table.
--
-- RUN ONCE
-- The whole migration is wrapped in begin/commit. `create table if not exists`
-- and the seeding `on conflict do nothing` are both idempotent, but
-- `alter table ... add constraint` is not — Postgres has no
-- `add constraint if not exists` — so a second run errors on the first
-- constraint and the transaction rolls back whole. That is a safe failure, not
-- a partial apply, but it means the right response to "did that go through?" is
-- the verification query below, not running the file again.
--
-- REVERSIBILITY
--   drop table if exists public.el3vate_live;   -- takes the policy with it
-- The site does not break when this table disappears: every page falls back to
-- its build-time `liveBuild` text, and then to the reserved placeholder.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- table
-- ---------------------------------------------------------------------------
-- `slug` is the primary key, not a surrogate id, on purpose: there is exactly
-- one live-build row per discipline for the whole session, the page fetches by
-- slug, and Tim edits by slug. A surrogate key would add a lookup step to every
-- one of those and buy nothing.
create table if not exists public.el3vate_live (
  slug        text        primary key,
  body        text,
  updated_at  timestamptz not null default now()
);

comment on table public.el3vate_live is
  'EL3vate 2026 Day 8 live-build content, one row per discipline. PUBLIC BY DESIGN: anon SELECT only, RLS on, no write policy for anon. Contains no personal data and none may be added. Written via the dashboard.';
comment on column public.el3vate_live.slug is
  'Discipline page slug. Constrained to the same 15 slugs as el3vate_feedback.discipline. One row per discipline, all 15 seeded by this migration.';
comment on column public.el3vate_live.body is
  'The text shown in that page''s live-build section. NULL means "nothing written yet" — the page then shows whatever was baked in at build time from content/<slug>.json liveBuild, and failing that the reserved placeholder. Public the moment it is saved.';
comment on column public.el3vate_live.updated_at is
  'Set by default on insert. NOT maintained by a trigger — see the note by the seed below. Informational only; nothing in the site reads it.';

-- ---------------------------------------------------------------------------
-- check constraints — bounded size, known slugs
-- ---------------------------------------------------------------------------
-- Added separately (rather than inline) so each one has its own name and can be
-- dropped or adjusted without rewriting the table definition.

-- 4000 characters, matching el3vate_feedback's text bound. This is a paragraph
-- read off a projector by a room of faculty, so the real limit is closer to a
-- few hundred; 4000 is the point past which something has clearly gone wrong
-- (a paste of an entire transcript, or a junk write) rather than a style guide.
-- NULL is allowed and is the seeded state — see the seed below.
alter table public.el3vate_live
  add constraint el3vate_live_body_len
  check (body is null or char_length(body) <= 4000);

-- The fifteen slugs are the fifteen files in content/ (excluding claims.json,
-- which is the claim audit, not a discipline). This list is identical to
-- el3vate_feedback_discipline_known in 001_feedback.sql. If a sixteenth
-- discipline is ever added, BOTH lists must be extended.
alter table public.el3vate_live
  add constraint el3vate_live_slug_known
  check (slug in (
    'bioinformatics',
    'comparative-philosophy',
    'english-literature',
    'entrepreneurship',
    'family-business',
    'finance',
    'law',
    'learning-design',
    'marketing',
    'marriage-family-therapy',
    'nutrition',
    'planetary-science',
    'political-science',
    'teacher-education',
    'urban-planning'
  ));

-- ---------------------------------------------------------------------------
-- row-level security
-- ---------------------------------------------------------------------------
-- Enabled, not forced. See the header for why the difference from 001 is
-- deliberate.
alter table public.el3vate_live enable row level security;

-- EXACTLY ONE POLICY. Anonymous SELECT, nothing else.
--
-- There is deliberately no policy for insert, update or delete, for `anon` or
-- for `authenticated`. Do not add one. With RLS enabled and no matching policy,
-- a write through the anon key affects nothing.
--
-- `using (true)` is correct here and is not a hole: every row in this table is
-- content written for public display, so there is no per-row visibility concept
-- to predicate on. What bounds the contents is the CHECK constraints above and
-- the fact that only Tim can write.
drop policy if exists el3vate_live_anon_select on public.el3vate_live;
create policy el3vate_live_anon_select
  on public.el3vate_live
  for select
  to anon
  using (true);

-- The REST endpoint needs the schema and the select privilege on top of the
-- policy: RLS filters, grants admit. `anon` gets SELECT and nothing more.
grant usage  on schema public              to anon;
grant select on table  public.el3vate_live to anon;

-- Explicit, because Supabase's default privileges on the public schema may
-- already have granted these — see the header. Removing the privilege as well
-- as withholding the policy means a mistakenly added write policy in future
-- still hits a missing grant.
revoke insert, update, delete, truncate, references, trigger
  on table public.el3vate_live from anon;

-- ---------------------------------------------------------------------------
-- seed: all fifteen rows, body NULL
-- ---------------------------------------------------------------------------
-- Every discipline gets a row now so that during the session Tim only ever
-- EDITS a row, never creates one. In the Supabase table editor, clicking a
-- cell and typing is a few seconds; inserting a row means a dialog, a slug
-- typed by hand (which the check constraint will reject if mistyped), and a
-- save. At 9am the difference matters.
--
-- `body` is NULL, not '', deliberately: NULL is "nothing written yet", and the
-- page's fallback treats NULL, an empty string and a whitespace-only string
-- identically, so a row in this state is invisible to the site.
--
-- `on conflict (slug) do nothing` makes re-seeding safe and, importantly, means
-- re-running the seed alone will never blank a row Tim has already written.
--
-- NOTE ON updated_at: it is set by its default at insert and is NOT maintained
-- by a trigger. Edit a row in the dashboard and updated_at will still read the
-- seed time. That is intentional for a one-day artifact — a trigger is more
-- moving parts than the value is worth, and nothing in the site reads it. If it
-- ever needs to be true, add a before-update trigger; do not assume it is.
insert into public.el3vate_live (slug)
select unnest(array[
  'bioinformatics',
  'comparative-philosophy',
  'english-literature',
  'entrepreneurship',
  'family-business',
  'finance',
  'law',
  'learning-design',
  'marketing',
  'marriage-family-therapy',
  'nutrition',
  'planetary-science',
  'political-science',
  'teacher-education',
  'urban-planning'
])
on conflict (slug) do nothing;

commit;
```

### The verification query

Run it in the same SQL editor immediately after the migration. Six rows come
back; every `verdict` must read `PASS`.

```sql
-- ============================================================================
-- VERIFICATION — run this after the migration, in the same SQL editor.
-- ============================================================================
-- Same style as 001_feedback.sql: one row per check with a PASS/FAIL verdict
-- and the actual observed value, so it is readable rather than silent. SIX rows
-- should come back, and every `verdict` must read PASS. An empty result is
-- itself a failure: it means the table is not there at all.
--
-- Expected output (6 rows, every verdict PASS):
--
--   check                                       verdict  observed
--   ------------------------------------------  -------  --------------------------------------------------
--   1. table exists                             PASS     public.el3vate_live
--   2. RLS enabled                              PASS     relrowsecurity=true relforcerowsecurity=false
--   3. exactly one policy                       PASS     1 policy/policies: el3vate_live_anon_select
--   4. that policy is SELECT for anon           PASS     el3vate_live_anon_select cmd=SELECT roles={anon}
--   5. no insert/update/delete policy for anon  PASS     0 non-SELECT policy/policies reachable by anon: none
--   6. fifteen rows present                     PASS     15 row(s), 15 with body null
--
-- Check 2 expects relforcerowsecurity=FALSE. That is not a failure and not a
-- copy-paste slip from 001 — see "WHY force row level security IS NOT USED
-- HERE" in the header. What check 2 asserts is `relrowsecurity`, which must be
-- true.
--
-- ONE HONEST LIMITATION, STATED RATHER THAN HIDDEN: checks 1 through 5 read the
-- system catalogs and so return a row whether or not the table exists, but check
-- 6 counts rows in `public.el3vate_live` itself. If the migration did not apply
-- at all, this query does not return "1. table exists FAIL" — it errors with
--   ERROR: relation "public.el3vate_live" does not exist
-- and returns nothing. That is unambiguous rather than silent (it is the same
-- fact check 1 would have reported), but do not read an empty result as a pass.
-- Read the error, then re-run the migration.
--
-- Anything other than six PASS rows means STOP: leave USE_LIVE_FETCH false and
-- ship without the fetch. The site is fully functional in that state — every
-- page shows its baked `liveBuild` text, and `./fill.sh` still works.
--
-- ("check" is quoted throughout because it is a reserved word in Postgres and an
-- unquoted column alias by that name is a syntax error.)

select '1. table exists' as "check",
       case when count(*) = 1 then 'PASS' else 'FAIL' end as verdict,
       coalesce(string_agg(schemaname || '.' || tablename, ', '), '(no such table)') as observed
from pg_tables
where schemaname = 'public' and tablename = 'el3vate_live'

union all

select '2. RLS enabled',
       case when bool_and(c.relrowsecurity) then 'PASS' else 'FAIL' end,
       coalesce(string_agg('relrowsecurity=' || c.relrowsecurity ||
                           ' relforcerowsecurity=' || c.relforcerowsecurity, ', '),
                '(no such table)')
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'el3vate_live'

union all

select '3. exactly one policy',
       case when count(*) = 1 then 'PASS' else 'FAIL' end,
       count(*) || ' policy/policies: ' ||
         coalesce(string_agg(policyname, ', '), '(none)')
from pg_policies
where schemaname = 'public' and tablename = 'el3vate_live'

union all

select '4. that policy is SELECT for anon',
       case when count(*) = 1 then 'PASS' else 'FAIL' end,
       coalesce(string_agg(policyname || ' cmd=' || cmd || ' roles=' || roles::text, ', '),
                '(no SELECT policy for anon)')
from pg_policies
where schemaname = 'public'
  and tablename  = 'el3vate_live'
  and cmd        = 'SELECT'
  and roles::text[] = array['anon']

union all

select '5. no insert/update/delete policy for anon',
       case when count(*) = 0 then 'PASS' else 'FAIL' end,
       count(*) || ' non-SELECT policy/policies reachable by anon: ' ||
         coalesce(string_agg(policyname || ' (' || cmd || ')', ', '), 'none')
from pg_policies
where schemaname = 'public'
  and tablename  = 'el3vate_live'
  and cmd       <> 'SELECT'
  and (roles::text[] && array['anon', 'public'])

union all

select '6. fifteen rows present',
       case when count(*) = 15 then 'PASS' else 'FAIL' end,
       count(*) || ' row(s), ' || (count(*) filter (where body is null)) || ' with body null'
from public.el3vate_live

order by 1;

-- Optional second check: confirm the fifteen slugs are exactly the fifteen the
-- site builds, with nothing missing and nothing extra. Returns zero rows when
-- correct; any row that comes back names a mismatch.
--
--   select coalesce(l.slug, e.slug) as slug,
--          case when l.slug is null then 'MISSING from el3vate_live'
--               else 'EXTRA in el3vate_live' end as problem
--   from public.el3vate_live l
--   full outer join (
--     select unnest(array[
--       'bioinformatics','comparative-philosophy','english-literature',
--       'entrepreneurship','family-business','finance','law','learning-design',
--       'marketing','marriage-family-therapy','nutrition','planetary-science',
--       'political-science','teacher-education','urban-planning']) as slug
--   ) e on e.slug = l.slug
--   where l.slug is null or e.slug is null;
--
-- Optional third check, once USE_LIVE_FETCH is on and Tim has written a row.
-- Run it as yourself in the dashboard; it shows what the room is currently
-- seeing on each page.
--
--   select slug, left(body, 80) as body_preview, char_length(body) as len
--   from public.el3vate_live
--   where body is not null and btrim(body) <> ''
--   order by slug;
```

Two things in there are deliberate and would otherwise read as slips:

- **Check 2 expects `relforcerowsecurity=false`.** `001_feedback.sql` uses
  `force row level security`; this file does not, and the header says why. On
  `el3vate_feedback` FORCE is protective — it stops a future connection as the
  owning role reading colleagues' email addresses through the API. Here there is
  nothing to protect, because the table is world-readable by design, and FORCE
  would subject the owning role to a policy set containing no UPDATE policy at
  all. The single operation this feature depends on is Tim updating a row at 9am.
  FORCE buys nothing and puts that operation one role-configuration surprise away
  from failing in the room.
- **If the table does not exist, the query errors instead of returning
  "1. table exists FAIL".** Checks 1–5 read system catalogs and return a row
  either way, but check 6 counts rows in the table itself. A failed migration
  produces `ERROR: relation "public.el3vate_live" does not exist` and no rows.
  That is unambiguous rather than silent — it is the same fact check 1 would have
  reported — but **an empty result is not a pass.** This is stated in the file
  too, not only here.

## Phase 20 — every new gate's demonstrated failure input

Each gate was fed a deliberately broken fixture, confirmed to catch it, and the
fixture deleted. Gates with an "allowed" branch also got a negative control — an
input that is deliberately *right* and must pass — because a gate that fails
everything is as useless as one that fails nothing. All fixtures live in
`selftest()` in `src/validate.js` and re-run with `npm run selftest`.

The brief numbers these 1–5; they are GATE 15–19 in the suite so the numbering
stays one sequence.

### GATE 15 — live-fetch kill switch (brief 1)

| # | failure input | caught by |
|---|---|---|
| control | both switches off, no live-build reference anywhere in `dist/` — the committed state | correctly **allowed** |
| 1 | switch off but `dist/law/index.html` still contains `el3vate_live` | table-name scan |
| 2 | switch off but the `/rest/v1/el3vate_live` endpoint is still in `dist/law/index.html` | REST-path scan |
| 3 | the identifier `SUPABASE_ANON_KEY` in `dist/index.html` — source leaked into built output | identifier scan |
| 4 | the `SUPABASE_ANON_KEY` value still in `dist/index.html` with **both** switches off | value scan |
| control | the same value present with `USE_SUPABASE` **on** — it belongs there, and GATE 11 owns that case | correctly **allowed** |
| 5 | `USE_LIVE_FETCH` on but not one discipline page emitted the fetch | on-state check |

The two controls are the interesting pair. The credential *values* are only
checked when `USE_SUPABASE` is also off; when the feedback form is on those
values legitimately belong in `dist/`, and failing on them here would be this
gate reporting on a different feature. That is why the gate takes both switches
rather than just its own.

### GATE 16 — independence of the two switches (brief 2)

**Failure input:** a copy of `src/build.js` with `LIVE_FETCH_ON` redefined to
depend on `SUPABASE_ON`:

```js
const LIVE_FETCH_ON = SUPABASE_ON && USE_LIVE_FETCH && String(SUPABASE_URL).trim() !== '';
```

That is the exact regression this gate exists to catch — the two switches quietly
wired together, so `USE_SUPABASE=false` with `USE_LIVE_FETCH=true` silently emits
no fetch. The gate built all four combinations against the sabotaged source and
failed on the third, reporting the missing script, the missing table name and the
missing endpoint. The fixture was deleted.

The gate builds from a throwaway copy of `src/build.js` in a temp directory with
`content/`, `demos/` and `assets/` symlinked in and `dist/` landing under the temp
root, so **nothing in the repo is written to** and a crash mid-gate cannot leave
`src/build.js` edited or the real `dist/` in a fixture state.

### GATE 17 — no markup sink on fetched content (brief 3)

| # | failure input | caught |
|---|---|---|
| control | the emitted script writing the fetched value with `textContent` and nothing else | correctly **allowed** |
| 1 | `box.innerHTML = t;` inside the emitted fetch script | yes |
| 2 | `box.outerHTML = t;` | yes |
| 3 | `box.insertAdjacentHTML('beforeend', t);` | yes |
| 4 | `document.write(t);` | yes |
| 5 | `requestAnimationFrame(function(){box.classList.add('in');});` — an animated swap | yes |
| 6 | a fetch script with no `textContent` assignment at all | yes |
| 7 | the begin sentinel with no matching end sentinel — the region cannot be scanned | yes |

**This gate fired for real on its first run**, on a comment inside the emitted
script reading `textContent, never innerHTML`. The region is scanned as a blob,
comments included. That is the same call GATE 12 makes for `service_role`: the
alternative is a JavaScript comment stripper that has to get string literals and
regex literals right to avoid a blind spot, which is more code and more ways to
be wrong than the convention costs. The comment in `src/build.js` was reworded
and both the gate and the build now carry a note saying why the sinks are not
named there. **This is a live constraint on future edits**, and it is in
`BLOCKERS.md`.

**GATE 17 and GATE 19 each run twice** — against the committed build *and*
against a freshly built `USE_LIVE_FETCH=true` variant. Without the second run
GATE 17 would pass vacuously in the committed state, scanning zero scripts
because the switch is off. The variant run inspects the 15 scripts the site
would actually ship:

```
[17] NO innerHTML ON FETCHED CONTENT  PASS  (committed build: 0 script(s), switch off as expected; USE_LIVE_FETCH=true variant: 15 script(s) scanned)
```

### GATE 18 — demo and presenter isolation (brief 4)

| # | failure input | caught |
|---|---|---|
| control | canned demo data and a self-contained presenter kit, neither naming the live table | correctly **allowed** |
| 1 | a demo naming `el3vate_live` | yes |
| 2 | a `.json` asset under `dist/demos/` carrying the `/rest/v1/el3vate_live` endpoint | yes |
| 3 | the live-build fetch emitted into the presenter kit | yes |
| 4 | a demo calling `fetch(` — GATE 5 re-asserted rather than assumed | yes |
| 5 | `dist/presenter/` absent, so the kit cannot be confirmed clean | yes |

### GATE 19 — fallback presence (brief 5)

| # | failure input | caught |
|---|---|---|
| control | nothing baked, section carrying the reserved placeholder | correctly **allowed** |
| control | `liveBuild` filled, heading reading "Built live in session" — the `./fill.sh` path | correctly **allowed** |
| 1 | an empty `lb-body` — a reader with JavaScript disabled would see an empty box | yes |
| 2 | the live-build section deleted from the served HTML | yes |
| 3 | `Loading the live build…` shipped as the fallback — a waiting state, not a finished one | yes |
| 4 | a 3-character `lb-body` against the 20-char floor | yes |
| 5 | nothing baked, but the heading already claiming "Built live in session" | yes |

### The fallback chain itself — `src/livefallback.js`

Not a gate in `src/validate.js`, because it is a runtime behaviour rather than a
property of the built file, but it is a stage in `npm run check` and it exits
non-zero on any mismatch. CONSTRAINT B says every step must be **exercised**, and
this is what exercises it. The script under test is extracted from a real built
page and cannot drift from what ships.

```
CONSTRAINT B — the three-deep fallback chain, exercised branch by branch
The script under test is extracted from a real built page, not retyped here.

  build-time state, nothing baked : "Reserved · live build" / "This space is intentionally empty. During the Day 8 sessio…"
  build-time state, ./fill.sh ran : "Built live in session" / "Baked by ./fill.sh at 08:52 — the room asked for a rubric row."

  ok   1  200 + text, nothing baked      -> shows FETCHED text
         1 fetch call(s), 0 debug line(s), 1 timer(s) armed
  ok   2  200 + text, text WAS baked     -> FETCHED text replaces baked
         1 fetch call(s), 0 debug line(s), 1 timer(s) armed
  ok   3  non-200 (500)                  -> keeps BAKED text
         1 fetch call(s), 1 debug line(s) ["live-build: status 500"], 1 timer(s) armed
  ok   4  network error                  -> keeps BAKED text
         1 fetch call(s), 1 debug line(s) ["live-build: unreachable or timed out"], 1 timer(s) armed
  ok   5  hang, no abort available       -> keeps BAKED text, no stacked requests
         1 fetch call(s), 0 debug line(s), 1 timer(s) armed
  ok   5b hang, 8s abort available       -> aborts and polling resumes
         2 fetch call(s), 1 debug line(s) ["live-build: unreachable or timed out"], 2 timer(s) armed
  ok   6  200 + empty array (no row)     -> keeps BAKED text
         1 fetch call(s), 1 debug line(s) ["live-build: nothing published yet"], 1 timer(s) armed
  ok   7  200 + body null (seeded row)   -> keeps RESERVED placeholder
         1 fetch call(s), 1 debug line(s) ["live-build: nothing published yet"], 1 timer(s) armed
  ok   8  200 + whitespace-only body     -> keeps RESERVED placeholder
         1 fetch call(s), 1 debug line(s) ["live-build: nothing published yet"], 1 timer(s) armed
  ok   9  200 + unreadable JSON          -> keeps BAKED text
         1 fetch call(s), 1 debug line(s) ["live-build: unreadable response"], 1 timer(s) armed
  ok   10 empty twice, text on poll 3    -> appears with no reload
         4 fetch call(s), 1 debug line(s) ["live-build: nothing published yet"], 1 timer(s) armed
  ok   11 nothing lands, past 15 minutes -> hard stop, timer disarmed
         2 fetch call(s), 1 debug line(s) ["live-build: nothing published yet"], 0 timer(s) armed
  ok   12 one hit, then 5 quiet minutes  -> quiet stop, timer disarmed
         2 fetch call(s), 0 debug line(s), 0 timer(s) armed

  switch OFF:
  ok   no fetch script emitted at all
  ok   the section is still complete: "Built live in session" / "Baked by ./fill.sh at 08:52 — the room asked for a rubric row."

LIVE-FALLBACK PASS: every branch of the fallback chain behaves, and no branch clears the section, shows a spinner or changes the layout.
```

Read cases 5 and 5b together — they are the reason the 8-second ceiling exists.
With no abort primitive available, a hung request is held by the `inflight`
guard and the loop makes **1** call across two poll intervals: safe, but stuck.
With the abort available it makes **2**: the ceiling fires, the catch runs, the
guard clears and polling resumes. Case 10 is the one that matters in the room —
text arriving on the third poll with no reload.

**This exerciser was itself proven failable.** The whitespace guard in
`src/build.js` was temporarily changed from
`if(t===null||t.replace(/\s+/g,'')==='')` to `if(t===null)`, and case 8 failed
with `heading changed to "Built live in session"` and `body changed to "   \n\t  "`
— i.e. a whitespace-only row would have blanked the placeholder. Exit code 1.
The change was reverted and `src/build.js` confirmed byte-identical to its
pre-experiment copy.

## PROCEDURE — turning the live build ON

Do these in order. Steps 1 and 2 are safe to do at any time; nothing changes on
the live site until step 5.

1. **Apply the migration.** Open the Supabase SQL editor for the project. Paste
   `db/002_live_build.sql` from `begin;` down to `commit;`. Read it first — it is
   commented for exactly that. Run it.
2. **Run the verification query.** It is the second half of the same file, from
   `select '1. table exists'` onward. **Six rows must come back and every
   `verdict` must read `PASS`.** Check 2 will read
   `relforcerowsecurity=false` — that is correct here, see above. If anything
   reads `FAIL`, or the query errors with `relation ... does not exist`,
   **STOP**: leave `USE_LIVE_FETCH` false and ship without the fetch. The site
   is fully functional in that state.
3. **Fill in the two credentials** in `src/build.js`, lines 46–47:
   ```js
   const SUPABASE_URL = 'https://<your-project-ref>.supabase.co';
   const SUPABASE_ANON_KEY = '<the anon / publishable key>';
   ```
   The **anon key only**. Never the elevated key — this is public static HTML and
   GATE 12 fails the build on the elevated one, decoding every JWT it finds to
   check the role claim.
4. **Set the switch**, line 80: `const USE_LIVE_FETCH = true;`
   Leave `USE_SUPABASE` alone. If it is `false` it stays `false` — GATE 16 proves
   that combination ships the fetch and no feedback form.
5. **Ship.** `./ship.sh prod`. It builds, restores the Vercel link, runs all 19
   gates, scrubs any `.env*` from the deploy root, deploys, then polls the live
   site up to five times confirming it serves this exact build stamp before
   opening it. **If a gate fails, it never deploys.**
6. **Confirm from a real browser** — this is the step nobody can do for you, and
   it is the only one that proves the round trip works:
   1. Open `https://el3vate.vercel.app/law/index.html` (or any discipline) and
      scroll to the live-build section. It should read
      **Reserved · live build**.
   2. In the Supabase **table editor**, open `el3vate_live`, find the row with
      `slug = 'law'`, click its `body` cell, type a sentence, save.
   3. Go back to the browser tab — **do not reload it** — and wait. Within
      20 seconds the heading should change to **Built live in session** and your
      sentence should appear.
   4. If it does not: open the browser console. A single line beginning
      `live-build:` tells you which branch was taken —
      `status 401` means the key or the policy is wrong, `status 404` means the
      table or the REST path is wrong, `nothing published yet` means the request
      succeeded and the row is empty (check you saved the right row), and
      `unreachable or timed out` means it never got there (CORS or the URL).
      **The page is not broken in any of those cases** — it is showing its
      fallback, which is the intended behaviour.

## PROCEDURE — turning it back off

1. **Set the switch back**, `src/build.js` line 80:
   `const USE_LIVE_FETCH = false;`
   That is the whole edit. Leave the credentials in place or clear them; with the
   flag false the interlock makes them irrelevant, and GATE 15 fails the build if
   any trace of the live layer survives into `dist/`.
2. **Ship.** `./ship.sh prod`.

**Expected wall-clock time: under two minutes**, and the dominant term is
Vercel, not the build.

Measured on this machine, this run: `node src/build.js` takes **0.09 s** and
`node src/validate.js` (all 19 gates, including the four variant builds GATE 16
does and the two GATE 17/19 do) takes a few seconds. The deploy and the live
stamp check are the rest. The third run measured the same revert for
`USE_SUPABASE` at the same figure, and this switch is strictly cheaper — it
touches one boolean and re-runs the same pipeline.

**What Tim gets back after the revert:** every discipline page shows whatever
`./fill.sh` last baked into it, and the reserved placeholder where nothing was
baked. `./fill.sh <slug> "text"` keeps working exactly as it did before this run,
on either side of the switch. Nothing about the revert depends on the database
being reachable, or on it existing at all.

## What was actually run, and what could not be

**Run, with output seen:**

- `node src/build.js` — the committed off-state build. Output quoted above.
- `node src/validate.js` — 19/19 gates PASS against that build.
- `node src/validate.js --selftest` — 73 cases, 0 BAD. Every gate rejected its
  broken fixture; every negative control was correctly allowed.
- `node src/livefallback.js` — 14 branches of the fallback chain, plus the
  switch-off case. Full output quoted above.
- `npm run check` — all six stages green, including `src/interact.js`'s 212 real
  browser assertions across the 8 demos, the presenter kit and the closing card.
- Four full builds in every combination of the two switches (GATE 16), plus two
  more `USE_LIVE_FETCH=true` builds for GATES 17 and 19, plus three in
  `src/livefallback.js`. The `USE_SUPABASE=false, USE_LIVE_FETCH=true` artifact
  was inspected directly and confirmed to carry the live fetch and no feedback
  form.
- The emitted script was parsed with `new Function(...)` to confirm it is
  syntactically valid JavaScript before any behavioural test ran.
- A demonstration that `src/livefallback.js` can fail: the whitespace guard was
  temporarily removed, case 8 failed with exit code 1, and `src/build.js` was
  restored and diffed against a pre-experiment copy to confirm it was byte-identical.

**NOT run, and nobody should read this report as implying otherwise:**

- **The fetch has never completed against a real endpoint.** Not once, from this
  session. No request left this machine. Every success path above was driven by a
  stub `fetch` returning a hand-written response object. What is unverified is
  precisely the live round trip: whether CORS on the real project permits it,
  whether the anon key is accepted, whether the `SELECT` policy returns the row,
  and whether PostgREST's response shape is the `[{body: ...}]` the script
  expects. **Step 6 of the enable procedure is what closes that**, and it is the
  one step nobody can do for Tim.
- **`db/002_live_build.sql` has not been applied.** No database credentials were
  requested, obtained or held at any point. The SQL has been read for syntax by
  eye only; a syntax error surviving that review is possible. The whole migration
  is wrapped in `begin`/`commit`, so a failure rolls back whole rather than
  leaving a partial apply, and the SQL editor will say so immediately.
- **No browser has run the fetch script.** `src/interact.js` drives the demos and
  the presenter kit in a real Chromium, but the live-build script is only emitted
  when the switch is on, and the switch is committed off — so the 212 interaction
  assertions do not cover it. The stub-DOM harness is a faithful stand-in for the
  four DOM operations the script performs and nothing more; it does not prove
  browser behaviour around `AbortSignal.timeout`, `cache: 'no-store'` or CORS
  preflight.
- **No screen-reader pass**, same caveat the rest of the site carries. See the
  known gap below.

## Known gap, flagged rather than silently fixed

**A runtime text change is not announced to a screen reader.** The live-build
section carries no `aria-live`, so a faculty member using VoiceOver or NVDA who
has the page already open when Tim publishes a row will not be told the text
changed. On page load — the overwhelmingly common case — the fetch fires
immediately and the content is simply there, so this affects only an
already-open tab.

The one-line change would be `aria-live="polite"` on the `livebuild` div in
`sectionLiveBuild()`. It was **not** made, because the brief specified this
section's behaviour precisely and adding unrequested markup to all four switch
combinations is Tim's call rather than mine. `apply()` already guards on
`text === shown`, so a polite region would fire once per real change and not on
every poll — the change is safe if he wants it.

## Doc impact

`db/002_live_build.sql` carries its own header (schema change → migration
header). This section of `REPORT.md` is the operational record for both
procedures. `BLOCKERS.md` gains the unresolvables from this run. No runbook under
`docs/` and no architecture decision doc is affected, because this run added no
new deploy path — `./ship.sh prod` is unchanged and `./fill.sh` is untouched.
