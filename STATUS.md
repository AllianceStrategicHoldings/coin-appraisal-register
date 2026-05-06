# M1 Build Status

Last updated: **2026-05-06** (mid-session: 3a done & verified, 3b in progress on the JSON Create margins mapper).

This is the orientation doc for the Coin Appraisal Register build. If you're picking up this project on a new machine, **read this first**.

## Resume here (2026-05-06 — mid-3b)

The original M1 build was delivered on 2026-04-28 and is still live at https://coin-appraisal-register.vercel.app. On 2026-05-05 the client returned with a **dramatically expanded scope** ([App_Build_Scope.pdf](App_Build_Scope.pdf)) and **three M1 fixes** required before they release the original $175 and fund M2.

**Where things stand:**

| Item | Status |
|---|---|
| **PWA side of all 3 M1 fixes** | ✅ Merged to `main` and auto-deployed (commits `832fb2c` → `0cb9753`). Includes a "Last calculated total" badge that shows the authoritative server-computed total whenever Calculate succeeds. |
| **Airtable changes (step 2)** | ✅ `fixed_multiplier` column added; `times_face` and `numismatic` added to single-select options; numismatic rows added (face_value / fixed_multiplier values still need to be populated by the client per scope). |
| **Make `bulk-calc` (step 3a)** | ✅ Done and verified end-to-end. The `if(priced_by = "times_face", ...)` wrappers around the four formulas in Module 6 work correctly with placeholder values; verified the math returns the expected number for a Wheat Penny test. |
| **Make `config-load` (step 3b)** | ⏳ **In progress.** New HTTP module (spot fetch) + Margins Search Records + Margins Aggregator added. Currently stuck on the JSON Create module: the **Margins** field still has its Map toggle off, showing the manual "Item 1 / Add item" form. **Next action: turn the Map toggle ON for Margins (just like Coin types and Reps), then drop in the Margins Aggregator's `array` output.** |
| **Browser smoke test (step 4)** | ⏳ Pending — do after 3b completes. |
| **iPad smoke test (step 5)** | ⏳ Pending — also depends on 4G iPad availability ([docs/4G-ipad-smoke-test.md](docs/4G-ipad-smoke-test.md)). |
| **M2 + M3 expanded-scope quote** | ✅ Drafted at [decisions/m2-m3-quote.pdf](decisions/m2-m3-quote.pdf). **Not yet sent to client.** Quote: **M2 $7,500 + M3 protection layer $3,500** (M3 PWA stays at the contracted $350). |

**Next action when you sit back down:**

1. `git pull` on `main`.
2. Open the `config-load` scenario in Make. In the JSON Create module, **toggle Map ON for the Margins field** and pick the Margins Aggregator's `array` output. Save.
3. Run the scenario once. Verify the response now includes `coin_types[]` (with `fixed_multiplier` + `oz_metal_per_unit`), `reps[]`, `spot: { gold, silver, platinum }`, and `margins: [{ category, margin_pct }]` with **lowercase categories** (the Margins Aggregator uses `lower()` to normalize).
4. Open https://coin-appraisal-register.vercel.app, tap **Refresh Config**, add a coin. The dual-totals header at the top should populate **without** tapping Calculate.
5. iPad smoke test ([docs/4G-ipad-smoke-test.md](docs/4G-ipad-smoke-test.md)) once iPad is in hand.
6. Notify client; send M2/M3 quote ([decisions/m2-m3-quote.pdf](decisions/m2-m3-quote.pdf)); collect answers to the four open decisions below before starting M2.

**Notes from today's working session:**

- Make's String comparisons are case-sensitive — `priced_by = "times_face"` only matches lowercase. Adopted the convention of using lowercase for all single-select values where Make formulas compare them.
- The Airtable `Config_Margins.category` column has values like `Silver` / `Gold` / `Platinum` (capitalized), but the PWA's `metal_type` is lowercase. Solution baked into the Margins Aggregator: `category` → `{{lower(<MarginsSearch>.category)}}` so the PWA can match on lowercase.
- Module 4 in `bulk-calc` (and Module 2 in `config-load`) caches the Airtable schema. After adding a column in Airtable, **re-select the table in the module dropdown and save** to force Make to refresh the schema; the new field then appears in downstream pickers.
- The committed `make/bulk-calc.v1.blueprint.json` is now stale relative to the live scenario (it lacks the `times_face` formula wrappers). Re-export and overwrite when convenient — make sure to scrub the metals-api `access_key` back to `REPLACE_WITH_METALS_API_KEY` before committing.

**Open client decisions before M2 starts** (full reasoning in the quote PDF):

- DL camera capture: paid SDK ($200–$2K/mo) vs. photo + manual DL number entry?
- SSN/EIN storage: Airtable encryption-at-rest accepted, or scope a separate vault?
- Texas 48-hour LE report: PDF email accepted, or specific format required?
- PCGS CoinFacts + CDN Greysheet + GoldAPI + Apify (paid, 50/day) — all four credentials must be live in Make.com before M2 begins.

