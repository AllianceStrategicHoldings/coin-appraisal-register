// Load US zip centroids (Census ZCTA gazetteer) into supabase zip_centroids.
// Reference data for the customer_zip_radius_miles computation in the Make
// deal-submit scenario (distance from active location / event venue zip).
//
// Usage:
//   1. Download + unzip:
//      https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_zcta_national.zip
//   2. node infra/zips/load-zip-centroids.mjs <path-to-2024_Gaz_zcta_national.txt>
//      (reads SUPABASE_PROJECT_REF + SUPABASE_SERVICE_ROLE_KEY from ../.env)

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const txtPath = process.argv[2]
if (!txtPath) {
  console.error('usage: node load-zip-centroids.mjs <gazetteer.txt>')
  process.exit(1)
}

const envPath = join(dirname(fileURLToPath(import.meta.url)), '../../.env')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const BASE = `https://${env.SUPABASE_PROJECT_REF}.supabase.co/rest/v1`
const HEADERS = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates',
}

const lines = readFileSync(txtPath, 'utf8').split('\n').slice(1)
const rows = []
for (const line of lines) {
  const cols = line.split('\t')
  if (cols.length < 7) continue
  const zip = cols[0].trim()
  const lat = parseFloat(cols[5])
  const lng = parseFloat(cols[6])
  if (/^\d{5}$/.test(zip) && Number.isFinite(lat) && Number.isFinite(lng)) {
    rows.push({ zip, lat, lng })
  }
}
console.log(`parsed ${rows.length} centroids`)

const BATCH = 2000
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH)
  const res = await fetch(`${BASE}/zip_centroids?on_conflict=zip`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(batch),
  })
  if (!res.ok) {
    console.error(`batch ${i}: HTTP ${res.status}`, (await res.text()).slice(0, 300))
    process.exit(1)
  }
  process.stdout.write(`\rloaded ${Math.min(i + BATCH, rows.length)}/${rows.length}`)
}
console.log('\ndone')
