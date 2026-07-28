# BLOCKERS

Things the unattended build could not fully resolve, written so a human can act
on them. Nothing here stopped the build; these are honest caveats and follow-ups.

## Content

- **`promptOutput` model identity.** All 15 outputs are genuine, unedited model
  replies captured in isolated fresh sub-sessions — but the model is Claude
  (Anthropic), not a distinct third-party model. If the intent was to show a
  *different* vendor's model, re-run each starter prompt (bracket fills are
  recorded in each file's `promptFilled`) against that model and replace the
  `output` fields. Do not hand-edit the captured text.
- ~~**Factual claims inside the captured outputs are not independently verified.**~~
  **Resolved in phase 7.** All 55 verifiable claims across `content/*.json` were
  extracted into `content/claims.json` and checked against live sources: 37
  verified, 9 refuted, 9 unverifiable. Every refuted claim was either rewritten
  out of the prose or — where it sits inside a `promptOutput` transcript, which
  stays unedited — named explicitly in that transcript's annotations. See the
  residual items below for what the audit could *not* close.

## Claim audit — what a human still has to check

- **Three transcripts now carry annotations that say the model was wrong.** This
  is deliberate and is the most valuable content on those pages, but a domain
  expert should read them before Wednesday: `law` (HRS §521-73 does not condition
  lease termination — that is §521-63), `comparative-philosophy` (the Chinese
  quotation of *Analects* 13.18 is corrupted: 子為子隱 for 子為父隱; plus *Analects*
  1.2 attribution and the Gusou/"Gushou" romanization), and the two annotations
  that had to be *retracted* because the audit disproved them —
  `teacher-education` (the Ilocano is correct) and `learning-design` (the
  contrast claims all hold: 17.40:1, 7.14:1, 5.53:1).
- **`content/bioinformatics.json` BIO-07** — the residue context `…Ile-Phe-Gly-Val…`
  around F508 was not checked against the UniProt CFTR sequence. Recorded
  `unverifiable` rather than asserted. Someone with a sequence viewer can close
  this in two minutes.
- **`content/planetary-science.json` PS-02** — the crater-scaling constant 1.16
  and exponents 0.78 / 0.44 were not confirmed against Holsapple/Schmidt & Housen.
  Only the gravity exponent (β = 0.22) was verified. The page already tells
  students to check the exponents against the source; nobody has yet.
- **Instructor prep-hour estimates (`budget.prepHours`, all 15 files)** are author
  estimates with no external referent. They are *not* marked `unverified` on the
  page — marking all fifteen would dilute the marker where it earns its keep —
  but they are unconfirmed.

## PACE operational — time-sensitive

- **PACE 3D printing is listed as closed for the summer and not accepting new
  requests** as of this audit. Every four-week plan on this site depends on
  fabrication. Confirm the reopening date before faculty leave the room on
  Wednesday, or the four-week version is not runnable this fall.
- **Turnaround was wrong and is now fixed.** The site said "7–10 day turnaround"
  in 14 places; PACE publishes "7–10 **business** days" for both printing and
  laser cutting — up to a week's difference on a four-week module. Rewritten
  throughout. Someone should confirm the current figure directly with PACE rather
  than trusting the web page or this audit.
- **Laser cutting is free to UH students but users supply their own material**
  beyond a 1 sq ft plywood starter pack, and requests over $20 require the
  requester to be present during the cut. The per-student cost estimates on the
  discipline pages are consistent with that but were never priced against a real
  quote — hence the `unverified` marker on all 13 of them.

## Demos

- **`intake-branching` could never be won — found and fixed in phase 8.** The end
  screen branched on `trust >= 55`, but trust starts at 40 and the four
  reflective options are worth +2, +2, +3, +3, so the highest score any
  playthrough could reach was **50**. The "she opened up" branch was unreachable
  dead code: every session ended in failure however well it was played, and a
  faculty member who played it perfectly was told "too few of your responses
  reflected what she said." The threshold is now 48, which is inside the
  reachable band — an all-reflective read, or a reflective read with one
  question, opens her; any advice or reassurance does not. This was invisible to
  the first run's load-and-screenshot verification and is the single strongest
  argument for the phase-8 click-through tests existing at all.
  **A human should sanity-check the new gradient** before Wednesday: it is a
  pedagogical judgement about how forgiving the exercise should be, not just a
  number, and 48 was chosen to keep exactly one non-reflective-but-harmless move
  survivable.

