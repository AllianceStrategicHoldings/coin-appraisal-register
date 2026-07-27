# Make.com scenarios

Six scenarios connect the PWA to Supabase, R2 and the pricing APIs. All are
live and verified against production as of 2026-07-27.

| Scenario | Blueprint | Purpose |
|---|---|---|
| `config-load.v2` | [config-load.v2.blueprint.json](config-load.v2.blueprint.json) | Coin types, margins, reps, locations+events, live spot; warms `spot_price_cache` |
| `deal-submit` | [deal-submit.blueprint.json](deal-submit.blueprint.json) | Customer upsert → deal insert → line items |
| `cert-lookup` | [cert-lookup.blueprint.json](cert-lookup.blueprint.json) | PCGS cert → CDN Greysheet wholesale → eBay sold comps |
| `manager-pin-check` | [manager-pin-check.blueprint.json](manager-pin-check.blueprint.json) | SHA-256 PIN match against `reps_master` |
| `customer-lookup` | [customer-lookup.blueprint.json](customer-lookup.blueprint.json) | Returning customer by phone + DOB, with prior deals |
| `bulk-calc` (M1) | [bulk-calc.v1.blueprint.json](bulk-calc.v1.blueprint.json) | **Retired.** Airtable-era pricing; no longer called by the app |

Module-by-module spec: [m2-scenarios.md](m2-scenarios.md).

## Importing a blueprint

New scenario → **⋯** → *Import Blueprint* → attach a webhook to module 1 →
replace the `REPLACE_WITH_*` placeholders in the Set-variables module → save →
switch on → put the webhook URL in the matching Vercel `VITE_*` variable.

## Conventions that matter

- **Never build JSON by concatenating Make string literals.** The `""` escape
  is only valid *inside* a string literal; using it in a bare expression broke
  two scenarios in production. Prefer a flat template where every value is a
  plain `{{expression}}`, returning strings, and let the app normalize.
- **Turn on "evaluate all states as errors"** for any module that writes.
  With it off, a rejected insert returns silently and the scenario reports
  success — that hid a bug where every deal saved with zero line items.
- **Make has no trigonometric functions.** Anything needing them (the
  zip-radius haversine) runs in app code instead.

## Still to build

- **2.9 / 2.10** — GHL accepted + declined webhooks, and the four-destination
  fan-out with independent retry. Blocked on the operator's destination URLs,
  which belong in `config_operator`.
- **2.13** — override-code issuance and redemption.
