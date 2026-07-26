// Deal-frozen state while a manager request is outstanding (spec 2.8).
// The deal cannot continue until a manager resumes it with their PIN. The
// 5-second polling / 15-minute timeout behaviour is the M3 approval gate
// (3.3) and layers on top of this.

import { useEffect, useState } from 'react'
import { ManagerPinModal } from './ManagerPinModal'

export interface PendingRequest {
  trigger: 'ask_manager' | 'not_sure_what_this_is'
  note: string
  itemDescription: string
  requestedAt: string
  delivery: 'sent' | 'queued'
}

interface PendingApprovalOverlayProps {
  request: PendingRequest
  onResumed: () => void
}

function elapsed(sinceIso: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - new Date(sinceIso).getTime()) / 1000))
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function PendingApprovalOverlay({
  request,
  onResumed,
}: PendingApprovalOverlayProps) {
  const [showPin, setShowPin] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (showPin) {
    return (
      <ManagerPinModal
        title="Resume Deal"
        message="Enter a manager PIN to release this deal and continue."
        onApproved={onResumed}
        onCancel={() => setShowPin(false)}
      />
    )
  }

  const isNotSure = request.trigger === 'not_sure_what_this_is'

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-amber-600 px-8 text-center">
      <div className="text-6xl mb-5" aria-hidden="true">⏸️</div>
      <h1 className="text-3xl font-bold text-white mb-2">Waiting for a Manager</h1>
      <p className="text-amber-50 mb-1">
        {isNotSure
          ? 'An item has been sent to a manager to identify.'
          : 'A manager has been asked to help with this deal.'}
      </p>
      <p className="text-amber-100 text-sm mb-6">
        Requested {elapsed(request.requestedAt, now)} ago
        {request.delivery === 'queued' && ' · will send when signal returns'}
      </p>

      {(request.note || request.itemDescription) && (
        <div className="bg-amber-700/40 rounded-lg px-5 py-3 max-w-md w-full text-left mb-8">
          {request.itemDescription && (
            <div className="text-sm text-white mb-1">
              <span className="text-amber-200">Item: </span>
              {request.itemDescription}
            </div>
          )}
          {request.note && (
            <div className="text-sm text-white">
              <span className="text-amber-200">Note: </span>
              {request.note}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowPin(true)}
        className="min-h-12 px-8 rounded-md bg-white text-amber-700 text-base font-semibold hover:bg-amber-50"
      >
        Manager — Resume Deal
      </button>
      <p className="mt-8 text-xs text-amber-100 uppercase tracking-widest">
        Deal is paused
      </p>
    </div>
  )
}
