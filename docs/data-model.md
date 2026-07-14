# Data Model (Airtable — M1)

> **M2 note (2026-07-14):** the primary database moves to Supabase/Postgres for
> M2 per the confirmed architecture decision. The M2 schema lives in
> [`supabase/`](../supabase/README.md); this document remains the reference for
> the M1 Airtable base until cutover.

All tables live in a single Airtable base. Config tables are admin-editable; transactional tables are written to by Make.

## Config tables (admin-editable)

### `Config_Margins`
One row per category. Engine 1 reads these on every run.

| Field | Type | Notes |
|---|---|---|
| `category` | Single select | `Silver`, `Gold`, `Platinum`, `Collectibles` |
| `margin_pct` | Number (decimal) | e.g. `0.30` for 30% |
| `notes` | Long text | Optional — why the margin is what it is |

Default seed (matches current spreadsheet behavior): all four rows at `0.30`.

### `Config_CoinTypes`
The predefined list staff sees in Engine 1. Seeded from `airtable/seeds/coin_types.csv`. Holds both spot-priceable metal items (`each_metal` / `weight_grams`) and flat-price numismatic items (`times_face`, e.g. antique coins and graded dollars) that are priced off `face_value` × a multiplier rather than live metal spot.

| Field | Type | Notes |
|---|---|---|
| `name` | Single line text | Display name, e.g. `Morgan Silver Dollar` |
| `metal_type` | Single select | `silver`, `gold`, `platinum`, or `numismatic`. `numismatic` items show the grade selector in the picker and are grouped under "Numismatic / Other". |
| `priced_by` | Single select | `each_metal` (per coin, spot), `weight_grams` (per `unit_label` of bulk metal, spot), or `times_face` (flat: `face_value` × grade multiplier, no spot). |
| `oz_metal_per_unit` | Number (decimal, 5dp) | Troy oz of pure metal in one unit. For `each_metal`, "unit" = one coin (e.g., Roosevelt dime = `0.07234`). For `weight_grams`, "unit" = one of `unit_label` (one gram → `14K = 0.01874`; one troy oz → `1.0`). Empty for `times_face`. |
| `face_value` | Number | Informational for spot coins; **used in math for `times_face`** (`offer = quantity × face_value × multiplier`). Empty for bulk metals. |
| `unit_label` | Single line text | UI display + weight-input label: `coin`, `gram`, or `troy oz`. |
| `active` | Checkbox | Lets admin temporarily hide without deleting |
| `fixed_multiplier` | Number | `times_face` fallback multiplier used only when no grade is sent. |
| `mult_circulated` | Number | `times_face` multiplier for grade = circulated. |
| `mult_uncirculated` | Number | `times_face` multiplier for grade = uncirculated. |
| `mult_slabbed` | Number | `times_face` multiplier for grade = slabbed. |

### `Config_Reps`

| Field | Type | Notes |
|---|---|---|
| `name` | Single line text | Displayed in dropdown |
| `active` | Checkbox | |

*(Rep list content TBD — client to provide names.)*

### `Config_PaymentMethods`

| Field | Type | Notes |
|---|---|---|
| `name` | Single line text | e.g. `Cash`, `Check`, `Wire` |
| `active` | Checkbox | |

*(Exact options TBD with client.)*

### `Config_RawCoinOverrides`
Engine 2 fallback for ungraded / raw coins. Also home for flat-price antique coins (e.g. Indian Head Penny, Flying Eagle, Half Cent, 2¢, 3¢, Buffalo Nickel) that don't fit Engine 1's metal-spot math. Seeded in M2.

| Field | Type | Notes |
|---|---|---|
| `coin_name` | Single line text | |
| `override_price` | Currency | What the rep offers for this raw coin |
| `notes` | Long text | |

## Transactional tables (written by Make)

### `Deal_Log`
One row per completed deal.

| Field | Type | Notes |
|---|---|---|
| `deal_id` | Formula / autonumber | e.g. `CAR-0001` (format TBD) |
| `created_at` | Created time | |
| `rep` | Link → `Config_Reps` | |
| `customer_name` | Single line text | |
| `customer_dl` | Attachment | **Hard block: required** |
| `spot_gold` | Number | Spot at time of deal |
| `spot_silver` | Number | |
| `spot_platinum` | Number | |
| `total_offer` | Currency | |
| `offer_accepted` | Checkbox | |
| `payment_method` | Link → `Config_PaymentMethods` | |
| `cash_received` | Currency | |
| `line_items` | Link → `Deal_LineItems` | |

### `Deal_LineItems`
One row per item in a deal.

| Field | Type | Notes |
|---|---|---|
| `deal` | Link → `Deal_Log` | |
| `source_engine` | Single select | `bulk`, `graded`, `collectible`, `raw` |
| `coin_type` | Link → `Config_CoinTypes` | Nullable (graded/collectibles don't use it) |
| `description` | Single line text | For graded/collectible items (cert#, item name) |
| `quantity` | Number | |
| `unit_value` | Currency | Offer per unit |
| `line_total` | Formula | `quantity × unit_value` |

## Engine 1 pricing math

Make's `bulk-calc` scenario applies one of three formulas per line, switched on `priced_by`:

```
each_metal:    line_total = quantity     × oz_metal_per_unit × spot(metal_type) × margin_pct(category)
weight_grams:  line_total = weight_grams × oz_metal_per_unit × spot(metal_type) × margin_pct(category)
times_face:    line_total = quantity     × face_value        × mult(grade)
```

- `oz_metal_per_unit` is troy oz of pure metal in one unit (one coin for `each_metal`, one `unit_label` for `weight_grams` — one gram, or one troy oz when `oz_metal_per_unit = 1.0`).
- `mult(grade)` selects `mult_circulated` / `mult_uncirculated` / `mult_slabbed` by the grade the PWA sends, falling back to `fixed_multiplier` when no grade is present. `times_face` lines ignore spot and margin (the multiplier is the all-in buy multiple). See [`m1-grading-make-update.md`](m1-grading-make-update.md).
- `spot(metal_type)` is fetched from metals-api.com on every webhook hit — no caching inside Make. Read `rates.USDXAU` / `USDXAG` / `USDXPT` directly (USD per troy ounce); the response also includes inverse rates which we don't use.
- `margin_pct(category)` is the **all-in payout ratio** (e.g., `0.30` = "we pay 30% of melt"). The wholesale-discount factor that legacy applied separately is folded in here, so admin tunes a single number per category. To exactly match legacy economics, set `margin_pct ≈ 0.263` (legacy 30% × 0.877 wholesale).
- Flat-price numismatic items (antique coins, graded Morgan/Peace dollars, etc.) live in `Config_CoinTypes` with `priced_by = times_face` and `metal_type = numismatic`, priced off the grade multipliers above rather than metal spot.

> **Why the rewrite:** The legacy spreadsheet stored hardcoded "times face" multipliers (e.g., `48.2482` for any 90% silver coin) that baked spot × silver content × wholesale factor into one number. Staff had to manually re-edit these every time spot moved — and frequently didn't. We replace that by storing only the invariant (`oz_metal_per_unit`), reading spot live from metals-api.com, and computing fresh on every webhook hit.
