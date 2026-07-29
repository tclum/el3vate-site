# EL3VATE DAY 8 SITE — third run, agent prompt rev 3.0 (2026-07-28)

## Location assertion — run this first, before anything else

```
pwd
git rev-parse --show-toplevel
git remote -v
ls src/build.js src/validate.js ship.sh content/claims.json
git status --short
```

Abort, print `WRONG REPO`, and do nothing else if any of the following is true:

- `git remote -v` mentions `forpono` or `DDO-Tech-Solutions`. This repo has no remote. The `el3vate.forpono.com` domain is a DNS alias only; nothing here is part of the Forpono codebase, and nothing in this brief may touch a Forpono clone.
- Any of the four listed files is missing.
- `git rev-parse --show-toplevel` differs from `pwd`.

Print the resolved toplevel in your first message. Every path below is relative to it. Nothing outside it may be created, modified, or deleted.

## Context and the two hard constraints

Phases 1 through 12 are complete and committed. The site is live at `https://el3vate.vercel.app` and also at `https://el3vate.forpono.com`, both serving the same build from the same Vercel project.

**Tim presents from this site tomorrow morning.** Two constraints follow, and they override everything else in this brief:

**CONSTRAINT A — `SITE_URL` does not change.** It stays exactly `https://el3vate.vercel.app`. Phase 11 already generated `qr.svg` and `closing-card.html` from it, and the presenter kit has that QR inlined as a data URI inside a 916KB self-contained file. Changing `SITE_URL` invalidates all three and forces a rebuild of the artifact Tim presents from. The forpono domain is an additional alias, recorded in a new `ALIASES` constant for display purposes only. Never substitute it into `SITE_URL`. Never substitute a deployment-specific hostname of the form `el3vate-<hash>-tclum-4994s-projects.vercel.app`.

**CONSTRAINT B — the demos stay offline.** GATE 5 fails the build on any `fetch(`, `XMLHttpRequest`, `api.`, or dynamic `import(` inside a demo file. That gate does not get relaxed, weakened, or scoped away. It exists because the session runs on conference wifi and the demos must work with the network dead. Only the feedback component added in phase 15 may touch the network, and it lives in the page shell, not in any demo.

If you find yourself needing to change either constraint to make something work, stop, log it in `BLOCKERS.md`, and move to the next phase.

Same operating rules as prior runs: work in order, commit after each phase with explicit file lists, never `git add -A`, never stall waiting for input, append anything unresolvable to `BLOCKERS.md` and continue.

## Phase 13 — kill switch and config

Everything in this run must be revertible in under two minutes by flipping one boolean, because if anything looks wrong at 8am Tim flips it, runs `./ship.sh prod`, and is back to the known-good site.

At the top of `src/build.js`, next to `SITE_URL`, add:

```js
const USE_SUPABASE = false;              // master switch for everything in phases 13-17
const SUPABASE_URL = '';                 // filled by Tim
const SUPABASE_ANON_KEY = '';            // filled by Tim — anon key ONLY, never service_role
const ALIASES = ['https://el3vate.forpono.com'];   // display only; never used as SITE_URL
```

Behaviour, and this is the part that must be exactly right:

- When `USE_SUPABASE` is false, **or** when either credential is an empty string, the build emits the current `mailto:` feedback links and nothing else. No Supabase script tag, no form markup, no credential, no reference to the domain anywhere in `dist/`.
- When `USE_SUPABASE` is true and both credentials are non-empty, the build emits the phase 15 form.
- Default the flag to `false` and commit it that way. Tim turns it on deliberately after reviewing.

Add the ALIASES value somewhere sensible in the hub footer as plain text ("also at el3vate.forpono.com"). This is the only place the forpono domain appears.

Commit.

## Phase 14 — migration SQL, authored and NOT applied

**You do not have database credentials and must not attempt to obtain them, and you must not run any migration.** Tim gates all migrations personally and applies them himself in the Supabase SQL editor. Your job is to author SQL for him to review line by line.

