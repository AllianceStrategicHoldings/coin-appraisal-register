-- ============================================================================
-- Zip-radius support (operator decision 2026-07-21)
--
-- customer_zip_radius_miles measures how far the customer traveled: reference
-- point is the ACTIVE LOCATION's zip in store mode and the ACTIVE EVENT's
-- venue zip in event mode. Distance itself is computed in the Make.com
-- deal-submit scenario (no business logic in the database, per spec 2.14) —
-- the table below is reference data only.
-- ============================================================================

alter table config_locations add column zip text;        -- store location zip
alter table config_events    add column venue_zip text;  -- roadshow venue zip

-- US zip centroids (Census ZCTA gazetteer). Loaded once by
-- infra/zips/load-zip-centroids.mjs; ~33k rows. Reference data, not config.
create table zip_centroids (
  zip  text primary key,
  lat  numeric(9,6) not null,
  lng  numeric(9,6) not null
);

alter table zip_centroids enable row level security;
-- No anon policy: only Make.com (service role) reads this table.
