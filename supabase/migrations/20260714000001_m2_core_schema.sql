-- ============================================================================
-- Coin Appraisal Register — M2 core schema
-- Spec: App Build Final, Sections 2.11–2.15, 3.1–3.5
--
-- Schema discipline (Section 2.14): standard data types only, no business
-- logic in database formulas, no platform-native automations — all workflow
-- runs in Make.com. Constraints below are data integrity, not business logic.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Config tables (Section 2.15) — admin-editable via Supabase Table Editor
-- ---------------------------------------------------------------------------

create table config_margins (
  id          uuid primary key default gen_random_uuid(),
  category    text not null unique
              check (category in ('Silver', 'Gold', 'Platinum', 'Collectibles')),
  margin_pct  numeric(6,4) not null check (margin_pct > 0 and margin_pct <= 1),
  notes       text,
  updated_at  timestamptz not null default now()
);

create table config_coin_types (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null unique,
  metal_type         text not null
                     check (metal_type in ('silver', 'gold', 'platinum', 'numismatic')),
  margin_category    text not null references config_margins (category),
  priced_by          text not null
                     check (priced_by in ('each_metal', 'weight_grams', 'times_face')),
  oz_metal_per_unit  numeric(10,5),          -- troy oz pure metal per unit; null for times_face
  face_value         numeric(10,2),          -- used in math only for times_face
  unit_label         text not null default 'coin',   -- coin | gram | troy oz
  premium_per_unit   numeric(10,2),          -- bullion: unit x spot + premium (2.2)
  purity_factor      numeric(6,5),           -- sterling / foreign silver (2.2)
  mult_circulated    numeric(10,4),          -- times_face grade multipliers
  mult_uncirculated  numeric(10,4),
  mult_slabbed       numeric(10,4),
  key_date_warning   text,                   -- shown inline in picker (3.6)
  image_url          text,                   -- reference content for "Not Sure" search (2.8)
  active             boolean not null default true,
  updated_at         timestamptz not null default now()
);

