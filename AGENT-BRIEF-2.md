# EL3VATE DAY 8 SITE — second run, agent prompt rev 2.0 (2026-07-27)

## Location assertion — run this first, before anything else

Run these and stop if any assertion fails:

```
pwd
git rev-parse --show-toplevel
git remote -v
ls seed/el3vate-day8.html AGENT-BRIEF.md src/build.js src/validate.js
git status --short
```

Abort, print `WRONG REPO`, and do nothing else if any of the following is true:

- `git remote -v` mentions `forpono` or `DDO-Tech-Solutions`.
- Any of the five listed files is missing.
- `git rev-parse --show-toplevel` differs from `pwd`.
- `git status --short` is non-empty. The first run left a clean tree; a dirty tree means something else has touched this repo and a human should look before an unattended run continues.

Print the resolved toplevel in your first message. Every path below is relative to it and nothing outside it may be created, modified, or deleted.

## Context

The first run (phases 1–6) is complete and all six gates pass. This is a second unattended run adding phases 7–12. Same rules as before: work in order, commit after each phase, never stall waiting for input, append anything unresolvable to `BLOCKERS.md` and continue.

The session this site supports is **Wednesday 29 July**. Phase 7 is the only phase that can damage the presentation if it is skipped. Do it first and do it thoroughly; if the night is short, everything after it is optional.

## Phase 7 — claim audit (highest priority)

The site currently contains model-generated factual claims that were never independently verified: statute citations, gene and variant biology, education standards codes, primary-source attributions, case references. `BLOCKERS.md` already flags them.

The Law page's own `aiFailsHere` section states that LLMs fabricate case citations with correct-looking reporter formatting. If a single citation on this site is wrong, a law faculty member will find it, and the site becomes a live demonstration of the failure it warns about. That is the specific outcome this phase exists to prevent.

Build `content/claims.json` by extracting **every** verifiable factual assertion from all `content/*.json` files: statutes, regulations, case names, gene and protein facts, standards codes (NGSS, CCSS, HRS, USC, CFR), named primary-source texts and their attributed positions, named institutions and programs, and any number presented as fact. For each, record: source file, field, exact quoted claim, claim type, and a `status` of `verified` / `refuted` / `unverifiable`.

Then verify each one. If you have web access, use it and record the URL you verified against. If you do not have web access, mark every claim `unverifiable`, note the absence of web access once in `BLOCKERS.md`, and proceed to the rewrite step.

Rewrite rules:

- `refuted` — remove the specific claim and rewrite the surrounding prose so the pedagogical point survives without it. Log every rewrite with before and after text.
- `unverifiable` — either rewrite to remove the specific citation while keeping the point, or keep it and render it inside a visible inline marker reading `unverified` that is styled distinctly and explained once at the top of the page. Prefer rewriting. Keep the marker only where the specific citation is load-bearing for the assignment.
- `verified` — leave alone, record the verification URL in `claims.json`.

The `promptOutput` fields are a special case. They are real model transcripts and their value depends entirely on being unedited, so **do not rewrite them**. Instead, where a transcript contains a refuted or unverifiable claim, extend that transcript's annotations to name it. A transcript where the annotation reads "this citation does not exist, and this is exactly the failure this assignment teaches students to catch" is more valuable than a clean one, and it is honest.

New gate (add to `src/validate.js`): fail the build if any claim in `claims.json` has status `refuted` and still appears verbatim in `dist/`, or if any `unverifiable` claim renders without its marker. Prove it fails on a fixture.

Commit.

## Phase 8 — demo interaction tests

The first run verified demos by page load, console errors and screenshot only. No click-through. Close that gap.

Attempt `npm i -D playwright && npx playwright install chromium`. If either fails, log it in `BLOCKERS.md` and skip to phase 9; do not spend the night fighting an install.

For each of the eight demos, write a test that drives the actual interaction and asserts on the result, not on the absence of errors:

- `zoning-tradeoffs`, `break-even`, `crater-sim` — move each slider to minimum and maximum; assert the output text changes and is not `NaN`, `undefined`, or empty at either extreme.
- `district-redraw` — perform a drag; assert the population deviation readout changes and that the red state triggers past ±5%.
- `variant-explainer` — toggle the variant; assert different explanatory text renders.
- `a11y-audit` — assert the checker reports a real failure when a fixture element with insufficient contrast is injected. A checker that cannot report a failure is decoration and must be fixed or removed.
- `intake-branching` — walk one advice-giving path and one reflective path; assert they reach different end states.
- `tradition-critique` — submit a correct highlight and an incorrect one; assert the scores differ.

Also assert, for every demo, keyboard-only operability: tab to each control, actuate with keyboard, confirm the same state change as with the mouse.

Add to the validation run. Commit.

## Phase 9 — print and handouts

- A print stylesheet for every discipline page: no navigation, no iframes, demo sections replaced by a short line naming the demo and the site URL, page breaks between major sections, black on white.
- Render each `handout.md` to `dist/<slug>/handout.pdf`. Use whatever is available locally; if nothing is, emit a clean print-styled `handout.html` instead and log the substitution.
- One combined `dist/all-handouts.pdf`, or `all-handouts.html` if PDF rendering is unavailable.

Gate: every discipline has a handout artifact and none is under 2KB. Commit.

## Phase 10 — presenter kit

Build `dist/presenter/index.html`, linked from nowhere on the public site and marked `noindex`. This is the page the presenter drives the session from, on conference wifi, possibly offline. It must work with no network at all.

Contents:

- Run of show with elapsed-time markers: 0:00 framing, 0:05 maker space tour, 0:25 access logistics and recording studio, 0:30 AI live build, 0:50 challenge and prompt exercise, 1:00 close.
- A start/pause timer with per-segment targets, showing time remaining in the current segment and whether the session is running long.
- Ordered links to the demos being shown, opening in new tabs, in presentation order.
- For each linked demo, an embedded fallback screenshot on the same page, so a broken demo can be narrated from a still without leaving the page.
- The two rehearsed starter prompts in full, with one-click copy.
- The site's public URL and its QR code, sized to be readable on a shared screen.

Everything self-contained and offline. No fonts fetched from CDN on this page; use system font stack so it renders with the network down. Commit.

## Phase 11 — session-day artifacts

- A QR code for the public site URL, generated at build time into a static SVG. A build-time npm dependency is acceptable; the runtime output must stay dependency-free. Read the URL from a single `SITE_URL` constant at the top of `src/build.js` and log its current value in `REPORT.md` so a placeholder is obvious.
- `dist/closing-card.html` — one full-screen slide with the site URL, the QR code, and the Day 10 challenge in one sentence. Designed to be screen-shared at the end of the session.
- Feedback capture on every discipline page: a `mailto:` link with the subject prefilled to the discipline name, asking what they tried and what happened. No backend, no form service. Put the recipient address in one constant next to `SITE_URL`.

Commit.

## Phase 12 — verify and report

Re-run every gate from the first run plus the new ones. Update `REPORT.md` with: what phases completed, the full claim audit result broken down by status with counts, every rewrite made in phase 7 with before and after, interaction test results per demo, and a prioritized list of what a human must review before Wednesday.

State plainly which checks you ran and saw output for, and which you could not run. Do not describe a phase as complete if its gate did not execute.
