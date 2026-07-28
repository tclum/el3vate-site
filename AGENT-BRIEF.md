# EL3VATE DAY 8 SITE BUILD — agent prompt rev 1.1 (2026-07-27)

## Location assertion — run this first, before anything else

This repo lives in `~/Desktop/Developer/`, alongside other clones including `forpono`. A session that started in the wrong directory must fail here rather than generating content files into an unrelated repo. Run these four commands and stop if any assertion fails:

```
pwd
git rev-parse --show-toplevel
git remote -v
ls seed/el3vate-day8.html AGENT-BRIEF.md
```

Abort, print `WRONG REPO`, and do nothing else if any of the following is true:

- `git remote -v` mentions `forpono` or `DDO-Tech-Solutions`. This is not that repo and must never be written to by this brief.
- `seed/el3vate-day8.html` or `AGENT-BRIEF.md` is missing. Those two files are the signature of this repo; without both, you are somewhere else.
- `git rev-parse --show-toplevel` differs from `pwd`. You are in a subdirectory and every relative path below would resolve wrong.

Print the resolved toplevel path in your first message so the human can confirm the target before the run proceeds unattended. Every path in this brief is relative to that toplevel and nothing outside it may be created, modified, or deleted.


You are building a static website for a faculty development session. It runs unattended. Work through the phases in order, commit after each one, and do not stop to ask questions. When you hit something you cannot resolve, append it to `BLOCKERS.md` with enough detail for a human to act on, then continue to the next item. A partially complete site with an honest blocker log is the goal; a stalled agent waiting for input is a failure.

## Context

Audience: 15 University of Hawai'i faculty, one per discipline, most of them non-technical. They attend a 1-hour Zoom session on prototyping (physical fabrication + AI-assisted building) and then have 10 months to try things in their classrooms. This site is the durable takeaway.

The 15 disciplines: Political Science, Entrepreneurship, Law, Comparative Philosophy, Marketing / Strategic Communication, Nutrition & Dietetics, Urban Planning, Learning Design & Technology, Bioinformatics, English Literature, Finance, Marriage & Family Therapy, Teacher Education, Family Business / Management, Planetary Science.

`seed/el3vate-day8.html` in this repo is an existing single-page version. It contains real, already-approved content for all 15 disciplines: a hook, a physical "Make it" build, an AI "Build it" build, a four-week plan, and a starter prompt. **Parse it and use it as the content seed.** Do not invent replacements for content that already exists there. Extract it into structured data in phase 1 and expand from it.

Also extract the visual design from that file: the cutting-mat green (`#17352C`), the laser cut-line red (`#DE3F26`), Bricolage Grotesque / Atkinson Hyperlegible / IBM Plex Mono, the dashed cut-line card borders with corner registration marks. The multi-page site must read as the same object. Do not redesign it.

## Non-negotiables

- Static output only. No server, no build framework, no React. A plain Node generator that emits HTML into `dist/`.
- Zero runtime dependencies except Google Fonts over CDN. The site must work opened from `file://` and hosted on GitHub Pages with no configuration.
- **No demo may call an AI API or any network service.** Everything interactive runs offline against canned data. The presenter will be on conference wifi with no keys configured.
- Accessible: keyboard operable, WCAG AA contrast, `prefers-reduced-motion` respected, visible focus.
- Every page must work on a phone.

## Phase 1 — scaffold and content extraction

Create:

```
/content/<discipline-slug>.json   (15 files)
/demos/<demo-slug>/index.html     (self-contained)
/src/build.js                     (generator)
/src/validate.js                  (gates)
/seed/el3vate-day8.html           (already present)
/dist/                            (generated, gitignored)
BLOCKERS.md
REPORT.md
```

Parse `seed/el3vate-day8.html` and write one JSON file per discipline with the seeded fields (`name`, `slug`, `hook`, `make`, `build`, `plan[4]`, `prompt`) plus empty fields for everything phase 2 adds. Commit.

## Phase 2 — write the per-discipline content

Each discipline JSON gains these sections. **This is the part most likely to go wrong: if you write these from a template and substitute nouns, the whole build is worthless.** The similarity gate in phase 5 exists specifically to catch that, and you should run it early and often rather than at the end.

1. `tryTuesday` — a 90-minute version of the assignment, runnable in a single class session with no fabrication and no prep beyond reading the page. This goes at the top of the page. It is the single most important field.
2. `replaces` — names the specific standard assignment in *that discipline's* typical course that this substitutes for (the seminar paper, the problem set, the case brief, the lesson plan submission), what is lost, and what is gained. Must be discipline-real; a generic "replaces a traditional assignment" is a failure.
3. `aiFailsHere` — the characteristic way LLMs fail *in this field*, stated precisely enough that a scholar in that field would nod. Examples of the right specificity: Law — fabricates case citations with correct-looking reporter formatting; English Literature — invents textual evidence that has the cadence of close reading; Bioinformatics — states gene function with unwarranted confidence and no source; Comparative Philosophy — collapses non-Western traditions into liberal individualism. Write the equivalent for all 15. This section buys credibility with skeptics and must not be boilerplate.
4. `rubric` — 4 to 6 weighted criteria, as a table, assessing what this specific assignment actually produces. Most of these assignments grade the student's critique of AI output rather than the output itself; the rubric has to operationalize that. An MFT rubric assessing whether the student listened more than they told is not a Finance rubric assessing sensitivity analysis.
5. `budget` — instructor prep hours, class minutes consumed, per-student cost, and the actual calendar dependency (fabrication turnaround is 7–10 days from file submission; state which week the file is due so the part arrives in time).
6. `scales` — three sizes of the same assignment: one session, four weeks (already seeded as `plan`), one semester.
7. `promptOutput` — the starter prompt run against a real model, with the **unedited** output, plus 3–5 margin annotations marking where it was good, where it hedged, where it invented something. If you cannot run a model, write `null` and log it in `BLOCKERS.md`; do not fabricate an output and present it as real. This field is worth more than any other if it is genuine and actively harmful if it is faked.
8. `related` — 2–3 slugs of other disciplines that share a structural problem, each with a one-sentence reason. The reason is the content, not the link. Political Science ↔ Urban Planning (contested stakeholders over a physical map), Law ↔ Marriage & Family Therapy (standardized-client simulation) are two real ones; derive the rest.
9. `demo` — slug of the embedded interactive demo, or `null`.

