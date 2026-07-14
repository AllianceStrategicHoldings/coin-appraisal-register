# Cloudflare R2 — bucket setup spec (SOW 2.12)

All photos (intake lot, DL, item, acceptance lot, signature PNG) and generated
PDFs (signed offer letters) live in one R2 bucket. URLs are written to the
deal record; no platform-native attachment fields.

## Bucket

- **Name:** `coin-appraisal-register`
- **Owner:** operator's Cloudflare account (same account as DNS/Workers)
- **Location:** automatic (R2 default)
- **Public access:** OFF — objects are private; the app and Make.com access
  them via the S3 API / presigned URLs only.

## API token (operator creates in dashboard)

R2 → Manage R2 API Tokens → Create:

- **Permission:** Object Read & Write
- **Scope:** apply to the `coin-appraisal-register` bucket only
- **TTL:** no expiry

The resulting Access Key ID / Secret Access Key go into Vercel env vars
(below) and Make.com — never into frontend code or the repo.

## Object key layout

```
intake-lot/<dealId>/<ts>-<rand>.jpg      one lot photo at intake (2.1)
dl/<dealId>/<ts>-<rand>.jpg              driver's license photo (2.1)
items/<dealId>/<ts>-<rand>.jpg           per-item photos (2.8 "Not Sure", etc.)
acceptance-lot/<dealId>/<ts>-<rand>.jpg  final lot photo at acceptance (2.6)
signatures/<dealId>/<ts>-<rand>.png      customer signature PNG (Section 4)
offer-letters/<dealId>/<ts>-<rand>.pdf   signed offer letter PDF (2.6)
```

Keys are timestamped + random-suffixed so a re-upload never overwrites an
audit artifact.

## CORS

Applied from [`cors.json`](cors.json) — allows the PWA origin (and localhost
dev) to PUT directly against presigned URLs:

```sh
aws s3api put-bucket-cors \
  --bucket coin-appraisal-register \
  --cors-configuration file://infra/r2/cors.json \
  --endpoint-url "$R2_S3_ENDPOINT"
```

(Or paste the JSON into Cloudflare dashboard → bucket → Settings → CORS policy.)

## Signing flow

1. PWA POSTs `{ kind, dealId, contentType }` to `/api/presign`
   ([`web/api/presign.ts`](../../web/api/presign.ts), Vercel Edge Function).
2. Function validates kind/contentType, builds the object key, returns a
   presigned PUT URL valid for 10 minutes.
3. PWA PUTs the file directly to R2 ([`web/src/lib/storage.ts`](../../web/src/lib/storage.ts)),
   retrying transient failures with a fresh URL per attempt.
4. The object key is written to the deal record; Make.com composes access
   URLs when needed (webhook payloads, offer-letter links).

## Vercel env vars (Project → Settings → Environment Variables)

| Var | Value |
|---|---|
| `R2_S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | `coin-appraisal-register` |
| `R2_ACCESS_KEY_ID` | from the bucket-scoped token |
| `R2_SECRET_ACCESS_KEY` | from the bucket-scoped token |

No `VITE_` prefix — these must never be bundled into client JS.
