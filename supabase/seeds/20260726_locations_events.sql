-- ============================================================================
-- Multi-location & roadshow config (spec 2.11).
--
-- ⚠️ PLACEHOLDERS pending the operator's Config_Locations / Config_Events
-- values (Section 6 kickoff data). Editable in the Supabase Table Editor.
-- Zips matter: they are the reference point for customer_zip_radius_miles
-- (location zip in store mode, event venue_zip in event mode).
-- ============================================================================

insert into config_locations (name, zip, branding_app_name, notes, active)
values
  ('Dallas — Main Store', '75201', 'Coin Appraisal Register', 'Primary deployment.', true),
  ('Fort Worth',          '76102', 'Coin Appraisal Register', 'Second location.',   true)
on conflict (name) do update set
  zip = excluded.zip, branding_app_name = excluded.branding_app_name,
  notes = excluded.notes, active = excluded.active;

insert into config_events (name, start_date, end_date, venue_zip, location_id, active)
select 'Tulsa Coin Show', date '2026-08-14', date '2026-08-16', '74103', l.id, true
  from config_locations l where l.name = 'Dallas — Main Store'
  and not exists (select 1 from config_events e where e.name = 'Tulsa Coin Show');

-- Single-row operator config, with a default location (spec 2.15)
insert into config_operator (id, operator_name, branding_app_name, default_location_id)
select 1, 'Alliance Strategic Holdings', 'Coin Appraisal Register', l.id
  from config_locations l where l.name = 'Dallas — Main Store'
on conflict (id) do update set default_location_id = excluded.default_location_id;
