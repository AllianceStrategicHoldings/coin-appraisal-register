-- ============================================================================
-- Allow anon reads of zip_centroids (spec 2.11 zip radius).
--
-- Make's IML has no trigonometric functions, so the haversine distance cannot
-- be computed in a Make module, and spec 2.14 puts calculations in app code
-- rather than database formulas. The app therefore fetches the two centroids
-- it needs and computes the distance itself.
--
-- Safe to expose: this is the public US Census ZCTA gazetteer — no PII, no
-- operator data. Every other table keeps its existing restrictive policies.
-- ============================================================================

create policy anon_read_zip_centroids on zip_centroids
  for select to anon using (true);
