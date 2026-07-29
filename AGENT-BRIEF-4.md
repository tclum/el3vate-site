# EL3VATE DAY 8 SITE — fourth run, agent prompt rev 4.0 (2026-07-28)

## Location assertion — run this first, before anything else

```
pwd
git rev-parse --show-toplevel
git remote -v
ls src/build.js src/validate.js ship.sh fill.sh db/001_feedback.sql
git status --short
```

Abort, print `WRONG REPO`, and do nothing else if any of the following is true:

- `git remote -v` mentions `forpono` or `DDO-Tech-Solutions`. This repo has no remote.
- Any of the five listed files is missing.
- `git rev-parse --show-toplevel` differs from `pwd`.

Print the resolved toplevel in your first message. Every path below is relative to it. Nothing outside it may be created, modified, or deleted.

## Context and the four hard constraints

Phases 1 through 17 are complete and committed. The site is live at `https://el3vate.vercel.app`, `USE_SUPABASE` is `false`, and no backend reference reaches `dist/`.

**Tim presents from this site at 9am tomorrow.** This run adds one capability: the live-build section on each discipline page fetches its content at page load, so Tim can change what the room sees by editing a database row instead of running a deploy.

**CONSTRAINT A — `fill.sh` keeps working, unchanged.** The build-time `liveBuild` field stays exactly as it is and stays rendered into the HTML. The fetch is a layer on top, not a replacement. Tim must retain the ability to type `./fill.sh <slug> "text"` and have it work whether or not the fetch path is functioning.

**CONSTRAINT B — the fallback chain is three deep and every step must be exercised.** Fetch succeeds with non-empty body, the section shows the fetched text. Fetch fails, times out, returns an error status, returns empty, or the flag is off, the section shows whatever was baked at build time from `liveBuild`. Nothing was baked, the section shows the existing reserved placeholder. No state may show a spinner, an error message, or a broken layout to a faculty member.

**CONSTRAINT C — the demos and the presenter kit are not touched.** GATE 5 and GATE 14 fail the build on any network call inside a demo, and the presenter kit is deliberately self-contained with zero subresources so it works with the network dead. Neither gains a fetch. The fetch lives only in the discipline page shell.

**CONSTRAINT D — `SITE_URL` does not change.** It stays `https://el3vate.vercel.app`. The QR code, closing card, and presenter kit are generated from it.

Same operating rules as prior runs: work in order, commit after each phase with explicit file lists, never `git add -A`, never stall waiting for input, append anything unresolvable to `BLOCKERS.md` and continue.

## Phase 18 — migration SQL, authored and NOT applied

**You do not have database credentials, must not attempt to obtain them, and must not run any migration.** Tim applies migrations himself in the Supabase SQL editor after reviewing them line by line. Author the SQL for him to read.

Write `db/002_live_build.sql` with a documenting header. It creates one table:

`el3vate_live` — `slug text primary key`, `body text`, `updated_at timestamptz not null default now()`.

Requirements, each explicit in the SQL:

- `alter table public.el3vate_live enable row level security;`
- Exactly one policy: **anonymous SELECT**. This is deliberately the opposite of `el3vate_feedback`, and the header must explain why: this table holds content written by Tim and intended for public display on a public page, so world-readable is the correct and intended property. It contains no personal data and none may ever be added to it. `el3vate_feedback` remains insert-only and is entirely unaffected.
- No insert, update, or delete policy for `anon`. Tim writes rows through the Supabase dashboard authenticated as himself.
- Grants matching: `grant usage on schema public to anon;` and `grant select on table public.el3vate_live to anon;`, with an explicit `revoke insert, update, delete, truncate, references, trigger ... from anon;`.
- A `check` constraint restricting `slug` to the same fifteen discipline slugs used in `001_feedback.sql`, and bounding `body` to a sane maximum length.
- Seed all fifteen rows with `body` set to null, so every discipline has a row waiting and Tim only ever edits, never inserts, during the session. Editing an existing row in the dashboard is materially faster than creating one.

