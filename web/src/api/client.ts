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
 * Returning-customer lookup by phone + DOB (SOW 2.1) against Customer_Master.
 * Returns null when the lookup backend is not yet configured — callers treat
 * that as "no match" and proceed as a new customer.
 */
export async function lookupCustomer(
  phone: string,
  dob: string,
): Promise<CustomerLookupResponse | null> {
  const url = import.meta.env.VITE_CUSTOMER_LOOKUP_URL
  if (!url) return null
  return postJSON<CustomerLookupResponse>(url, { phone, dob })
}

export async function calculateBulk(
  items: BulkCalcRequestItem[],
): Promise<BulkCalcResponse> {
  const url = import.meta.env.VITE_BULK_CALC_URL
  if (!url) throw new Error('VITE_BULK_CALC_URL is not set')
  return postJSON<BulkCalcResponse>(url, { items })
}