**Open client decisions before M2 starts** (full reasoning in the quote PDF):

- DL camera capture: paid SDK ($200–$2K/mo) vs. photo + manual DL number entry?
- SSN/EIN storage: Airtable encryption-at-rest accepted, or scope a separate vault?
- Texas 48-hour LE report: PDF email accepted, or specific format required?
- PCGS CoinFacts + CDN Greysheet + GoldAPI + Apify (paid, 50/day) — all four credentials must be live in Make.com before M2 begins.

---

_The sections below describe the original M1 build that's already delivered and still live. Use them as reference; the active work is in the "Resume here" section above._

## What M1 is

A floor-staff iPad app for live coin/bullion pricing:
- Rep picks themselves from a dropdown
- Adds line items: silver coins by count, bullion by gram weight
- Sees a live total computed from current spot prices and per-category margins from Airtable

Stack: **Airtable** (config + future deal log), **Make.com** (workflow + external API access), **Custom PWA** (React + Vite + Tailwind, deployed on Vercel, installs to iPad home screen). External data: **metals-api.com** for spot prices.

Full architecture in [docs/architecture.md](docs/architecture.md). Pricing math in [docs/data-model.md](docs/data-model.md). PWA build plan in [docs/pwa-build-plan.md](docs/pwa-build-plan.md).

## Platform decision (2026-04-28) — Option C confirmed

The client reviewed [decisions/platform-decision.pdf](decisions/platform-decision.pdf) and chose **Option C — Custom-built PWA**. Frontend is now React + Vite + Tailwind, deployed on Vercel free tier.

Rationale: zero recurring cost, full UX control, no platform metering, durable through M2+. Trade-off accepted: client cannot self-edit screens; changes route through dev. The Make scenarios and Airtable schema are unaffected — they were designed platform-agnostic and remain valid.

The ~1 hour of Glide work from Phase 3A/3B is discarded. The Glide app itself can be deleted from the client's workspace once we confirm the PWA covers the same ground.

## Where we are

| Phase | Status | What it produced |
|---|---|---|
| **1 — Airtable base** | ✅ done | `Config_Margins` (4 rows), `Config_CoinTypes` (24 rows), `Config_Reps` (Adam, Amy, John). Import order: [airtable/schema.md](airtable/schema.md). |
| **2 — Make `bulk-calc` scenario** | ✅ done | Tested, active. Working blueprint committed: [make/bulk-calc.v1.blueprint.json](make/bulk-calc.v1.blueprint.json). |
| **2.5 — Make `config-load` scenario** | ✅ done | Imported, tested, active. Webhook URL saved externally by builder (not in repo). |
| **3 — Glide app** | 🗑️ abandoned | Path 2 architecture broke on Glide Explorer constraints. Glide app (skeleton only) can be deleted from client workspace. |
| **4A — PWA scaffold** | ✅ done | Vite + React + TS + Tailwind in `/web`, PWA plugin wired, env vars for both webhooks. (commit `efcf4ad`) |
| **4B — API client + cart state** | ✅ done | Typed wrappers + `useConfig` / `useCart` / `useSession` hooks; localStorage persistence. (commit `0e781bd`) |
| **4C — Calculator screen** | ✅ done | Rep dropdown, cart list, total, Calculate / New Bag / Refresh Config + rep-change auto-clear. (commit `fed29b6`) |
| **4D — Add Coin form** | ✅ done | Bottom-sheet modal, picker grouped by metal, conditional qty/grams input. (commit `901fe0c`) |
| **4E — PWA polish** | ✅ done | Manifest + icons + iOS meta tags, tap targets ≥44px, NetworkOnly SW for webhooks, network-vs-HTTP error copy, safe-area inset support. (commit `d366adc`) |
| **4F.1 — Staging deploy** | ✅ done | Live at https://coin-appraisal-register.vercel.app under dev's Vercel; auto-deploys from `main`. Manifest + SW verified in Chrome DevTools. |
| **4F.2 — Transfer to client** | ⏳ blocked | Awaiting client GitHub + Vercel access. ~30 min once unblocked: transfer repo, fresh Vercel project under client account, re-install on iPads. See [docs/pwa-build-plan.md](docs/pwa-build-plan.md) §4F.2. |
| **4G — iPad install + smoke test** | ⏳ blocked | Awaiting iPad hardware. Checklist ready in [docs/4G-ipad-smoke-test.md](docs/4G-ipad-smoke-test.md) — run through it once an iPad is on hand. |
| **4H — Sign-off** | ⏳ blocked | Depends on 4G passing + branding assets landing (logo, accent color, app name). Checklist in [docs/pwa-build-plan.md](docs/pwa-build-plan.md) §4H. |

