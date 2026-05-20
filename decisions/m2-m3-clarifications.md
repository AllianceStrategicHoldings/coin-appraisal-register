# Clarifying Questions — App Build Final, before SOW pricing

Send this as an email reply before the SOW. Three of the eight will move the price; the rest just lock the build cleanly.

---

**Subject:** Clarifying questions before pricing the revised SOW

Thanks for the consolidated spec — Sections 1–8 read clean. A few questions before I lock the pricing, in order of impact.

**1. Primary database (Sections 2.10 + 2.14).** The spec lists "Primary database" as one of four webhook destinations, and Section 2.14 reads as a deliberate move away from Airtable ("standard data types, no business logic in database formulas, no platform-native automations"). Three possibilities:

- (a) Airtable continues as the operator-facing data store, with Make.com webhooks doing all workflow logic;
- (b) A real database (Postgres / Supabase / similar) replaces Airtable as the system of record;
- (c) Airtable for config tables only, and a separate primary database for `Deal_Log`, `Customer_Master`, `Test_Deal_Log`, override audit, etc.

Each has different architecture and ongoing-cost implications. Please confirm which one you intend.

**2. Manager Dashboard surface (Section 3.4).** Per-rep performance, override audit log, pending-approval queue, and override-code issuance UI — is this a manager-only route inside the existing PWA, or a separate web admin app?

**3. Override code UX (Section 2.13).** When a manager issues a 6-digit override code, does the rep see it on their device (delivered through the same 5-second polling channel as the approval gate in Section 3.3), or does the manager read the code aloud and the rep types it in?

**4. `Customer_Master` fields (Section 2.14).** Keyed on phone + DOB, "stores returning-customer profile data" — please list the exact fields beyond phone + DOB so we can build the table at kickoff.

**5. Cloud storage choice (Section 2.12).** S3 or Cloudflare R2? Either works on our side; we just need one picked so we can wire CORS, bucket policy, and presigned-URL signing once.

**6. "Gross profit" definition in Manager Dashboard (Section 3.4).** Total Actual Offer captured, or Actual Offer minus a configurable cost basis per category? If the latter, where is the cost basis stored — `Config_CoinTypes`, `Config_Margins`, or a separate table?

**7. Returning customer match conflict (Section 2.1).** If phone + DOB matches an existing `Customer_Master` record but other details differ (name spelling, zip), do we update the existing record in place, surface the conflict to the rep, or create a new record?

**8. Offline degradation scope (Section 2.14).** Spec specifies cached spot prices and queued webhook retries. Should photo + PDF uploads to cloud storage also queue when offline, or treat a missing cloud-storage connection as a hard block on deal acceptance?

Once these are settled I will send the itemized SOW with pricing per subsection of Sections 2 and 3, the four-milestone payment structure confirmed, realistic timeline per phase, and acknowledgement of the Section 5 hand-off boundaries.

— Kristof
