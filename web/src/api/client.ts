import type {
  BulkCalcRequestItem,
  BulkCalcResponse,
  ConfigLoadResponse,
  CustomerLookupResponse,
} from './types'

export class NetworkError extends Error {
  constructor() {
    super('Network unavailable')
    this.name = 'NetworkError'
  }
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
  } catch {
    throw new NetworkError()
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new HttpError(
      res.status,
      `HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ''}`,
    )
  }
  return (await res.json()) as T
}

export async function loadConfig(): Promise<ConfigLoadResponse> {
  const url = import.meta.env.VITE_CONFIG_LOAD_URL
  if (!url) throw new Error('VITE_CONFIG_LOAD_URL is not set')
  return postJSON<ConfigLoadResponse>(url, {})
}

/**
 * Raw customer-lookup response. All fields are strings and prior deals come
 * back as four parallel comma-joined lists, so the Make webhook body stays a
 * flat template with no conditionals or string concatenation.
 */
export interface RawCustomerLookup {
  found?: string
  id?: string
  name?: string
  zip?: string
  dl_number?: string
  tcpa_opt_in?: string
  deal_numbers?: string
  deal_dates?: string
  deal_totals?: string
  deal_statuses?: string
}

const split = (v: string | undefined): string[] =>
  (v ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '')

export function normalizeCustomerLookup(
  raw: RawCustomerLookup,
): CustomerLookupResponse {
  const matched = (raw.found ?? '0') !== '0' && (raw.name ?? '').trim() !== ''
  if (!matched) return { matched: false }

  const numbers = split(raw.deal_numbers)
  const dates = split(raw.deal_dates)
  const totals = split(raw.deal_totals)
  const statuses = split(raw.deal_statuses)

  return {
    matched: true,
    customer: {
      id: (raw.id ?? '').trim(),
      name: (raw.name ?? '').trim(),
      zip: (raw.zip ?? '').trim() || undefined,
      dl_number: (raw.dl_number ?? '').trim() || undefined,
      tcpa_opt_in: (raw.tcpa_opt_in ?? '').toLowerCase() === 'true',
    },
    prior_deals: numbers.map((deal_number, i) => {
      const total = parseFloat(totals[i] ?? '')
      return {
        deal_number,
        date: dates[i] ? dates[i].slice(0, 10) : undefined,
        total_offer: Number.isFinite(total) ? total : undefined,
        status: statuses[i],
      }
    }),
  }
}

/**
 * Returning-customer lookup by phone alone (2026-08-23 restructure — DOB is
 * no longer collected at intake) against Customer_Master. Returns null when
 * the lookup backend is not yet configured — callers treat that as "no match"
 * and proceed as a new customer.
 */
export async function lookupCustomer(
  phone: string,
): Promise<CustomerLookupResponse | null> {
  const url = import.meta.env.VITE_CUSTOMER_LOOKUP_URL
  if (!url) return null
  return normalizeCustomerLookup(await postJSON<RawCustomerLookup>(url, { phone }))
}

export async function calculateBulk(
  items: BulkCalcRequestItem[],
): Promise<BulkCalcResponse> {
  const url = import.meta.env.VITE_BULK_CALC_URL
  if (!url) throw new Error('VITE_BULK_CALC_URL is not set')
  return postJSON<BulkCalcResponse>(url, { items })
}
