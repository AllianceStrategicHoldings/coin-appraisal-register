# Make.com scenarios

Six scenarios connect the PWA to Supabase, R2 and the pricing APIs. All are
live and verified against production as of 2026-07-27.

| Scenario | Blueprint | Purpose |
|---|---|---|
| `config-load.v2` | [config-load.v2.blueprint.json](config-load.v2.blueprint.json) | Coin types, margins, reps, locations+events, live spot; warms `spot_price_cache` |
| `deal-submit.v2` | [deal-submit.v2.blueprint.json](deal-submit.v2.blueprint.json) | Customer upsert → deal insert → line items → **GHL fan-out with delivery logging (2.9/2.10)** |
| `webhook-retry` | [webhook-retry.blueprint.json](webhook-retry.blueprint.json) | Scheduled (15 min): re-send `failed` webhook deliveries with backoff (2.14) |
| `deal-submit` (v1) | [deal-submit.blueprint.json](deal-submit.blueprint.json) | **Superseded by v2.** Same flow without the fan-out; keep off once v2 is live |
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

## Deploying deal-submit.v2 (replaces deal-submit)

1. Import [deal-submit.v2.blueprint.json](deal-submit.v2.blueprint.json) as a
   NEW scenario. In module 1, attach the **existing** `deal_submit` webhook
   (pick it from the dropdown — do not create a new one; the app's
   `VITE_DEAL_SUBMIT_URL` keeps working unchanged).
2. In module 2 (Set variables), replace `REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY`.
3. Turn the old `deal-submit` scenario **off first**, then turn v2 **on**
   (two scenarios must never share the webhook while both are live).
4. Import [webhook-retry.blueprint.json](webhook-retry.blueprint.json), replace
   the same placeholder in its module 1, and schedule it **every 15 minutes**.
5. Verify: submit a test deal → `deal_log` row + line items as before, plus
   two `webhook_deliveries` rows (`primary_db` delivered, `ghl` delivered)
   and the deal visible in GHL's webhook trigger history.

How the fan-out behaves:
- The GHL destination URL is read from `config_operator` **at run time** —
  the operator can rotate URLs without touching Make.
- The route is skipped cleanly when the URL is NULL (so Zoho / fourth stay
  dormant until configured; adding them later = duplicate the GHL route).
- A non-2xx from GHL marks the delivery `failed` with `next_attempt_at`
  +15 min; `webhook-retry` re-sends with linear backoff (15 min × attempts).
  A hard network error (DNS/timeout) errors the scenario run and leaves the
  row `pending` — visible in Make's error queue, not silently lost.
- The forwarded payload matches the hand-fired samples of 2026-08-17 except:
  `lines[]` is replaced by `line_count` + `items_summary` (Make can't
  re-serialize the raw array in a flat template), and `deal_id` is added.

## Still to build

- **2.13** — override-code issuance and redemption.
