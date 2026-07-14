// Manager PIN gate for the $9,500 cash hard stop (SOW 2.6 / 3.2).
// Validates against the Make.com PIN-check webhook (Reps_Master). While that
// backend is unwired, DEV builds accept the stub PIN 0000 so the flow can be
// exercised; production builds refuse to proceed without the webhook.

import { useState } from 'react'

interface ManagerPinModalProps {
  title: string
  message: string
  onApproved: () => void
  onCancel: () => void
}

async function validateManagerPin(pin: string): Promise<boolean> {
  const url = import.meta.env.VITE_MANAGER_PIN_CHECK_URL
  if (url) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, tier: 'manager' }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { valid?: boolean }
    return data.valid === true
  }
  // Backend not wired yet: dev-only stub, compiled out of production.
  if (import.meta.env.DEV) return pin === '0000'
  return false
}

export function ManagerPinModal({
  title,
  message,
  onApproved,
  onCancel,
}: ManagerPinModalProps) {
  const [pin, setPin] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDigit(d: string) {
    if (checking) return
    const next = (pin + d).slice(0, 4)
    setPin(next)
    setError(null)
    if (next.length === 4) {
      setChecking(true)
      try {
        const ok = await validateManagerPin(next)
        if (ok) {
          onApproved()
        } else {
          setError('Invalid manager PIN')
          setPin('')
        }
      } catch {
        setError('Could not verify PIN — check connection')
        setPin('')
      } finally {
        setChecking(false)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-red-800 flex flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl mb-4" aria-hidden="true">🛑</div>
      <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
      <p className="text-red-100 max-w-md mb-6">{message}</p>

      <div className="flex gap-3 mb-4" aria-label="PIN entry">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full border-2 border-white ${
              pin.length > i ? 'bg-white' : ''
            }`}
          />
        ))}
      </div>
      {error && (
        <div role="alert" className="text-sm font-semibold text-amber-300 mb-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 w-64">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            onClick={() => void handleDigit(d)}
            disabled={checking}
            className="min-h-14 rounded-md bg-red-900/60 text-white text-xl font-semibold hover:bg-red-900 disabled:opacity-50"
          >
            {d}
          </button>
        ))}
        <button
          onClick={onCancel}
          className="min-h-14 rounded-md text-red-200 text-sm font-medium hover:bg-red-900/40"
        >
          Cancel
        </button>
        <button
          onClick={() => void handleDigit('0')}
          disabled={checking}
          className="min-h-14 rounded-md bg-red-900/60 text-white text-xl font-semibold hover:bg-red-900 disabled:opacity-50"
        >
          0
        </button>
        <button
          onClick={() => {
            setPin('')
            setError(null)
          }}
          disabled={checking}
          className="min-h-14 rounded-md text-red-200 text-sm font-medium hover:bg-red-900/40"
        >
          Clear
        </button>
      </div>
      <div className="mt-6 text-xs text-red-200 uppercase tracking-widest">
        Manager PIN required
      </div>
    </div>
  )
}