The PWA build is functionally complete. Remaining phases are hardware-/client-gated, not code-gated.

## Files in this repo

```
README.md                              project overview
STATUS.md                              this file
CLAUDE.md                              (parent dir) project-level instructions for Claude
docs/
  architecture.md                      system flow + key principles
  data-model.md                        Airtable schema + Engine 1 pricing math
  api-integrations.md                  metals-api spec + webhook contracts (bulk-calc, config-load)
  pwa-build-plan.md                    Phase 4 build steps + stack rationale (THIS IS THE BUILD GUIDE)
airtable/
  schema.md                            table import order + seed notes
  seeds/
    margins.csv                        Config_Margins seed (4 rows)
    coin_types.csv                     Config_CoinTypes seed (24 rows)
make/
  README.md                            Make scenario index + naming convention
  bulk-calc.v1.blueprint.json          working bulk-calc scenario (Phase 2)
  config-load.v1.blueprint.json        config-load scenario (Phase 2.5)
decisions/
  platform-decision.html               client-facing platform options doc (HTML source)
  platform-decision.pdf                client-facing platform options doc (PDF, sent to client)
glide/
  screens.md                           ⚠️ ARCHIVED — kept for historical reference; do not follow
web/                                   (created in Phase 4A) custom PWA source
```

## Things you need available that aren't in this repo

The repo holds specs, blueprints, and (once 4A starts) PWA source. These live elsewhere:

| Thing | Where it lives | When you need it |
|---|---|---|
| `bulk-calc` webhook URL | Make → bulk-calc scenario → click webhook module | Phase 4A, set as env var `VITE_BULK_CALC_URL` |
| `config-load` webhook URL | Make → config-load scenario → click webhook module | Phase 4A, set as env var `VITE_CONFIG_LOAD_URL` |
| Airtable PAT | The one you created during the 403 fix; already in Make's `client-airtable` connection | Already in use; only needed if re-creating the Make connection |
| metals-api.com access_key | Already in Make's HTTP module URL in `bulk-calc` | Already in use; the committed blueprint has it as `REPLACE_WITH_METALS_API_KEY` placeholder |
| Dev's GitHub account | Free, used during build for backup + WIP | Phase 4A onward (push early as backup) |
| Dev's Vercel account | Free tier, GitHub-linked | Phase 4F.1 (staging deploy for client preview + iPad smoke testing) |
| Client's GitHub access | Client to grant when ready | Phase 4F.2 (transfer of repo) |
| Client's Vercel access | Client to grant when ready | Phase 4F.2 (production deploy under their account) |

## Things blocking the work

| Blocker | Owner | Notes |
|---|---|---|
| **Margin confirmation** | Client | Seeded at 0.30 across silver/gold/platinum. Legacy effective rate was ~0.263. Worth confirming before staff use it on the floor. |
| **Branding** | Client | App name, square logo (PNG ≥ 512×512), accent color. Not blocking — 4E ships with placeholder icon, real assets land via follow-up PR. Blocking 4H sign-off only. |
| **Client GitHub + Vercel access** | Client | Not blocking 4A–4E (build proceeds under dev's accounts). Blocks 4F.2 (production transfer) only. |

Resolved on 2026-04-28: iPad usage model — works for both rep-assigned and shared iPads via auto-clear-on-rep-change. Cart wipes whenever the rep dropdown changes from one non-null value to a different non-null value. No confirmation dialog. See architectural decision #6 in [docs/pwa-build-plan.md](docs/pwa-build-plan.md).

Resolved on 2026-04-28: rep names landed in `Config_Reps` — Adam, Amy, John. Dropdown will populate from `config-load` on app launch.

## Build notes from prior sessions (still relevant)

- **Make Module 6 (`json:CreateJSON`) imports with `type: null`.** Data structures don't carry across accounts. Fix on import: open Module 6 → Data structure → **Add** → **Generator** tab → paste a sample of the response JSON → Save. Once the structure exists, the `coin_types` and `reps` mappings re-appear. (Only matters if rebuilding Make scenarios from blueprint.)
- **Empty Airtable rows leak into the `reps` array** as `[{"id": null, "name": null}]` even with `{active} = TRUE()` filter. Fix: delete all default placeholder rows from `Config_Reps` in Airtable; the filter alone isn't enough.

## Glide-specific notes (no longer applicable, kept for context)

The earlier Glide build surfaced lessons that no longer affect this build (Row Owners, Big Tables, Call API tier-gating, updates metering). Those are documented in the prior STATUS history (`git log STATUS.md`) and in the platform decision PDF — no need to read them for the PWA work.

## Next action

**For the human:** confirm the open items in "Things blocking the work" — particularly the GitHub remote question — then kick off Phase 4A.

**For a future Claude session:** read [docs/pwa-build-plan.md](docs/pwa-build-plan.md). That's the active build guide. Start at whichever phase is marked ⏳ next in the table above.
