// Customer travel distance (spec 2.11, operator decision 2026-07-21).
//
// customer_zip_radius_miles = how far the customer travelled to reach us:
// measured from the ACTIVE EVENT's venue zip in roadshow mode, otherwise the
// store location's zip. useDeployment resolves which; this computes the miles.
//
// Runs in app code rather than Make because Make's IML has no trigonometric
// functions, and spec 2.14 places calculations in app code rather than
// database formulas. The centroid table is public US Census reference data.

const EARTH_RADIUS_MILES = 3958.8

interface Centroid {
  zip: string
  lat: number
  lng: number
}

export function haversineMiles(a: Centroid, b: Centroid): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.sqrt(h))
}

/**
 * Miles between the customer's zip and the deployment's reference zip.
 * Returns null when either zip is missing or has no centroid — PO-box-only
 * zips are not ZCTAs, and a missing radius must never block a deal.
 */
export async function zipRadiusMiles(
  customerZip: string | null | undefined,
  referenceZip: string | null | undefined,
): Promise<number | null> {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  const a = (customerZip ?? '').trim()
  const b = (referenceZip ?? '').trim()
  if (!url || !key || !/^\d{5}$/.test(a) || !/^\d{5}$/.test(b)) return null
  if (a === b) return 0

  try {
    const res = await fetch(
      `${url}/rest/v1/zip_centroids?zip=in.(${a},${b})&select=zip,lat,lng`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    )
    if (!res.ok) return null
    const rows = (await res.json()) as Centroid[]
    const from = rows.find((r) => r.zip === a)
    const to = rows.find((r) => r.zip === b)
    if (!from || !to) return null
    return Math.round(haversineMiles(from, to) * 10) / 10
  } catch {
    // Offline or unreachable — the deal still goes through without a radius.
    return null
  }
}
