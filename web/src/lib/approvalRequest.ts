// Manager-required workflow requests (spec 2.8).
// Ask Manager and "Not Sure What This Is" both raise an approval_requests
// row through Make.com. Same offline discipline as deal submission: a failed
// send queues locally and retries, so a dead signal never loses the request
// or traps the rep.

import { HttpError } from '../api/client'

const QUEUE_KEY = 'car.approvalQueue.v1'

export type ApprovalTrigger = 'ask_manager' | 'not_sure_what_this_is'

export interface ApprovalRequestPayload {
  deal_draft_id: string
  trigger_reason: ApprovalTrigger
  requested_at: string
  note?: string
  item_description?: string
  /** R2 object key for the item photo ("Not Sure" flow) */
  item_photo_key?: string | null
  rep_name?: string
  customer_name?: string
}

export type ApprovalResult = 'sent' | 'queued'

function readQueue(): ApprovalRequestPayload[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as ApprovalRequestPayload[]) : []
  } catch {
    return []
  }
}

function writeQueue(q: ApprovalRequestPayload[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch {
    // storage unavailable — nothing else to do client-side
  }
}

async function post(url: string, payload: ApprovalRequestPayload): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new HttpError(res.status, `approval request failed (${res.status})`)
}

export async function submitApprovalRequest(
  payload: ApprovalRequestPayload,
): Promise<ApprovalResult> {
  const url = import.meta.env.VITE_APPROVAL_REQUEST_URL
  if (!url) {
    writeQueue([...readQueue(), payload])
    return 'queued'
  }
  try {
    await post(url, payload)
    return 'sent'
  } catch {
    writeQueue([...readQueue(), payload])
    return 'queued'
  }
}

/** Retry queued requests; keeps whatever still fails. Call on app start. */
export async function flushApprovalQueue(): Promise<{ sent: number; remaining: number }> {
  const url = import.meta.env.VITE_APPROVAL_REQUEST_URL
  const queue = readQueue()
  if (!url || queue.length === 0) return { sent: 0, remaining: queue.length }
  const still: ApprovalRequestPayload[] = []
  let sent = 0
  for (const p of queue) {
    try {
      await post(url, p)
      sent++
    } catch {
      still.push(p)
    }
  }
  writeQueue(still)
  return { sent, remaining: still.length }
}
