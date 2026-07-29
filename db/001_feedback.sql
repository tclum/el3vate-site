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
