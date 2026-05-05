# M1 Fixes — External Changes Required

This doc tracks the work that lives **outside the codebase** to complete the three M1 fixes from the May 2026 scope. The PWA-side changes are merged on the `m1-fixes` branch; the items below have to be made in Airtable and Make before the fixes are functionally complete on the iPad.

Status legend: 🔧 needs to be done · ✅ done

## 1. Airtable schema changes

### 🔧 1a. Add `fixed_multiplier` column to `Config_CoinTypes`

- **Table:** `Config_CoinTypes`
- **Field name:** `fixed_multiplier`
- **Type:** Number (decimal, allow blank)
- **Notes:** Used only for `priced_by = times_face` rows. Multiplier applied to face value: `qty × face_value × fixed_multiplier`. Per the May 2026 scope, you populate the multiplier values yourself per coin.

### 🔧 1b. Confirm `face_value` column exists on `Config_CoinTypes`

It already exists in the seed (used informationally). No change needed if the column is present in your live base — confirm it's a Number field (decimal, allow blank).

### 🔧 1c. Add 11 new rows to `Config_CoinTypes`

For each row: set `priced_by = times_face`, `metal_type = numismatic`, `unit_label = coin` (or `item` for Costume Jewelry), `oz_metal_per_unit = blank`, `active = TRUE`, then populate `face_value` and `fixed_multiplier` per your own pricing.

| name | category (M2) | face_value | fixed_multiplier |
|---|---|---|---|
| Wheat/Steel Penny | numismatic | _your value_ | _your value_ |
| Indian Head Penny | numismatic | _your value_ | _your value_ |
| Flying Eagle Penny | numismatic | _your value_ | _your value_ |
| Large Cent | numismatic | _your value_ | _your value_ |
| Shield Nickel | numismatic | _your value_ | _your value_ |
| Victory Nickel | numismatic | _your value_ | _your value_ |
| Buffalo Nickel | numismatic | _your value_ | _your value_ |
| Half Cent | numismatic | _your value_ | _your value_ |
| 2 Cent Piece | numismatic | _your value_ | _your value_ |
| 3 Cent Piece | numismatic | _your value_ | _your value_ |
| Costume Jewelry | jewelry | _your value_ | _your value_ |

The PWA renders all `metal_type = numismatic` items in a "Numismatic / Other" group at the bottom of the picker.

> Note: the M2 scope formalizes a `category` field on `Config_CoinTypes` (silver_coin, gold_coin, bullion, numismatic, flatware, foreign_silver, paper_money, collectible, jewelry). For the M1 fix, only `metal_type = numismatic` is required; the `category` field can be added in M2 without breaking the M1 build.

### 🔧 1d. Confirm `Config_Margins` rows exist for live offer display

The dual-totals UI needs a margin row per category that's used by spot-priced coins. Existing seed has rows for `silver`, `gold`, `platinum`. No changes required for the times-face coins (they don't use margin math). Confirm the four existing rows are present. If you want to be explicit, you can add a `numismatic` row at `1.00` — it will be ignored by the times-face math but documents intent.

## 2. Make.com scenario changes

### 🔧 2a. `bulk-calc` scenario — add `times_face` pricing branch

**Current state:** the scenario handles `priced_by = each_metal` and `priced_by = weight_grams` only.

**Required change:** add a third branch that fires when `priced_by = times_face`:

```
line_total = quantity × face_value × fixed_multiplier
unit_value = face_value × fixed_multiplier
```

**No spot fetch, no margin applied** for these lines. The result must be added to the same `lines[]` and `total` in the scenario response so the existing PWA receive logic works unchanged.

**How to wire it in Make:**
1. Open the `bulk-calc` scenario.
2. After the Airtable `Search Records` (Config_CoinTypes) module, the existing router branches on `priced_by`. Add a third route for `times_face`.
3. In the new route, set the line aggregator output to:
   - `coin_type_id` = the matched record id
   - `unit_value` = `{{face_value}} × {{fixed_multiplier}}`
   - `line_total` = `{{quantity}} × {{face_value}} × {{fixed_multiplier}}`
   - `name` = `{{name}}`
   - `units` = `{{quantity}}`
4. Run a manual test with a sample payload containing one times_face item. Confirm the response includes the line and the total includes its contribution.

### 🔧 2b. `config-load` scenario — return current spot + margins

**Current state:** the scenario returns `coin_types` and `reps` only.

**Required change:** also return:
- `spot`: object with `gold`, `silver`, `platinum` numbers (USD per troy oz). Fetch from metals-api.com inside the scenario, the same way `bulk-calc` does.
- `margins`: array of `{ category, margin_pct }` rows from the `Config_Margins` table.

**Why:** the PWA's "Dual Totals" header (100% melt + offer at margin) computes locally on every cart change. Without spot + margins from `config-load`, the dual totals only become accurate after the first tap of "Calculate Total" — they fall back to the spot returned by the most recent calc. Functional but not "real time as items are added" per the spec.

**How to wire it in Make:**
1. Open `config-load`.
2. Add an HTTP module after the Airtable list-fetches that hits metals-api with the same access_key used in `bulk-calc`. Parse out `USDXAU`, `USDXAG`, `USDXPT`.
3. Add an Airtable `Search Records` for `Config_Margins` (active rows).
4. In the JSON-build module (currently produces `{ coin_types: [...], reps: [...] }`), extend it to:
   ```json
   {
     "coin_types": [...],
     "reps": [...],
     "spot": { "gold": <USDXAU>, "silver": <USDXAG>, "platinum": <USDXPT> },
     "margins": [{ "category": "silver", "margin_pct": 0.30 }, ...]
   }
   ```
5. The PWA fields are already typed `optional` — adding them is non-breaking. Test by tapping "Refresh Config" in the app; the dual totals should populate before any Calculate is tapped.

## 3. iPad smoke test (after the above)

After the Airtable + Make changes are in:

1. **Times-face entry path:** In the picker, scroll to "Numismatic / Other". Add e.g. 50 Wheat Pennies. Tap Calculate Total. Expect: the line shows in the bag, the offer total includes `50 × face_value × fixed_multiplier`, melt total is unchanged from before adding (numismatic doesn't contribute to melt).
2. **Numeric keypad:** tap any quantity field on the iPad. Expect: number-only keypad. The standard alphanumeric keyboard must never appear for these inputs.
3. **Dual totals real-time:** add a Roosevelt Dime, then a Morgan Dollar, then a 14K Gold gram. Expect: both "100% Melt" and "Offer at Margin" update on each Add — without tapping Calculate. (This only works once `config-load` returns spot + margins per 2b above.)

## 4. Once verified

- Open a PR from `m1-fixes` → `main`, reference this doc, merge after iPad smoke-test passes.
- Mark the M1 fixes complete in `STATUS.md`.
- Notify the client and trigger the $175 release per the May 2026 scope.
