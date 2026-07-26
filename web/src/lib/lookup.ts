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
  return (await res.json()) as LookupResult
}
