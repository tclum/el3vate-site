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
