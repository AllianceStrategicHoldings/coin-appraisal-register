// Pre-1933 US Gold full-screen red hard stop (spec 2.2, trigger 1 of 3.2).
// Cannot be skipped or back-buttoned: the only ways out are a manager PIN
// (which records a timestamped acknowledgment on the deal record) or backing
// the item out entirely.

import { useState } from 'react'
import { ManagerPinModal } from './ManagerPinModal'

interface Pre1933GoldStopProps {
  itemName: string
  /** called with the acknowledgment timestamp once a manager PIN clears it */
  onAcknowledged: (at: string) => void
  onCancel: () => void
}

export function Pre1933GoldStop({
  itemName,
  onAcknowledged,
  onCancel,
}: Pre1933GoldStopProps) {
  const [showPin, setShowPin] = useState(false)

  if (showPin) {
    return (
      <ManagerPinModal
        title="Manager Approval Required"
        message={`Pre-1933 US Gold (${itemName}) requires a manager to review this item before it can be added to the deal.`}
        onApproved={() => onAcknowledged(new Date().toISOString())}
        onCancel={() => setShowPin(false)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-red-700 px-8 text-center">
      <div className="text-6xl mb-5" aria-hidden="true">🛑</div>
      <h1 className="text-3xl font-bold text-white mb-3">Stop — Pre-1933 US Gold</h1>
      <p className="text-lg text-white mb-2">{itemName}</p>
      <p className="text-red-100 max-w-lg mb-8">
        Pre-1933 US gold coins carry numismatic value well above melt and are
        frequently counterfeited. Do not price this item from the calculator.
        A manager must review it before it can be added to the deal.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={() => setShowPin(true)}
          className="min-h-12 rounded-md bg-white text-red-700 text-base font-semibold hover:bg-red-50"
        >
          Manager Override
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-12 rounded-md border-2 border-red-300 text-white text-base font-medium hover:bg-red-800"
        >
          Remove this item
        </button>
      </div>
      <p className="mt-8 text-xs text-red-200 uppercase tracking-widest">
        This stop cannot be skipped
      </p>
    </div>
  )
}
