-- ============================================================================
-- Seed data — ported from airtable/seeds/coin_types.csv (M1 live config)
-- plus Config_Margins defaults per docs/data-model.md.
--
-- Remaining config (locations, events, reps, operator values) is provided by
-- the operator at kickoff per Section 6 and entered via the Table Editor.
-- ============================================================================

insert into config_margins (category, margin_pct, notes) values
  ('Silver',       0.30, 'All-in payout ratio. Set ~0.263 to exactly match legacy economics (30% x 0.877 wholesale).'),
  ('Gold',         0.30, null),
  ('Platinum',     0.30, null),
  ('Collectibles', 0.30, 'times_face items ignore margin; multiplier is the all-in buy multiple.');

insert into config_coin_types
  (name, metal_type, margin_category, priced_by, oz_metal_per_unit, face_value,
   unit_label, mult_circulated, mult_uncirculated, mult_slabbed, active)
values
  ('Roosevelt Dime',               'silver',     'Silver',       'each_metal',   0.07234, 0.10, 'coin',    null, null, null, true),
  ('Mercury Dime',                 'silver',     'Silver',       'each_metal',   0.07234, 0.10, 'coin',    null, null, null, true),
  ('Barber Dime',                  'silver',     'Silver',       'each_metal',   0.07234, 0.10, 'coin',    null, null, null, true),
  ('Seated Liberty Dime',          'silver',     'Silver',       'each_metal',   0.07234, 0.10, 'coin',    null, null, null, true),
  ('Washington Quarter',           'silver',     'Silver',       'each_metal',   0.18084, 0.25, 'coin',    null, null, null, true),
  ('Standing Liberty Quarter',     'silver',     'Silver',       'each_metal',   0.18084, 0.25, 'coin',    null, null, null, true),
  ('Barber Quarter',               'silver',     'Silver',       'each_metal',   0.18084, 0.25, 'coin',    null, null, null, true),
  ('Kennedy Half 1964',            'silver',     'Silver',       'each_metal',   0.36169, 0.50, 'coin',    null, null, null, true),
  ('Kennedy Half 1965-70',         'silver',     'Silver',       'each_metal',   0.14790, 0.50, 'coin',    null, null, null, true),
  ('Walking Liberty Half',         'silver',     'Silver',       'each_metal',   0.36169, 0.50, 'coin',    null, null, null, true),
  ('Franklin Half',                'silver',     'Silver',       'each_metal',   0.36169, 0.50, 'coin',    null, null, null, true),
  ('Barber Half',                  'silver',     'Silver',       'each_metal',   0.36169, 0.50, 'coin',    null, null, null, true),
  ('Seated Liberty Half',          'silver',     'Silver',       'each_metal',   0.36169, 0.50, 'coin',    null, null, null, true),
  ('Morgan Silver Dollar',         'silver',     'Silver',       'each_metal',   0.77344, 1.00, 'coin',    null, null, null, true),
  ('Peace Silver Dollar',          'silver',     'Silver',       'each_metal',   0.77344, 1.00, 'coin',    null, null, null, true),
  ('Morgan Silver Dollar (Graded)','numismatic', 'Collectibles', 'times_face',   null,    1.00, 'coin',    35,   55,   90,   true),
  ('Peace Silver Dollar (Graded)', 'numismatic', 'Collectibles', 'times_face',   null,    1.00, 'coin',    32,   50,   85,   true),
  ('Eisenhower 40% Dollar',        'silver',     'Silver',       'each_metal',   0.31624, 1.00, 'coin',    null, null, null, true),
  ('Jefferson War Nickel',         'silver',     'Silver',       'each_metal',   0.05626, 0.05, 'coin',    null, null, null, true),
  ('.999 Fine Silver',             'silver',     'Silver',       'weight_grams', 1.0,     null, 'troy oz', null, null, null, true),
  ('Sterling Silver',              'silver',     'Silver',       'weight_grams', 0.02974, null, 'gram',    null, null, null, true),
  ('10K Gold',                     'gold',       'Gold',         'weight_grams', 0.01337, null, 'gram',    null, null, null, true),
  ('14K Gold',                     'gold',       'Gold',         'weight_grams', 0.01874, null, 'gram',    null, null, null, true),
  ('18K Gold',                     'gold',       'Gold',         'weight_grams', 0.02412, null, 'gram',    null, null, null, true),
  ('22K Gold',                     'gold',       'Gold',         'weight_grams', 0.02947, null, 'gram',    null, null, null, true),
  ('Platinum Scrap',               'platinum',   'Platinum',     'weight_grams', 0.02572, null, 'gram',    null, null, null, true);
