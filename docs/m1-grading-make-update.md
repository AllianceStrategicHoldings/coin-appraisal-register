# Make `bulk-calc` update — grading selector support

The PWA now sends `grade` (`circulated` / `uncirculated` / `slabbed`) on `times_face` items. To make the calculated total reflect the chosen grade, the `bulk-calc` scenario needs two small changes.

## 1. Refresh the Airtable schema on Module 4

Module 4 is the `Search Records` step that returns the `Config_CoinTypes` row for the item. Its cached schema does not yet know about the new columns. Standard Make fix:

1. Open the `bulk-calc` scenario.
2. Click **Module 4** (Airtable Search Records — `Config_CoinTypes`).
3. In the `Table` dropdown, re-select **Config_CoinTypes** (same option). This forces Make to refresh the schema.
4. Click **Save**.

After this, the downstream module picker shows `mult_circulated`, `mult_uncirculated`, `mult_slabbed`.

## 2. Update Module 6 formula to switch on grade

Module 6 is the `Set Variables` step. Two of its variables — `unit_value` and `line_total` — currently read `4.fixed_multiplier` directly. Replace those with a `switch()` on `3.grade` that falls back to `fixed_multiplier` when no grade is present (keeps backward compat for any item that doesn't send a grade).

### `unit_value`

**Before:**

```
if(4.priced_by = "times_face"; 4.face_value * 4.fixed_multiplier; 4.oz_metal_per_unit * switch(4.metal_type; "silver"; 2.data.rates.USDXAG; "gold"; 2.data.rates.USDXAU; "platinum"; 2.data.rates.USDXPT) * 5.margin_pct)
```

**After:**

```
if(4.priced_by = "times_face"; 4.face_value * switch(3.grade; "circulated"; 4.mult_circulated; "uncirculated"; 4.mult_uncirculated; "slabbed"; 4.mult_slabbed; 4.fixed_multiplier); 4.oz_metal_per_unit * switch(4.metal_type; "silver"; 2.data.rates.USDXAG; "gold"; 2.data.rates.USDXAU; "platinum"; 2.data.rates.USDXPT) * 5.margin_pct)
```

### `line_total`

**Before:**

```
if(4.priced_by = "times_face"; 3.quantity * 4.face_value * 4.fixed_multiplier; ifempty(3.quantity; 3.weight_grams) * 4.oz_metal_per_unit * switch(4.metal_type; "silver"; 2.data.rates.USDXAG; "gold"; 2.data.rates.USDXAU; "platinum"; 2.data.rates.USDXPT) * 5.margin_pct)
```

**After:**

```
if(4.priced_by = "times_face"; 3.quantity * 4.face_value * switch(3.grade; "circulated"; 4.mult_circulated; "uncirculated"; 4.mult_uncirculated; "slabbed"; 4.mult_slabbed; 4.fixed_multiplier); ifempty(3.quantity; 3.weight_grams) * 4.oz_metal_per_unit * switch(4.metal_type; "silver"; 2.data.rates.USDXAG; "gold"; 2.data.rates.USDXAU; "platinum"; 2.data.rates.USDXPT) * 5.margin_pct)
```

The trailing `4.fixed_multiplier` after the three `switch()` cases is the default — used when `3.grade` is empty (a request from an older client, or a non-numismatic times_face row). This preserves the verified Wheat/Steel Penny test case.

## 3. Save and re-export

After saving Module 6, run the scenario once with a numismatic grade to verify, then re-export the blueprint and replace `make/bulk-calc.v1.blueprint.json` (scrub the `metals-api` access_key back to `REPLACE_WITH_METALS_API_KEY` first).

## 4. Populate per-grade values in Airtable

The PWA falls back to `fixed_multiplier` when `mult_*` is empty, so a coin without per-grade values still calculates (just without grade differentiation). For the grading selector to be meaningful per the spec, fill in all three columns on each of the 11 numismatic rows in `Config_CoinTypes`. Wheat/Steel Penny already has `mult_circulated = 5` pre-populated to match its existing `fixed_multiplier`.
