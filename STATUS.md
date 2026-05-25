# M1 Build Status

Last updated: **2026-05-25** — M1 complete against `App Build Final.pdf` §1; iPad smoke test passed; awaiting client acceptance to release $175 and unblock M2 + M3 kickoff payment.

This is the orientation doc for the Coin Appraisal Register build. If you're picking up this project on a new machine, **read this first**.

## Resume here (2026-05-25 — M1 sign-off ready)

The build is now feature-complete against Section 1 of the client's authoritative spec, [App Build Final.pdf](App%20Build%20Final.pdf) (received 2026-05-20). The four §1 deliverables — bulk calculator, numismatic grading selector, custom numeric keypad, always-on Total Value / Total Offer — are live at https://coin-appraisal-register.vercel.app and verified on iPad Safari. M1 acceptance triggers the held $175 and unblocks the M2 + M3 kickoff payment (20% per [decisions/m2-m3-sow.pdf](decisions/m2-m3-sow.pdf)).

**Where things stand:**

| Item | Status |
|---|---|
| **§1 deliverable 1 — Bulk calculator** | ✅ Live. All `Config_CoinTypes` rows price correctly on iPad. |
| **§1 deliverable 2 — Numismatic grading selector** | ✅ Live. Three new columns on `Config_CoinTypes` (`mult_circulated`, `mult_uncirculated`, `mult_slabbed`); PWA shows a required Circulated/Uncirculated/Slabbed selector for numismatic items; Make `bulk-calc` switches on `grade` per item. Procedure documented at [docs/m1-grading-make-update.md](docs/m1-grading-make-update.md). |
| **§1 deliverable 3 — Custom numeric keypad** | ✅ Live. `NumericKeypad` + `KeypadField` components replace native iOS keyboard on every quantity / weight input. Decimal (conditional), backspace, Clear, tap-outside dismiss, plus hardware keyboard bindings. |
| **§1 deliverable 4 — Total Value + Total Offer always visible** | ✅ Live. Block no longer hides when bag is empty; labels match spec wording. |
| **iPad Safari smoke test** | ✅ Passed (2026-05-25). |
| **Make `bulk-calc` scenario** | ✅ Updated for grade switch; verified `grade=Uncirculated` with empty Airtable column returns $0 (proves switch is reading, not fallthrough). Committed blueprint at [make/bulk-calc.v1.blueprint.json](make/bulk-calc.v1.blueprint.json) mirrors live (manually edited to reflect grade changes; next true Make re-export is the authoritative form). |
| **Make `config-load` scenario (legacy 3b)** | ⏳ Still parked mid-build (Margins field's Map toggle off in the JSON Create module). Does not block M1 acceptance — live `Total Value` shows "—" until first Calculate, then populates from spot returned by `bulk-calc`. Pick this up when convenient. |
| **M1 sign-off handover doc** | ✅ [decisions/m1-signoff-handover.pdf](decisions/m1-signoff-handover.pdf) ([html](decisions/m1-signoff-handover.html)) — ready to send to Keyshaun. Proposes 2026-05-30 as the target acceptance date. |
| **M2 + M3 expanded-scope quote** | ✅ Drafted at [decisions/m2-m3-sow.pdf](decisions/m2-m3-sow.pdf). **Not yet sent to client.** $10,600 new commitment (M2 $8,050 + M3 protection $2,550). Clarifying questions at [decisions/m2-m3-clarifications.md](decisions/m2-m3-clarifications.md) — send these first, then SOW. |

**Next action when you sit back down:**

1. Send [decisions/m1-signoff-handover.pdf](decisions/m1-signoff-handover.pdf) to Keyshaun and ask them to confirm acceptance by the proposed date.
2. Independently, send [decisions/m2-m3-clarifications.md](decisions/m2-m3-clarifications.md) so answers are in flight while M1 acceptance lands.
3. Once M1 accepted: collect $175, then send [decisions/m2-m3-sow.pdf](decisions/m2-m3-sow.pdf) with confirmation that the four pre-kickoff items from §6 of the spec are met (paid PCGS / CDN Greysheet / Metals-API / Apify access, S3 or R2 bucket, photo + manual DL number capture path).
4. (Optional) Reclassify `Costume Jewelry` in `Config_CoinTypes` off `times_face` — it has no face value so the grading model doesn't fit. Flagged in the handover doc; belongs in M2's broader item-entry scope.
5. (Optional) Resume `config-load` 3b so the live totals populate without requiring a Calculate round-trip.
6. (Optional) Replace the sample multiplier values I seeded in the ten numismatic rows of `Config_CoinTypes` with authoritative pricing before reps use the app on the floor. Values listed in the handover doc.

**Working notes (still relevant):**

- Make's String comparisons are case-sensitive — `priced_by = "times_face"` only matches lowercase. Same convention applies to `grade` values (`circulated` / `uncirculated` / `slabbed`).
- `Config_Margins.category` column values are capitalized (`Silver` / `Gold` / `Platinum`), but the PWA's `metal_type` is lowercase. The Margins Aggregator in `config-load` normalizes via `lower()` — keep this if you finish 3b.
- Module 4 in `bulk-calc` (and Module 2 in `config-load`) caches the Airtable schema. After adding a column, **re-select the table in the module dropdown and save** to refresh.
- For webhook data structure updates (Module 1 in `bulk-calc`), edit the data structure directly via the pencil icon next to the Data structure dropdown — adding a field to the `items` array makes it available on the Iterator (Module 3) downstream.
- The Make formula in Module 6 uses `switch(3.grade; "circulated"; 4.mult_circulated; "uncirculated"; 4.mult_uncirculated; "slabbed"; 4.mult_slabbed; 4.fixed_multiplier)`. The trailing `4.fixed_multiplier` is the default — fires only when no grade is sent (legacy callers). Per-grade values explicitly returned for active grade selections, even when blank (so misconfigured Airtable rows surface as $0 / red instead of silent fallback).
- The PWA's `pricing.ts` mirrors Make's behavior: when grade is set, only the matching per-grade column is used — no fallback to `fixed_multiplier`. A blank column surfaces as a red "Missing pricing data" warning, not a wrong number.

**Open client decisions before M2 starts** (full reasoning in [decisions/m2-m3-sow.pdf](decisions/m2-m3-sow.pdf) and [decisions/m2-m3-clarifications.md](decisions/m2-m3-clarifications.md)):

- Primary database — Airtable continues, or move to Postgres / Supabase?
- DL camera capture: paid SDK vs. photo + manual DL number entry? (Spec §6 confirms photo + manual is in scope; this just needs final client ack.)
- SSN/EIN storage: Airtable encryption-at-rest accepted, or separate vault?
- Texas 48-hour LE report: PDF email accepted, or specific format required?
- Cloud storage choice: S3 vs. Cloudflare R2?
- Manager Dashboard surface: route inside PWA, or separate web admin app?
- Override code UX, returning-customer match conflicts, offline degradation scope — full list in [decisions/m2-m3-clarifications.md](decisions/m2-m3-clarifications.md).
- PCGS CoinFacts + CDN Greysheet + Metals-API + Apify (paid, 50/day) — all four credentials must be live in Make.com before M2 begins.

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