Write `db/001_feedback.sql` with a documenting header comment. It creates one table:

`el3vate_feedback` — `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`, `discipline text not null`, `what_they_tried text not null`, `what_happened text`, `contact_email text`, `user_agent text`.

Requirements, each of which must be explicit in the SQL:

- `alter table el3vate_feedback enable row level security;`
- Exactly one policy: anonymous insert. No select, update, or delete policy for `anon` under any circumstances. The anon key ships in a public HTML page, so anything readable by `anon` is readable by the world. Tim reads submissions through the Supabase dashboard, which uses his own credentials.
- A `check` constraint bounding `what_they_tried` and `what_happened` to a sane maximum length, and `discipline` to the 15 known slugs. This is the only abuse control available at the database layer; note in the header comment that it is not rate limiting and that Supabase-level rate limits should be configured separately in the dashboard.
- `contact_email` is nullable and optional. Say so in the form copy too.

Then write the verification query Tim runs after applying, which must confirm: the table exists, RLS is enabled, and exactly one policy exists with command `INSERT` and role `anon`. It must return rows he can read, not silence.

Print the full SQL and the verification query in your report. Do not apply anything. Commit the file.

## Phase 15 — feedback form

Replace the `mailto:` feedback link on each discipline page with a real form, **gated entirely behind the phase 13 switch**.

- Fields: what they tried (required), what happened (optional), contact email (optional, clearly marked). Discipline is filled automatically from the page.
- Submit via `fetch` to the Supabase REST endpoint with the anon key. Handle failure visibly: on any error, show the `mailto:` link as a fallback with the discipline prefilled in the subject, so a broken backend degrades to the current behaviour rather than losing the submission.
- No external SDK. A single `fetch` against the REST endpoint, written inline. Do not add a dependency.
- The form is in the page shell only. It must not appear inside any demo iframe, and no demo file may gain a network call. GATE 5 must still pass unchanged.
- Keyboard operable, WCAG AA contrast, visible focus, `prefers-reduced-motion` respected, works on a phone. Same standard as the rest of the site.
- Do not autofocus the form. It sits at the bottom of a long page and stealing focus on load breaks screen reader flow.

Commit.

## Phase 16 — gates

Add to `src/validate.js`. Every gate must be demonstrably capable of failing: write a deliberately broken fixture, confirm the gate catches it, then delete the fixture and record what the failing input was.

1. **Kill-switch reversibility.** Build with `USE_SUPABASE=false` and fail if the string `supabase`, the value of `SUPABASE_URL`, or the value of `SUPABASE_ANON_KEY` appears anywhere in `dist/`. This is the gate that proves the 8am escape hatch actually works.
2. **No service-role key, ever.** Fail if `service_role` or any string matching a service-role JWT shape appears anywhere in `dist/` or in any tracked file, regardless of switch state.
3. **SITE_URL integrity.** Fail if `SITE_URL` is anything other than `https://el3vate.vercel.app`, or if a deployment-specific `el3vate-<hash>-` hostname appears in `dist/`.
4. **Demo isolation.** Assert GATE 5 still passes and additionally fail if any file under `dist/demos/` contains the word `supabase`.

Run the full suite including all prior gates and the complete selftest. Commit.

## Phase 17 — report

Write to `REPORT.md`: what shipped, the full migration SQL and verification query, every new gate's demonstrated failure input, and the exact steps Tim takes to enable this (fill three constants, apply the migration, flip the switch, `./ship.sh prod`) and to revert it (flip the switch, `./ship.sh prod`).

State plainly which checks you ran and saw output for, and which you could not run. Do not describe a phase as complete if its gate did not execute.

Finish by confirming, from actual build output rather than from intent, that `USE_SUPABASE` is committed as `false` and that `dist/` contains no Supabase reference. That is the state Tim presents from tomorrow.
