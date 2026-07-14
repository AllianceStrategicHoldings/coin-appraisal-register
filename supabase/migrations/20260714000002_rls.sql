-- ============================================================================
-- Row Level Security
--
-- Access model: the PWA reads public config with the anon key; ALL writes and
-- all deal/customer/rep reads go through Make.com using the service_role key
-- (which bypasses RLS). PIN auth happens in-app via Make, not Supabase Auth,
-- so nothing sensitive may be visible to anon.
-- ============================================================================

alter table config_margins       enable row level security;
alter table config_coin_types    enable row level security;
alter table config_locations     enable row level security;
alter table config_events        enable row level security;
alter table config_operator      enable row level security;
alter table reps_master          enable row level security;
alter table customer_master      enable row level security;
alter table deal_log             enable row level security;
alter table deal_line_items      enable row level security;
alter table test_deal_log        enable row level security;
alter table test_deal_line_items enable row level security;
alter table override_codes       enable row level security;
alter table approval_requests    enable row level security;
alter table webhook_deliveries   enable row level security;
alter table spot_price_cache     enable row level security;

-- Anon may read non-sensitive config + cached spot prices (calculator needs
-- these to render). Everything else: no anon policies = no anon access.
create policy anon_read_coin_types on config_coin_types
  for select to anon using (active = true);

create policy anon_read_margins on config_margins
  for select to anon using (true);

create policy anon_read_locations on config_locations
  for select to anon using (active = true);

create policy anon_read_events on config_events
  for select to anon using (active = true);

create policy anon_read_spot_cache on spot_price_cache
  for select to anon using (true);

-- Deliberately NO anon policy on: config_operator (webhook URLs),
-- reps_master (PIN hashes), customer_master / deal_log / deal_line_items
-- (PII + margin data), override_codes, approval_requests, webhook_deliveries,
-- test tables.
