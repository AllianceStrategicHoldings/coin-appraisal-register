// Lookup integrations (spec 2.3).
//
// One Make.com scenario fans out to PCGS (cert authentication), CDN Greysheet
// (wholesale price) and Apify (eBay sold comps) and returns a combined result.
// The app never holds those API keys.
//
// Fallback chain per spec: CDN → Manual_Price_Override → Ask Manager.
// "Empty results valid" for comps — a coin with no recent sales is normal and
// must not read as an error.

import { HttpError, NetworkError } from '../api/client'

export type PriceSource = 'cdn' | 'manual_override' | 'ask_manager'

export interface CertInfo {
  /** false when PCGS has no record of the cert number */
  found: boolean
  pcgs_no?: string
  name?: string
  year?: string
  denomination?: string
  grade?: string
  designation?: string
}

export interface Comps {
  /** true when the comps lookup ran; count 0 with ran=true is a valid result */
  ran: boolean
  count: number
  low?: number
  median?: number
  high?: number
}

export interface LookupResult {
  cert: CertInfo
  /** CDN Greysheet wholesale price; absent when CDN has no price for it */
  cdn_price?: number
  cdn_label?: string
  comps: Comps
}

/**
 * Resolve the fallback chain. Returns which source should price the line and
 * whether the rep must escalate.
 */
export function resolvePriceSource(
  result: LookupResult | null,
  manualOverride: number | null,
): { source: PriceSource; price: number | null } {
  if (result?.cdn_price != null) return { source: 'cdn', price: result.cdn_price }
  if (manualOverride != null) return { source: 'manual_override', price: manualOverride }
  return { source: 'ask_manager', price: null }
}

/** Offer at the configured margin for the category (rep-facing, 2.3). */
export function offerAtMargin(price: number, marginPct: number): number {
  return price * marginPct
}

/**
 * Raw scenario response. Every field is a STRING so the Make webhook body can
 * be a flat template with no conditionals or string concatenation — the
 * fragile part of hand-written IML. Missing values arrive as "".
 */
export interface RawLookupResponse {
  pcgs_message?: string
  pcgs_no?: string
  name?: string
  grade?: string
  cdn_price?: string
  cdn_label?: string
  /** comma-joined sold prices, e.g. "35,77,79,80" */
  comps_prices?: string
}

function num(v: string | undefined): number | undefined {
  if (v == null) return undefined
  const cleaned = v.replace(/[^0-9.]/g, '') // strips thousands separators
  if (cleaned === '') return undefined
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : undefined
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export function normalizeLookup(raw: RawLookupResponse): LookupResult {
  const name = (raw.name ?? '').trim()
  const found = name !== '' && (raw.pcgs_message ?? '').trim() !== 'No data found'

  const prices = (raw.comps_prices ?? '')
    .split(',')
    .map((p) => num(p))
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b)

  return {
    cert: found
      ? {
          found: true,
          pcgs_no: (raw.pcgs_no ?? '').trim() || undefined,
          name,
          grade: (raw.grade ?? '').trim() || undefined,
        }
      : { found: false },
    cdn_price: num(raw.cdn_price),
    cdn_label: (raw.cdn_label ?? '').trim() || undefined,
    comps: {
      ran: prices.length > 0 || found,
      count: prices.length,
      low: prices.length ? prices[0] : undefined,
      median: prices.length ? median(prices) : undefined,
      high: prices.length ? prices[prices.length - 1] : undefined,
    },
  }
}

export async function lookupCert(certNumber: string): Promise<LookupResult> {
  const url = import.meta.env.VITE_LOOKUP_URL
  if (!url) throw new HttpError(503, 'Lookup service is not configured yet')
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cert_number: certNumber }),
    })
  } catch {
    throw new NetworkError()
  }
  if (!res.ok) throw new HttpError(res.status, `Lookup failed (${res.status})`)
  return normalizeLookup((await res.json()) as RawLookupResponse)
}
