-- Atlas LINE LIFF: tables, functions and analytics views.
--
-- Target: the Astly Supabase project (Atlas shares Astly's database). Run the
-- whole file once in the Supabase SQL editor. Re-running it is safe.
--
-- Access: only Atlas's server touches these objects, with the service_role
-- key. RLS is on with no policies and anon/authenticated hold no grants, so
-- the public anon key cannot read a row or call a function.
--
-- Every object is prefixed atlas_ so it never collides with Astly's tables.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- A LINE user who opened the Atlas LIFF. line_user_id comes from a LINE ID
-- token verified on the server, never from the browser.
create table if not exists public.atlas_line_users (
  line_user_id      text primary key check (line_user_id ~ '^U[0-9a-f]{32}$'),
  display_name      text,
  picture_url       text,
  is_friend         boolean,
  friend_checked_at timestamptz,
  visit_count       integer not null default 0,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now()
);

-- One valuation attempt: a selected device and everything the user did with
-- it, whether or not they submitted. Device-to-price fields hold the latest
-- state; the *_at columns hold the first time each stage was reached, and
-- max_stage the furthest stage:
--   1 device selected     2 condition answered   3 estimate shown
--   4 asking price set    5 sale type chosen     6 request submitted
create table if not exists public.atlas_valuation_sessions (
  id                        uuid primary key default gen_random_uuid(),
  line_user_id              text not null references public.atlas_line_users (line_user_id) on delete cascade,
  client_session_id         text not null check (length(client_session_id) between 1 and 80),
  first_visit_id            uuid,
  status                    text not null,
  max_stage                 smallint not null default 1 check (max_stage between 1 and 6),
  device_id                 text,
  device_category           text,
  device_brand              text,
  device_model              text,
  device_specs              jsonb,
  assessment_definition_id  text,
  assessment_version        integer,
  assessment_answers        jsonb,
  condition_score           smallint check (condition_score between 0 and 100),
  condition_deductions      jsonb,
  astly_job_id              text,
  estimated_price           integer check (estimated_price >= 0),
  market_price              integer check (market_price >= 0),
  pawn_price                integer check (pawn_price >= 0),
  expected_price            integer check (expected_price > 0),
  transaction_intent        text check (transaction_intent in ('outright_sale', 'sell_and_repurchase')),
  started_at                timestamptz not null default now(),
  device_selected_at        timestamptz,
  condition_completed_at    timestamptz,
  valued_at                 timestamptz,
  expected_price_entered_at timestamptz,
  intent_selected_at        timestamptz,
  submitted_at              timestamptz,
  last_event_at             timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (line_user_id, client_session_id)
);
create index if not exists atlas_valuation_sessions_started_idx on public.atlas_valuation_sessions (started_at desc);

-- Every tracked interaction, including visits that never selected a device.
-- occurred_at is the user's device clock corrected to server time.
create table if not exists public.atlas_liff_events (
  id           bigint generated always as identity primary key,
  line_user_id text not null references public.atlas_line_users (line_user_id) on delete cascade,
  visit_id     uuid not null,
  session_id   uuid references public.atlas_valuation_sessions (id) on delete set null,
  event_name   text not null check (event_name ~ '^[a-z][a-z0-9_]{1,63}$'),
  step         text,
  occurred_at  timestamptz not null,
  received_at  timestamptz not null default now(),
  duration_ms  integer check (duration_ms >= 0),
  properties   jsonb not null default '{}'::jsonb
);
create index if not exists atlas_liff_events_session_idx on public.atlas_liff_events (session_id, occurred_at);
create index if not exists atlas_liff_events_user_idx on public.atlas_liff_events (line_user_id, occurred_at);
create index if not exists atlas_liff_events_name_idx on public.atlas_liff_events (event_name, occurred_at);
create index if not exists atlas_liff_events_visit_idx on public.atlas_liff_events (visit_id, occurred_at);

-- A request the user submitted ("interested"): at most one per valuation.
-- estimated_price is the used-market price the seller was shown (Astly's
-- market_price x condition, nearest 100 THB); market_price and pawn_price are
-- Astly's figures. Prices are the server-checked Astly result when
-- estimate_verified is true, otherwise what the browser reported.
create table if not exists public.atlas_sale_requests (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique check (reference ~ '^ATL-[0-9A-F]{8}$'),
  session_id           uuid not null unique references public.atlas_valuation_sessions (id) on delete cascade,
  line_user_id         text not null references public.atlas_line_users (line_user_id) on delete cascade,
  contact_name         text not null check (length(contact_name) between 1 and 120),
  contact_phone        text not null check (contact_phone ~ '^0[0-9]{9}$'),
  consent_to_contact   boolean not null check (consent_to_contact),
  consented_at         timestamptz not null,
  product_name         text not null,
  device_id            text not null,
  device_category      text not null,
  device_brand         text not null,
  device_model         text not null,
  device_specs         jsonb not null default '{}'::jsonb,
  condition_score      smallint check (condition_score between 0 and 100),
  condition_deductions jsonb,
  astly_job_id         text,
  estimate_verified    boolean not null default false,
  estimated_price      integer not null check (estimated_price > 0),
  market_price         integer check (market_price >= 0),
  pawn_price           integer check (pawn_price >= 0),
  expected_price       integer not null check (expected_price > 0),
  transaction_intent   text not null check (transaction_intent in ('outright_sale', 'sell_and_repurchase')),
  status               text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed', 'rejected')),
  line_push_status     text not null default 'pending' check (line_push_status in ('pending', 'sent', 'failed', 'skipped')),
  line_push_error      text,
  line_pushed_at       timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists atlas_sale_requests_user_idx on public.atlas_sale_requests (line_user_id, created_at desc);
create index if not exists atlas_sale_requests_status_idx on public.atlas_sale_requests (status, created_at desc);

-- Address for ขายฝาก (sell_and_repurchase) requests: where the device is
-- collected and the contract arranged. Null for an outright sale, which never
-- asks for one. Added after launch, so it is also an idempotent ALTER.
alter table public.atlas_sale_requests
  add column if not exists contact_address  text check (contact_address is null or length(contact_address) between 10 and 300),
  add column if not exists contact_postcode text check (contact_postcode is null or contact_postcode ~ '^(1[0-9]|[2-8][0-9]|9[0-6])[0-9]{3}$');

-- ---------------------------------------------------------------------------
-- Functions (Atlas's server calls these through PostgREST RPC)
-- ---------------------------------------------------------------------------

-- Upserts the user, upserts the valuation-session snapshot and appends a batch
-- of events, in one transaction. Returns the valuation session id, or null when
-- the payload has no session (before a device is chosen). A submitted session
-- is frozen: snapshots arriving after the request (a late or retried batch)
-- no longer change it, but their events are still stored against it.
--
-- Payload: { user: {line_user_id, display_name?, picture_url?, is_friend?},
--            visit_id?, session?: {...snapshot, stage_times: {...}}, events?: [...] }
create or replace function public.atlas_ingest_liff_events(p_payload jsonb)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user    text := p_payload #>> '{user,line_user_id}';
  v_visit   uuid := (p_payload ->> 'visit_id')::uuid;
  v_s       jsonb := p_payload -> 'session';
  v_t       jsonb := coalesce(p_payload #> '{session,stage_times}', '{}'::jsonb);
  v_events  jsonb := coalesce(p_payload -> 'events', '[]'::jsonb);
  v_now     timestamptz := now();
  v_friend  boolean := (p_payload #>> '{user,is_friend}')::boolean;
  v_opened  integer;
  v_stage   smallint;
  v_session uuid;
begin
  select count(*) into v_opened from jsonb_array_elements(v_events) e where e ->> 'name' = 'liff_opened';

  insert into atlas_line_users as u (line_user_id, display_name, picture_url, is_friend, friend_checked_at, visit_count)
  values (v_user, p_payload #>> '{user,display_name}', p_payload #>> '{user,picture_url}',
          v_friend, case when v_friend is not null then v_now end, v_opened)
  on conflict (line_user_id) do update set
    display_name      = coalesce(excluded.display_name, u.display_name),
    picture_url       = coalesce(excluded.picture_url, u.picture_url),
    is_friend         = coalesce(excluded.is_friend, u.is_friend),
    friend_checked_at = coalesce(excluded.friend_checked_at, u.friend_checked_at),
    visit_count       = u.visit_count + excluded.visit_count,
    last_seen_at      = v_now;

  if coalesce(v_s ->> 'client_session_id', '') <> '' then
    v_stage := greatest(1, least(6, coalesce((v_s ->> 'stage')::smallint, 1)));
    insert into atlas_valuation_sessions as s (
      line_user_id, client_session_id, first_visit_id, status, max_stage,
      device_id, device_category, device_brand, device_model, device_specs,
      assessment_definition_id, assessment_version, assessment_answers,
      condition_score, condition_deductions,
      astly_job_id, estimated_price, market_price, pawn_price,
      expected_price, transaction_intent,
      started_at, device_selected_at, condition_completed_at, valued_at,
      expected_price_entered_at, intent_selected_at, submitted_at
    ) values (
      v_user, v_s ->> 'client_session_id', v_visit, coalesce(v_s ->> 'status', 'device_selected'), v_stage,
      v_s ->> 'device_id', v_s ->> 'device_category', v_s ->> 'device_brand', v_s ->> 'device_model', v_s -> 'device_specs',
      v_s ->> 'assessment_definition_id', (v_s ->> 'assessment_version')::integer, v_s -> 'assessment_answers',
      (v_s ->> 'condition_score')::smallint, v_s -> 'condition_deductions',
      v_s ->> 'astly_job_id', (v_s ->> 'estimated_price')::integer, (v_s ->> 'market_price')::integer, (v_s ->> 'pawn_price')::integer,
      (v_s ->> 'expected_price')::integer, v_s ->> 'transaction_intent',
      coalesce((v_t ->> 'device_selected')::timestamptz, v_now),
      (v_t ->> 'device_selected')::timestamptz, (v_t ->> 'condition_completed')::timestamptz, (v_t ->> 'valued')::timestamptz,
      (v_t ->> 'expected_price_entered')::timestamptz, (v_t ->> 'intent_selected')::timestamptz, (v_t ->> 'submitted')::timestamptz
    )
    on conflict (line_user_id, client_session_id) do update set
      status                    = excluded.status,
      max_stage                 = greatest(s.max_stage, excluded.max_stage),
      device_id                 = excluded.device_id,
      device_category           = excluded.device_category,
      device_brand              = excluded.device_brand,
      device_model              = excluded.device_model,
      device_specs              = excluded.device_specs,
      assessment_definition_id  = excluded.assessment_definition_id,
      assessment_version        = excluded.assessment_version,
      assessment_answers        = excluded.assessment_answers,
      condition_score           = excluded.condition_score,
      condition_deductions      = excluded.condition_deductions,
      astly_job_id              = excluded.astly_job_id,
      estimated_price           = excluded.estimated_price,
      market_price              = excluded.market_price,
      pawn_price                = excluded.pawn_price,
      expected_price            = excluded.expected_price,
      transaction_intent        = excluded.transaction_intent,
      started_at                = least(s.started_at, excluded.started_at),
      device_selected_at        = coalesce(s.device_selected_at, excluded.device_selected_at),
      condition_completed_at    = coalesce(s.condition_completed_at, excluded.condition_completed_at),
      valued_at                 = coalesce(s.valued_at, excluded.valued_at),
      expected_price_entered_at = coalesce(s.expected_price_entered_at, excluded.expected_price_entered_at),
      intent_selected_at        = coalesce(s.intent_selected_at, excluded.intent_selected_at),
      submitted_at              = coalesce(s.submitted_at, excluded.submitted_at),
      last_event_at             = v_now,
      updated_at                = v_now
    where s.submitted_at is null
    returning s.id into v_session;

    if v_session is null then
      update atlas_valuation_sessions s set last_event_at = v_now
      where s.line_user_id = v_user and s.client_session_id = v_s ->> 'client_session_id'
      returning s.id into v_session;
    end if;
  end if;

  insert into atlas_liff_events (line_user_id, visit_id, session_id, event_name, step, occurred_at, duration_ms, properties)
  select v_user, v_visit, v_session, e ->> 'name', e ->> 'step',
         coalesce((e ->> 'occurred_at')::timestamptz, v_now),
         (e ->> 'duration_ms')::integer,
         coalesce(e -> 'properties', '{}'::jsonb)
  from jsonb_array_elements(v_events) e;

  return v_session;
end;
$$;

-- (Re-running this file: a changed return type cannot be replaced in place.)
drop function if exists public.atlas_submit_sale_request(jsonb);

-- Records a submitted request: refreshes the session snapshot (p_payload ->
-- 'ingest', the same shape atlas_ingest_liff_events takes), then creates the
-- request once per session. A repeat call (double tap, retry) returns the
-- existing request with created = false, so the caller sends the LINE
-- confirmation only once.
create or replace function public.atlas_submit_sale_request(p_payload jsonb)
returns table (request_id uuid, reference text, created boolean, created_at timestamptz, line_push_status text)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_r       jsonb := p_payload -> 'request';
  v_user    text := p_payload #>> '{ingest,user,line_user_id}';
  v_session uuid;
  v_id      uuid;
  v_now     timestamptz := now();
  v_attempt integer := 0;
begin
  v_session := atlas_ingest_liff_events(p_payload -> 'ingest');
  if v_session is null then
    raise exception 'atlas_submit_sale_request: payload has no session' using errcode = '22023';
  end if;

  -- References are 32 random bits: on the rare collision, draw another.
  loop
    v_attempt := v_attempt + 1;
    begin
      insert into atlas_sale_requests as r (
        reference, session_id, line_user_id,
        contact_name, contact_phone, contact_address, contact_postcode, consent_to_contact, consented_at,
        product_name, device_id, device_category, device_brand, device_model, device_specs,
        condition_score, condition_deductions,
        astly_job_id, estimate_verified, estimated_price, market_price, pawn_price,
        expected_price, transaction_intent
      ) values (
        'ATL-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)), v_session, v_user,
        v_r ->> 'contact_name', v_r ->> 'contact_phone',
        nullif(v_r ->> 'contact_address', ''), nullif(v_r ->> 'contact_postcode', ''), true, v_now,
        v_r ->> 'product_name', v_r ->> 'device_id', v_r ->> 'device_category', v_r ->> 'device_brand', v_r ->> 'device_model',
        coalesce(v_r -> 'device_specs', '{}'::jsonb),
        (v_r ->> 'condition_score')::smallint, v_r -> 'condition_deductions',
        v_r ->> 'astly_job_id', coalesce((v_r ->> 'estimate_verified')::boolean, false),
        (v_r ->> 'estimated_price')::integer, (v_r ->> 'market_price')::integer, (v_r ->> 'pawn_price')::integer,
        (v_r ->> 'expected_price')::integer, v_r ->> 'transaction_intent'
      )
      on conflict (session_id) do nothing
      returning r.id into v_id;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then raise; end if;
    end;
  end loop;

  update atlas_valuation_sessions s
  set status = 'request_submitted', max_stage = 6, submitted_at = coalesce(s.submitted_at, v_now), updated_at = v_now
  where s.id = v_session;

  return query
  select r.id, r.reference, v_id is not null, r.created_at, r.line_push_status
  from atlas_sale_requests r
  where r.session_id = v_session;
end;
$$;

-- ---------------------------------------------------------------------------
-- Analytics views (security_invoker: they run with the caller's rights)
-- ---------------------------------------------------------------------------

-- One row per valuation: how far the user got, seconds spent between stages,
-- and the asking price against the estimate.
create or replace view public.atlas_v_session_timings with (security_invoker = true) as
select
  s.id as session_id,
  s.line_user_id,
  u.display_name,
  s.device_category,
  s.device_brand,
  s.device_model,
  s.status,
  s.max_stage,
  s.max_stage = 6 as submitted,
  s.transaction_intent,
  s.condition_score,
  s.estimated_price,
  s.expected_price,
  s.expected_price - s.estimated_price as expected_minus_estimate,
  round(s.expected_price::numeric / nullif(s.estimated_price, 0), 3) as expected_to_estimate_ratio,
  s.started_at,
  extract(epoch from s.condition_completed_at - s.device_selected_at)::integer      as condition_seconds,
  extract(epoch from s.valued_at - s.condition_completed_at)::integer               as estimate_wait_seconds,
  extract(epoch from s.expected_price_entered_at - s.valued_at)::integer            as price_decision_seconds,
  extract(epoch from s.intent_selected_at - s.expected_price_entered_at)::integer   as intent_decision_seconds,
  extract(epoch from s.submitted_at - s.intent_selected_at)::integer                as contact_form_seconds,
  extract(epoch from s.submitted_at - s.valued_at)::integer                         as estimate_to_submit_seconds,
  extract(epoch from coalesce(s.submitted_at, s.last_event_at) - s.started_at)::integer as total_seconds,
  s.last_event_at
from public.atlas_valuation_sessions s
join public.atlas_line_users u using (line_user_id);

-- Active (on-screen) time per step. A visit's time on a step is summed first,
-- so leaving and coming back counts as one stay.
create or replace view public.atlas_v_step_durations with (security_invoker = true) as
with per_visit as (
  select e.visit_id, e.step, sum(e.duration_ms) as active_ms
  from public.atlas_liff_events e
  where e.event_name = 'step_left' and e.duration_ms is not null and e.step is not null
  group by e.visit_id, e.step
)
select
  step,
  count(*) as visits,
  round(avg(active_ms) / 1000.0, 1) as avg_seconds,
  round((percentile_cont(0.5) within group (order by active_ms) / 1000.0)::numeric, 1) as median_seconds,
  round((percentile_cont(0.9) within group (order by active_ms) / 1000.0)::numeric, 1) as p90_seconds
from per_visit
group by step;

-- Daily funnel, Bangkok time. LIFF opens and users count from events; the
-- valuation stages count sessions started that day.
create or replace view public.atlas_v_daily_funnel with (security_invoker = true) as
with opens as (
  select (e.occurred_at at time zone 'Asia/Bangkok')::date as day,
         count(distinct e.visit_id) as liff_opens,
         count(distinct e.line_user_id) as unique_users
  from public.atlas_liff_events e
  where e.event_name = 'liff_opened'
  group by 1
), stages as (
  select (s.started_at at time zone 'Asia/Bangkok')::date as day,
         count(*) as devices_selected,
         count(*) filter (where s.max_stage >= 2) as conditions_completed,
         count(*) filter (where s.max_stage >= 3) as estimates_shown,
         count(*) filter (where s.max_stage >= 4) as asking_prices_set,
         count(*) filter (where s.max_stage >= 5) as sale_types_chosen,
         count(*) filter (where s.max_stage = 6) as requests_submitted,
         count(*) filter (where s.transaction_intent = 'outright_sale') as chose_outright_sale,
         count(*) filter (where s.transaction_intent = 'sell_and_repurchase') as chose_sell_and_repurchase
  from public.atlas_valuation_sessions s
  group by 1
)
select coalesce(o.day, s.day) as day,
       coalesce(o.liff_opens, 0) as liff_opens,
       coalesce(o.unique_users, 0) as unique_users,
       coalesce(s.devices_selected, 0) as devices_selected,
       coalesce(s.conditions_completed, 0) as conditions_completed,
       coalesce(s.estimates_shown, 0) as estimates_shown,
       coalesce(s.asking_prices_set, 0) as asking_prices_set,
       coalesce(s.sale_types_chosen, 0) as sale_types_chosen,
       coalesce(s.requests_submitted, 0) as requests_submitted,
       coalesce(s.chose_outright_sale, 0) as chose_outright_sale,
       coalesce(s.chose_sell_and_repurchase, 0) as chose_sell_and_repurchase
from opens o
full join stages s on s.day = o.day;

-- ---------------------------------------------------------------------------
-- Lock down: Atlas's server (service_role) only
-- ---------------------------------------------------------------------------

alter table public.atlas_line_users         enable row level security;
alter table public.atlas_valuation_sessions enable row level security;
alter table public.atlas_liff_events        enable row level security;
alter table public.atlas_sale_requests      enable row level security;

revoke all on table public.atlas_line_users, public.atlas_valuation_sessions, public.atlas_liff_events,
  public.atlas_sale_requests, public.atlas_v_session_timings, public.atlas_v_step_durations, public.atlas_v_daily_funnel
  from public, anon, authenticated;
revoke all on sequence public.atlas_liff_events_id_seq from public, anon, authenticated;
revoke all on function public.atlas_ingest_liff_events(jsonb), public.atlas_submit_sale_request(jsonb)
  from public, anon, authenticated;

grant select, insert, update, delete on table public.atlas_line_users, public.atlas_valuation_sessions,
  public.atlas_liff_events, public.atlas_sale_requests to service_role;
grant select on table public.atlas_v_session_timings, public.atlas_v_step_durations, public.atlas_v_daily_funnel to service_role;
grant usage on sequence public.atlas_liff_events_id_seq to service_role;
grant execute on function public.atlas_ingest_liff_events(jsonb), public.atlas_submit_sale_request(jsonb) to service_role;
