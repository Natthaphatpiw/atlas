-- Atlas LIFF migration 002: seller address for ขายฝาก requests.
--
-- Run once in the Astly Supabase SQL editor on a database that already has
-- database/atlas_liff.sql applied. Re-running it is safe. (A fresh database
-- only needs atlas_liff.sql, which now includes this change.)
--
-- Adds contact_address and contact_postcode to atlas_sale_requests and makes
-- atlas_submit_sale_request store them. Both stay null for an outright sale
-- (ขายขาด); Atlas's server requires them for sell_and_repurchase (ขายฝาก).
-- Either order of deploying Atlas and running this works: the old function
-- ignores the new fields, and the new function stores null when they are absent.

alter table public.atlas_sale_requests
  add column if not exists contact_address  text check (contact_address is null or length(contact_address) between 10 and 300),
  add column if not exists contact_postcode text check (contact_postcode is null or contact_postcode ~ '^(1[0-9]|[2-8][0-9]|9[0-6])[0-9]{3}$');

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

revoke all on function public.atlas_submit_sale_request(jsonb) from public, anon, authenticated;
grant execute on function public.atlas_submit_sale_request(jsonb) to service_role;
