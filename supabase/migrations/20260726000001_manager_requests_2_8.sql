-- ============================================================================
-- Manager-Required Workflows (spec 2.8)
--
-- Ask Manager and "Not Sure What This Is" fire mid-deal — before the deal
-- record exists — so an approval request must be able to reference the
-- client-side draft instead of a deal_log row. Make backfills deal_id when
-- the deal is finally submitted.
-- ============================================================================

alter table approval_requests alter column deal_id drop not null;
alter table approval_requests add column deal_draft_id text;

-- The rep's item description typed alongside the photo ("Not Sure" flow)
alter table approval_requests add column item_description text;

create index approval_requests_draft_idx on approval_requests (deal_draft_id);
