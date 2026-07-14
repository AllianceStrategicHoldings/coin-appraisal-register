// Accepted/declined deal submission (SOW 2.6 / 2.7 / 2.9).
// The app fires ONE webhook to Make.com, which owns the four-destination
// fan-out (2.10). Offline degradation per 2.14: failed submissions queue in
// localStorage and retry when signal returns.

import { HttpError } from '../api/client'
import type { CartLine } from '../api/types'

const QUEUE_KEY = 'car.dealQueue.v1'

export interface DealSubmission {
  event_type: 'deal_accepted' | 'deal_declined'
  deal_draft_id: string
  submitted_at: string
  customer: {
    name: string
    phone: string
    dob: string
    zip: string
    dl_number: string
    tcpa_opt_in: boolean
  }
  lines: Array<{
    coin_type_id: string
    name: string
    priced_by: CartLine['priced_by']
    quantity: number
    unit_label: string
    grade?: string
    max_payout: number | null
    actual_offer: number | null
  }>
  totals: {
    total_value: number
    total_max_payout: number
    total_actual_offer: number
    total_delta: number
  }
  spot: { gold: number; silver: number; platinum: number } | null
  payment_method?: string
  cash_over_9500_ack?: boolean
  price_lock_24hr?: boolean
  object_keys: {
    intake_lot?: string | null
    dl_photo?: string | null
    acceptance_lot?: string | null
    signature?: string | null
    offer_letter?: string | null
  }
}

export type SubmitResult = 'delivered' | 'queued'

function readQueue(): DealSubmission[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as DealSubmission[]) : []
  } catch {
    return []
  }
}

function writeQueue(queue: DealSubmission[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // storage unavailable — nothing else to do client-side
  }
}

async function post(url: string, payload: DealSubmission): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new HttpError(res.status, `deal submit failed (${res.status})`)
}

/**
 * Submit a deal to the Make.com webhook. Network failures (or an unset URL,
 * while the backend is being wired) queue the payload locally for retry.
 */
export async function submitDeal(payload: DealSubmission): Promise<SubmitResult> {
  const url = import.meta.env.VITE_DEAL_SUBMIT_URL
  if (!url) {
    writeQueue([...readQueue(), payload])
    return 'queued'
  }
  try {
    await post(url, payload)
    return 'delivered'
  } catch {
    writeQueue([...readQueue(), payload])
    return 'queued'
  }
}

/** Retry queued submissions; keeps whatever still fails. Call on app start. */
export async function flushDealQueue(): Promise<{ delivered: number; remaining: number }> {
  const url = import.meta.env.VITE_DEAL_SUBMIT_URL
  const queue = readQueue()
  if (!url || queue.length === 0) return { delivered: 0, remaining: queue.length }
  const still: DealSubmission[] = []
  let delivered = 0
  for (const payload of queue) {
    try {
      await post(url, payload)
      delivered++
    } catch {
      still.push(payload)
    }
  }
  writeQueue(still)
  return { delivered, remaining: still.length }
}

export function queuedDealCount(): number {
  return readQueue().length
}
