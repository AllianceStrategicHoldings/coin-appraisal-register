-- Intake restructure (operator feedback 2026-08-23).
-- Intake now collects name / phone / email / reason / source only; DOB, zip,
-- DL and consent move to the post-agreement step. Declined deals therefore
-- have no DOB, so customer_master.dob becomes nullable. New email field is
-- captured at intake and forwarded to GHL.
--
-- Note: unique (phone, dob) remains the upsert conflict key. Rows inserted
-- with a NULL dob (declined deals) do not participate in that uniqueness, so
-- a repeat decliner can create more than one row until an accepted deal
-- backfills their DOB. Accepted-deal upserts dedupe exactly as before.

alter table customer_master alter column dob drop not null;
alter table customer_master add column if not exists email text;