Then write the verification query, in the same style as `001_feedback.sql`: one row per check, PASS or FAIL verdict, observed value included, never silent. It must confirm the table exists, RLS is enabled, exactly one policy exists, that policy is SELECT for `anon`, no write policy for `anon` exists, and fifteen rows are present.

Print the full SQL and the verification query in your report. Do not apply anything. Commit the file.

## Phase 19 — the fetch

Add to `src/build.js`, next to the existing constants:

```js
const USE_LIVE_FETCH = false;   // independent of USE_SUPABASE; controls only the live-build fetch
```

This is a separate switch from `USE_SUPABASE` on purpose. Tim must be able to run the live-build fetch with the feedback form still off, and to kill either one without affecting the other. `USE_LIVE_FETCH` requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` to be non-empty; if either is empty, it behaves as off regardless of the flag.

When on, each discipline page gets a small inline script, no SDK and no dependency, that:

- Fetches `<SUPABASE_URL>/rest/v1/el3vate_live?slug=eq.<slug>&select=body` with the anon key in the `apikey` and `Authorization` headers, and `Accept: application/json`.
- Applies an 8-second timeout via `AbortSignal.timeout` or an equivalent, so a hanging request cannot leave the section in an indeterminate state.
- On a 200 with a non-empty `body`, replaces the live-build section's content with that text, escaped as text and never as HTML. Treat the value as untrusted input even though Tim wrote it; use `textContent`, never `innerHTML`.
- On anything else — non-200, network error, timeout, empty array, null or whitespace-only body — leaves the build-time content untouched. No error message, no console noise beyond a single `console.debug`, no layout change.
- Polls every 20 seconds, and stops after 15 minutes or after the first successful non-empty fetch followed by 5 minutes of no change. The point is that text appears on a faculty member's screen during the session without them refreshing; the point is not to poll all day.
- Respects `prefers-reduced-motion`: if the section changes, no animation. A quiet content swap only.

When the section is showing fetched content, its heading reads the same as the build-time filled state ("Built live in session"). A faculty member must not be able to tell which path produced the text.

Commit.

## Phase 20 — gates

Add to `src/validate.js`. Every gate must be demonstrably capable of failing: write a deliberately broken fixture, confirm the gate catches it, delete the fixture, and record what the failing input was.

1. **Live-fetch kill switch.** Build with `USE_LIVE_FETCH=false` and fail if `el3vate_live`, the REST path, `SUPABASE_URL`, or `SUPABASE_ANON_KEY` appears anywhere in `dist/`. This proves the escape hatch.
2. **Independence of the two switches.** Build all four combinations of `USE_SUPABASE` and `USE_LIVE_FETCH` and assert that each artifact contains exactly what that combination implies and nothing more. In particular, `USE_SUPABASE=false` with `USE_LIVE_FETCH=true` must contain the live fetch and no feedback form.
3. **No innerHTML on fetched content.** Fail if the emitted script assigns fetched data to `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `document.write`.
4. **Demo and presenter isolation.** Re-assert GATE 5 and GATE 14, and additionally fail if any file under `dist/demos/` or `dist/presenter/` contains `el3vate_live` or the REST path.
5. **Fallback presence.** Fail if a discipline page's live-build section is empty in the served HTML. There must always be either baked content or the reserved placeholder in the markup before any script runs, so a faculty member with JavaScript disabled or a dead network sees a complete page.

Run the full suite including all prior gates and the complete selftest. Commit.

## Phase 21 — report

Write to `REPORT.md`: what shipped, the full migration SQL and verification query, every new gate's demonstrated failure input, and two procedures written out step by step.

**Enable:** apply `db/002_live_build.sql`, run the verification query, fill `SUPABASE_URL` and `SUPABASE_ANON_KEY`, set `USE_LIVE_FETCH = true`, run `./ship.sh prod`, then confirm from a real browser that editing a row in the dashboard changes the page within 20 seconds.

**Revert:** set `USE_LIVE_FETCH = false`, run `./ship.sh prod`. State the expected wall-clock time for the revert.

State plainly which checks you ran and saw output for, and which you could not run. The fetch has never completed against a real endpoint from your session; say so rather than implying otherwise. Confirm from actual build output, not intent, that both switches are committed as `false` and that `dist/` contains no backend reference.
