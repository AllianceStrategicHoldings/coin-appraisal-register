# Next Make session — two jobs (~15 min)

## Job 1 · Add locations + events to `config-load.v2` (1 module + 1 edit)

2.11 needs the app to know its locations and roadshow events. One PostgREST
call returns both (events embed under their location).

**a. Add an HTTP module** after module 5 (the reps request), same headers as
the other Supabase modules (`apikey` and `Authorization: Bearer …` using the
service key variable). Method GET, URL:

```
https://jsklabrbirsidlnxpgmw.supabase.co/rest/v1/config_locations?active=is.true&order=name&select=id,name,zip,branding_app_name,config_events(id,name,start_date,end_date,venue_zip,active)
```

Set **Parse response = NO** (like modules 3–5), so the raw JSON drops straight
into the reply.

**b. Edit the Webhook Response** (last module) — add one key. If the new
module is id 9, the body becomes:

```
{"coin_types": {{3.data}}, "margins": {{4.data}}, "reps": {{5.data}}, "locations": {{9.data}}, "spot": {"gold": {{6.data.rates.USDXAU}}, "silver": {{6.data.rates.USDXAG}}, "platinum": {{6.data.rates.USDXPT}}}}
```

(Use whatever id Make assigns the new module in place of `9`.)

Save. The app already handles `locations` being absent, so nothing breaks
before this is done — the location picker just stays empty.

## Job 2 · Import `deal-submit`

1. New scenario → **Import Blueprint** → `make/deal-submit.blueprint.json`
2. Module 1: attach a new webhook, name it `deal_submit`, copy the URL
3. Module 2: replace `REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY` with the
   service role key (in `.env` as `SUPABASE_SERVICE_ROLE_KEY`)
4. Save, turn the scenario **ON**
5. Put the webhook URL in Vercel as `VITE_DEAL_SUBMIT_URL`, redeploy
6. Send me the URL — I'll fire a real accepted and declined deal at it and
   confirm the rows land, then clean them up

### What it does
webhook → customer upsert (phone+dob) → deal insert → iterate lines → line
item insert → respond `{ok, deal_number, deal_id}`.

### Deliberately NOT in this blueprint yet
- **Webhook fan-out (2.10)** — GHL / Zoho / 4th destination URLs don't exist
  yet (Section 6 kickoff data). Add once `config_operator` has them.
- **Zip radius (5b)** — needs two `zip_centroids` lookups + a haversine step;
  spec'd in `m2-scenarios.md`. The app already sends `reference_zip` so the
  scenario only has to look up two centroids and PATCH the deal.

### Verification already done
Both the accepted and declined body templates were rendered and POSTed to the
live database: correct `accepted`/`declined_at`, payment method, price lock,
Pre-1933 ack, competitor amount, location + event scoping, and 2 line items
each (including a manual paper-money line). Test rows removed.