## Generator / validation

- **`scales.fourWeeks` is now a misnomer on two disciplines.**
  `comparative-philosophy` and `finance` run **five**-week plans, but the JSON key
  holding their multi-week description is still called `fourWeeks`. Renaming it to
  something neutral (`multiWeek`) is a schema change touching all 15 content
  files, `src/build.js`, and the `REQ` list in the completeness gate — too broad
  to do safely tonight, so it was deliberately left alone. What *was* done: every
  rendered "N weeks" label is now derived from `d.plan.length`, so no page can
  show a heading that disagrees with its own list, and a new completeness-gate
  condition fails the build if `scales.fourWeeks` prose says "four-week" while
  `plan.length !== 4`. The key name is cosmetic and invisible to readers; the
  rendered output is correct. Rename it when someone has room to touch all 15
  files in one commit.
- **The similarity gate's headline number is dominated by stopwords.** After the
  phase-7 rewrite of `finance` and `planetary-science`, that pair still scores
  0.331 on `tryTuesday` — but the token "the" alone accounts for 0.169 of it,
  about half, because the gate's IDF (`log(N/df) + 1`) never falls to zero for a
  term present in every document. Recomputed on content words only, the pair
  drops from rank #2 to #191. The gate is still useful as a *relative* ranking;
  its absolute values should not be read as "these are 33% the same assignment."
  Adding a stopword filter to `tok()` would fix this and is a small change, but
  it moves every historical number, so it was left for a human to decide.
- **`nutrition` ~ `marriage-family-therapy` is now the top pair** in both
  `tryTuesday` (0.352) and `rubric` (0.306), and on content words alone (0.278 /
  0.232) it is clearly the most genuinely duplicated pair on the site. Both are
  standardized-client counseling intakes graded on earned disclosure. That may be
  legitimate — the two pages cross-link each other and say so — but if a second
  differentiation pass is wanted, this is the pair to do next.
- **Contrast gate is a CSS-context heuristic, not a browser render.** It infers
  background from selector names and strips `@media` blocks. It is conservative
  and proven-failable, but should be backstopped with a real axe-core/browser
  audit before any accessibility claim is published.

## Verification (headless browser / screenshots)

- ~~**No full click-through automation of demos.**~~ **Resolved in phase 8.**
  Playwright + chromium installed cleanly; `src/interact.js` drives all eight
  demos through real interactions (slider extremes, a mouse drag across the
  precinct grid, variant toggles, both dialogue paths, both highlight readings,
  injected contrast fixtures) and asserts on the resulting output text, not on
  the absence of errors. 147 assertions, all passing. Every demo is additionally
  checked for keyboard-only operability by *parity*: the interaction is performed
  with the mouse, the resulting state recorded, the page reloaded, the same
  interaction performed with Tab + Enter/Home/End/digit keys alone, and the two
  states required to be identical. The three items a human was asked to exercise
  by hand — district-redraw's Tab + 1/2/3 reassignment, the intake-branching tree
  to its end screen, and the a11y-audit break-switches + Run audit — are all now
  covered automatically.
- **The interaction tests need a browser download.** `npm i -D playwright &&
  npx playwright install chromium` pulls ~270MB into
  `~/Library/Caches/ms-playwright`. On a machine without it, `npm run check`
  fails at the interaction stage rather than skipping it — deliberately, so a
  missing browser can never read as green. `node src/validate.js` alone stays
  zero-dependency and still runs the content gates on its own.
- **Screenshots live in `dist/_screens/`**, which is git-ignored (`dist/`), so
  they are not committed. Regenerate with headless Chrome after `node src/build.js`.
