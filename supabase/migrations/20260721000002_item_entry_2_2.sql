-- ============================================================================
-- Item Entry & Pricing Engine (spec 2.2)
--
-- Adds the per-coin-type flags that drive the remaining 2.2 entry paths:
-- bullion premiums (column already present), sterling/foreign-silver purity,
-- the hallmark acknowledgment gate, the manual purity override on foreign
-- silver, manual-entry paper money, and the Pre-1933 US Gold hard stop.
--
-- Flags are DATA, not logic: the app reads them and decides. Nothing here
-- computes anything (spec 2.14).
-- ============================================================================

-- 'manual' = rep enters the offer directly (paper money, spec 2.2)
alter table config_coin_types drop constraint config_coin_types_priced_by_check;
alter table config_coin_types add constraint config_coin_types_priced_by_check
  check (priced_by in ('each_metal', 'weight_grams', 'times_face', 'manual'));

-- Blocks weight entry until the rep acknowledges the hallmark popup (sterling)
alter table config_coin_types
  add column requires_hallmark_ack boolean not null default false;

-- Full-screen red stop + manager-PIN acknowledgment before the item can be
-- added (Pre-1933 US Gold). Ack is written to deal_log.pre1933_gold_ack*.
alter table config_coin_types
  add column is_pre1933_gold boolean not null default false;

-- Lets the rep override the stored purity factor (foreign silver, 4th entry)
alter table config_coin_types
  add column allow_purity_override boolean not null default false;

-- Static note shown on the entry screen (e.g. paper money manager-review note)
alter table config_coin_types add column entry_note text;

-- Line items: record the manual offer and the acknowledgments actually given
alter table deal_line_items add column manual_offer numeric(12,2);
alter table deal_line_items add column pre1933_ack boolean not null default false;

-- Test-mode mirrors were created with LIKE, so they do NOT inherit columns
-- added later — keep them in lockstep by hand (spec 3.5).
alter table test_deal_line_items add column manual_offer numeric(12,2);
alter table test_deal_line_items add column pre1933_ack boolean not null default false;