Commit after every 3 disciplines so a crash does not lose the night.

## Phase 3 — the demos

Build these as self-contained HTML files, each under 60KB, each iframed into its discipline page. They must run offline.

| slug | discipline | what it does |
|---|---|---|
| `zoning-tradeoffs` | Urban Planning | Sliders for height, unit count, parking ratio, open space. Outputs plain-language consequences a resident cares about: shadow, traffic, who can afford to live there, what gets demolished. No jargon. |
| `crater-sim` | Planetary Science | Canvas. Impactor size, velocity, angle, surface gravity → rendered crater profile. Label axes with units. Flag parameter ranges that are physically implausible while still allowing them. |
| `district-redraw` | Political Science | Drag precinct tiles between districts on an SVG grid. Live population-deviation readout that turns red past ±5%. Include a compactness score. |
| `break-even` | Finance | Interactive model with sliders, live output, prominent break-even marker, and a panel listing every assumption the model required. |
| `variant-explainer` | Bioinformatics | Canned sequence. Toggle a variant, see the downstream consequence explained for a non-specialist. Every term defined on first use. |
| `a11y-audit` | Learning Design & Technology | A small learning module plus a live checker that reports its own contrast, keyboard-trap, and reduced-motion status. It must genuinely evaluate the DOM, not print a hardcoded pass. |
| `intake-branching` | Marriage & Family Therapy | Branching canned client intake. The client opens up only on reflective responses, stays guarded on advice-giving. End screen names the moment the student lost them. |
| `tradition-critique` | Comparative Philosophy | A canned AI argument attributed to one tradition, alongside primary-source excerpts. User highlights spans where the argument departs from the source and the tool scores the highlight against a marked answer key. |

If you run short on time, the first four are the priority. Log any you skip.

Acceptance for each demo: opens from `file://`, operable by keyboard alone, no console errors, no network requests. Verify with a headless browser if one is available; if not, verify by static inspection and say so in `REPORT.md`.

## Phase 4 — generator and pages

`src/build.js` emits into `dist/`:

- `index.html` — hub. Reuse the existing seed page's hero and cut-sheet card layout, with each card now linking to its discipline page. Keep the sticky jump menu.
- `<slug>/index.html` — 15 discipline pages, section order: try Tuesday → make it / build it → embedded demo → four-week plan → starter prompt with real output → rubric → what this replaces → where AI is bad at this → budget → three scales → related disciplines.
- A visibly empty section on every discipline page marked as reserved for a live build during the session. Give it a stable id so it can be filled in later by editing one JSON field.
- `<slug>/handout.md` — a single "steal this" file per discipline containing assignment text, rubric, prompt, and budget, formatted to be pasted into a syllabus.

Every generated page carries `<!-- build: <git short sha> <ISO timestamp> -->` as the first line after `<!DOCTYPE html>` so a stale copy is identifiable.

## Phase 5 — validation gates

`src/validate.js` runs against `dist/` and exits non-zero on failure. **Each check must be capable of failing.** For every gate, write a deliberately broken fixture, confirm the gate flags it, then delete the fixture. Record in `REPORT.md` what the failing input was for each gate. A gate you cannot demonstrate failing is decoration and must be removed.

1. **Similarity gate.** For each of `tryTuesday`, `replaces`, `aiFailsHere`, `rubric`, compute pairwise similarity across all 15 disciplines (TF-IDF cosine or trigram Jaccard, plain Node, no dependencies). Fail the build if any pair exceeds 0.45 on any section. Print the 10 most similar pairs regardless of pass or fail — the ranked list is the useful output even on a pass.
2. **Link integrity.** Every internal href resolves to a file in `dist/`. Every `related` slug exists. Fail on any orphan.
3. **Reciprocity.** If A lists B as related, B lists A. Fail otherwise.
4. **Contrast.** Compute WCAG contrast for every foreground/background pair in the CSS. Fail below 4.5:1 for text under 24px, 3:1 above.
5. **Offline.** Grep every demo for `fetch(`, `XMLHttpRequest`, `api.`, `import(`. Fail on any hit except the Google Fonts link in the page shell.
6. **Completeness.** Fail if any required content field is empty, or if `promptOutput` is non-null but identical across two disciplines.

## Phase 6 — report

Write `REPORT.md` containing: what was built, what was skipped and why, the similarity gate's top-10 ranked pairs with scores, every gate's demonstrated failure input, and a prioritized list of what a human should review first. Be blunt about what is weak. Then take a full-page screenshot of the hub and of three discipline pages into `dist/_screens/` if a headless browser is available.

Do not claim a check passed unless you ran it and saw the output.
