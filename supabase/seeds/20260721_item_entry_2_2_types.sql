-- ============================================================================
-- Coin types for the remaining 2.2 entry paths.
--
-- ⚠️ PREMIUMS AND PURITY FACTORS BELOW ARE PLACEHOLDERS. The operator's coin
-- type configuration spreadsheet (Section 6 kickoff deliverable) is the source
-- of truth — these values exist so the entry paths are testable and are meant
-- to be edited in the Supabase Table Editor.
--
-- Re-runnable: upserts on name.
-- ============================================================================

-- Sterling flatware already exists from M1; turn on the hallmark gate.
update config_coin_types
   set requires_hallmark_ack = true
 where name = 'Sterling Silver';

insert into config_coin_types
  (name, metal_type, margin_category, priced_by, oz_metal_per_unit, face_value,
   unit_label, premium_per_unit, purity_factor, requires_hallmark_ack,
   is_pre1933_gold, allow_purity_override, entry_note, active)
values
  -- Bullion (8) — unit x spot + premium per unit (2.2)
  ('American Gold Eagle 1 oz',      'gold',     'Gold',     'each_metal', 1.00000, null, 'coin', 75.00, null, false, false, false, null, true),
  ('Canadian Gold Maple 1 oz',      'gold',     'Gold',     'each_metal', 1.00000, null, 'coin', 65.00, null, false, false, false, null, true),
  ('South African Krugerrand 1 oz', 'gold',     'Gold',     'each_metal', 1.00000, null, 'coin', 60.00, null, false, false, false, null, true),
  ('Austrian Philharmonic 1 oz',    'gold',     'Gold',     'each_metal', 1.00000, null, 'coin', 60.00, null, false, false, false, null, true),
  ('American Silver Eagle 1 oz',    'silver',   'Silver',   'each_metal', 1.00000, null, 'coin',  3.50, null, false, false, false, null, true),
  ('Canadian Silver Maple 1 oz',    'silver',   'Silver',   'each_metal', 1.00000, null, 'coin',  2.75, null, false, false, false, null, true),
  ('Mexican Libertad 1 oz',         'silver',   'Silver',   'each_metal', 1.00000, null, 'coin',  3.00, null, false, false, false, null, true),
  ('American Platinum Eagle 1 oz',  'platinum', 'Platinum', 'each_metal', 1.00000, null, 'coin', 90.00, null, false, false, false, null, true),

  -- Foreign silver (4) — gross weight x stored purity; 4th is overridable
  ('Canadian Silver Dollar (pre-1968)', 'silver', 'Silver', 'each_metal',   0.75005, null, 'coin', null, 0.80000, false, false, false, null, true),
  ('Mexican Peso (1920-1945)',          'silver', 'Silver', 'each_metal',   0.53595, null, 'coin', null, 0.72000, false, false, false, null, true),
  ('British Half Crown (pre-1920)',     'silver', 'Silver', 'each_metal',   0.45462, null, 'coin', null, 0.92500, false, false, false, null, true),
  ('Other Foreign Silver',              'silver', 'Silver', 'weight_grams', 0.03215, null, 'gram', null, 0.80000, false, false, true,
     'Set the purity factor to match the piece before entering weight.', true),

  -- Pre-1933 US Gold — full-screen red stop + manager PIN (2.2 / 3.2)
  ('$20 Double Eagle (Pre-1933)',  'gold', 'Gold', 'each_metal', 0.96750, 20.00, 'coin', null, null, false, true, false, null, true),
  ('$10 Eagle (Pre-1933)',         'gold', 'Gold', 'each_metal', 0.48375, 10.00, 'coin', null, null, false, true, false, null, true),
  ('$5 Half Eagle (Pre-1933)',     'gold', 'Gold', 'each_metal', 0.24187,  5.00, 'coin', null, null, false, true, false, null, true),
  ('$2.50 Quarter Eagle (Pre-1933)','gold','Gold', 'each_metal', 0.12094,  2.50, 'coin', null, null, false, true, false, null, true),

  -- Paper money — rep enters the offer directly (2.2)
  ('Paper Money', 'numismatic', 'Collectibles', 'manual', null, null, 'note', null, null, false, false, false,
     'Manager review required before payout. Record denomination, year, and condition.', true)

on conflict (name) do update set
  metal_type            = excluded.metal_type,
  margin_category       = excluded.margin_category,
  priced_by             = excluded.priced_by,
  oz_metal_per_unit     = excluded.oz_metal_per_unit,
  face_value            = excluded.face_value,
  unit_label            = excluded.unit_label,
  premium_per_unit      = excluded.premium_per_unit,
  purity_factor         = excluded.purity_factor,
  requires_hallmark_ack = excluded.requires_hallmark_ack,
  is_pre1933_gold       = excluded.is_pre1933_gold,
  allow_purity_override = excluded.allow_purity_override,
  entry_note            = excluded.entry_note,
  active                = excluded.active;