create table config_locations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  branding_app_name  text,                   -- placeholders until final assets (Section 5)
  branding_logo_url  text,
  branding_accent    text,
  notes         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table config_events (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  start_date   date not null,
  end_date     date not null check (end_date >= start_date),
  location_id  uuid references config_locations (id),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table reps_master (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  pin_hash         text not null,            -- 4-digit PIN hashed in app/Make (3.1); never plaintext
  is_manager       boolean not null default false,
  failed_attempts  integer not null default 0,   -- 3-strike lockout state (3.1)
  locked_until     timestamptz,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create table config_operator (
  id                        smallint primary key default 1 check (id = 1),  -- single row
  operator_name             text not null,
  branding_app_name         text,
  branding_logo_url         text,
  branding_accent           text,
  default_location_id       uuid references config_locations (id),
  ghl_accepted_webhook_url  text,
  ghl_declined_webhook_url  text,
  zoho_webhook_url          text,
  fourth_webhook_url        text,            -- configurable 4th fan-out destination (2.10)
  updated_at                timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Customer_Master (Section 2.14) — keyed on phone + DOB, separate from deals
-- ---------------------------------------------------------------------------

create table customer_master (
  id           uuid primary key default gen_random_uuid(),
  phone        text not null,
  dob          date not null,
  name         text not null,
  zip          text,                         -- standalone for geographic analytics (2.1)
  dl_number    text,
  dl_photo_url text,
  tcpa_opt_in  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (phone, dob)                        -- returning-customer lookup key (2.1)
);

-- ---------------------------------------------------------------------------
-- Deal_Log (Section 2.14) — one row per deal, 35+ fields per spec
-- Field names to be reconciled against the operator's kickoff field map.
-- ---------------------------------------------------------------------------

create table deal_log (
  id                       uuid primary key default gen_random_uuid(),
  deal_number              text unique,      -- e.g. CAR-0001; generated by Make, not a DB formula
  status                   text not null default 'Pending'
                           check (status in ('Pending', 'Approved', 'Closed', 'Reconciled', 'Disputed')),

  -- parties & attribution (three attribution fields per spec)
  customer_id              uuid references customer_master (id),
  rep_pin_id               uuid references reps_master (id),      -- who did the deal
  credited_salesman_id     uuid references reps_master (id),      -- commission credit
  referrer                 text,                                  -- free-text referrer

  -- scoping (auto-populated from config)
  operator_id              smallint references config_operator (id),
  location_id              uuid references config_locations (id),
  event_id                 uuid references config_events (id),    -- null outside event mode (2.11)

  -- intake snapshot (2.1)
  tcpa_opt_in              boolean not null default false,
  collection_photo_url     text,             -- single lot photo at intake
  dl_photo_url             text,

  -- pricing roll-ups (2.4)
  total_max_payout         numeric(12,2),
  total_actual_offer       numeric(12,2),
  total_negotiation_delta  numeric(12,2),
  margin_pct_captured      numeric(6,4),

  -- spot snapshot at acceptance (2.14)
  spot_gold                numeric(12,4),
  spot_silver              numeric(12,4),
  spot_platinum            numeric(12,4),

  -- acceptance flow (2.6) / decline flow (2.7)
  accepted                 boolean,
  accepted_at              timestamptz,
  declined_at              timestamptz,
  payment_method           text check (payment_method in ('cash', 'check', 'wire', 'other')),
  cash_amount              numeric(12,2),
  acceptance_photo_url     text,             -- final lot photo
  offer_letter_url         text,             -- signed PDF in cloud storage
  signature_image_url      text,             -- PNG in cloud storage (Section 4)
  signature_captured_at    timestamptz,
  price_lock_24hr          boolean not null default false,
  price_lock_expires_at    timestamptz,

  -- manager-required acknowledgments (2.2, 2.6, 3.2)
  pre1933_gold_ack         boolean not null default false,
  pre1933_ack_manager_id   uuid references reps_master (id),
  pre1933_ack_at           timestamptz,
  cash_over_9500_ack       boolean not null default false,
  cash_ack_manager_id      uuid references reps_master (id),
  cash_ack_at              timestamptz,

  -- flag state (3.2)
  flag_state               text not null default 'normal'
                           check (flag_state in ('normal', 'manager_required')),
  manager_required_reason  text,
  manager_note             text,             -- timestamped Ask Manager notes (2.8)
  has_override             boolean not null default false,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index deal_log_status_idx    on deal_log (status);
create index deal_log_location_idx  on deal_log (location_id);
create index deal_log_created_idx   on deal_log (created_at);
create index deal_log_customer_idx  on deal_log (customer_id);
create index deal_log_rep_idx       on deal_log (rep_pin_id);

-- ---------------------------------------------------------------------------
-- Deal line items — one row per item (2.2 / 2.3 / 2.4)
-- ---------------------------------------------------------------------------

create table deal_line_items (
  id                    uuid primary key default gen_random_uuid(),
  deal_id               uuid not null references deal_log (id) on delete cascade,
  source_engine         text not null
                        check (source_engine in
                          ('bulk', 'bullion', 'sterling', 'foreign_silver',
                           'paper', 'graded', 'collectible', 'raw')),
  coin_type_id          uuid references config_coin_types (id),
  description           text,                -- graded/collectible/paper items
  cert_number           text,                -- manual cert entry (2.3)
  grade                 text check (grade in ('circulated', 'uncirculated', 'slabbed')),
  quantity              numeric(12,3),
  weight_grams          numeric(12,3),
  purity_factor_used    numeric(6,5),        -- manual override on foreign silver (2.2)
  hallmark_acknowledged boolean,             -- sterling popup (2.2)
  spot_used             numeric(12,4),
  premium_used          numeric(10,2),

  -- pricing (2.3 / 2.4)
  calculated_value      numeric(12,2),       -- underlying value before margin
  max_payout            numeric(12,2),
  actual_offer          numeric(12,2),
  negotiation_delta     numeric(12,2),
  price_source          text check (price_source in
                          ('calculated', 'cdn', 'manual_override', 'ask_manager')),
  cdn_price             numeric(12,2),
  manual_price_override numeric(12,2),
  ebay_low              numeric(12,2),       -- comps logged on every lookup (2.3)
  ebay_median           numeric(12,2),
  ebay_high             numeric(12,2),
  item_photo_url        text,

  created_at            timestamptz not null default now()
);

create index deal_line_items_deal_idx on deal_line_items (deal_id);

-- ---------------------------------------------------------------------------
-- Test mode mirrors (3.5) — same shape, no FKs into live data, no webhooks
-- ---------------------------------------------------------------------------

create table test_deal_log        (like deal_log        including all);
create table test_deal_line_items (like deal_line_items including all);

-- ---------------------------------------------------------------------------
-- Override codes + audit (2.13, 3.4) — issuance and use in one auditable row
-- ---------------------------------------------------------------------------

create table override_codes (
  id                uuid primary key default gen_random_uuid(),
  deal_id           uuid not null references deal_log (id),
  line_item_id      uuid references deal_line_items (id),
  code              text not null,           -- 6-digit, single-use, bound to deal
  issued_by         uuid not null references reps_master (id),
  issued_at         timestamptz not null default now(),
  expires_at        timestamptz not null,    -- issued_at + 30 min, set by Make
  used_at           timestamptz,             -- null until redeemed; single-use enforced in Make
  used_by           uuid references reps_master (id),
  item_description  text,
  amount_over_max   numeric(12,2),
  reason            text
);

create index override_codes_deal_idx on override_codes (deal_id);

-- ---------------------------------------------------------------------------
-- Approval gate queue (3.3) — powers Pending Approval screen + dashboard queue
-- ---------------------------------------------------------------------------

create table approval_requests (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid not null references deal_log (id),
  trigger_reason  text not null check (trigger_reason in
                    ('pre1933_gold', 'cash_over_9500', 'offer_above_max',
                     'ask_manager', 'not_sure_what_this_is')),
  requested_by    uuid references reps_master (id),
  requested_at    timestamptz not null default now(),
  item_photo_url  text,                      -- "Not Sure What This Is" photo (2.8)
  note            text,
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'denied', 'timed_out')),
  acted_by        uuid references reps_master (id),
  acted_at        timestamptz
);

create index approval_requests_status_idx on approval_requests (status);

-- ---------------------------------------------------------------------------
-- Webhook fan-out queue (2.10) + offline retry (2.14)
-- ---------------------------------------------------------------------------

create table webhook_deliveries (
  id               uuid primary key default gen_random_uuid(),
  deal_id          uuid not null references deal_log (id),
  destination      text not null check (destination in ('primary_db', 'ghl', 'zoho', 'custom')),
  event_type       text not null check (event_type in ('deal_accepted', 'deal_declined')),
  payload          jsonb not null,
  status           text not null default 'pending'
                   check (status in ('pending', 'delivered', 'failed')),
  attempts         integer not null default 0,
  next_attempt_at  timestamptz,
  delivered_at     timestamptz,
  last_error       text,
  created_at       timestamptz not null default now()
);

create index webhook_deliveries_pending_idx
  on webhook_deliveries (status, next_attempt_at);

-- ---------------------------------------------------------------------------
-- Spot price cache (2.14 offline degradation) — Make writes on every fetch;
-- app falls back to latest row per metal when the feed is unreachable
-- ---------------------------------------------------------------------------

create table spot_price_cache (
  id                uuid primary key default gen_random_uuid(),
  metal             text not null check (metal in ('gold', 'silver', 'platinum')),
  price_usd_per_ozt numeric(12,4) not null,
  fetched_at        timestamptz not null default now()
);

create index spot_price_cache_latest_idx on spot_price_cache (metal, fetched_at desc);
