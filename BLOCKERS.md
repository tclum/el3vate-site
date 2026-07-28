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
- **Factual claims inside the captured outputs are not independently verified.**
  The outputs cite specific statutes (HRS §521-73), gene biology (CFTR F508del),
  and primary sources (Analects 13.18, Mengzi 7A35). They are flagged in-page as
  things students must verify, and the annotations treat them as claims — but a
  domain expert should confirm them before this is used as authoritative.

## Demos

- _(none)_ — all 8 demos were built and pass the offline gate.

## Generator / validation

- **Contrast gate is a CSS-context heuristic, not a browser render.** It infers
  background from selector names and strips `@media` blocks. It is conservative
  and proven-failable, but should be backstopped with a real axe-core/browser
  audit before any accessibility claim is published.

## Verification (headless browser / screenshots)

- **No full click-through automation of demos.** Puppeteer/Playwright are not
  installed in this environment. Demos were verified by loading each from
  `file://` in headless Chrome, asserting JS-generated DOM content appears,
  confirming zero console/JS errors, and reviewing screenshots. A human should
  still manually exercise: district-redraw's keyboard reassignment (Tab + 1/2/3),
  the intake-branching dialogue tree to the end screen, and the a11y-audit
  "break it" toggles + Run audit.
- **Screenshots live in `dist/_screens/`**, which is git-ignored (`dist/`), so
  they are not committed. Regenerate with headless Chrome after `node src/build.js`.
