// Customer intake (SOW 2.1, restructured per operator feedback 2026-08-23).
// Collects name / phone / email / reason / source; only name + reason are
// required to open the calculator. DOB, zip, DL, photos and consent moved to
// the post-agreement step (AcceptanceScreen). Returning customers are looked
// up in Customer_Master by phone alone as soon as 10 digits are entered.

import { useEffect, useRef, useState } from 'react'
import { lookupCustomer } from '../api/client'
import {
  normalizePhone,
  REFERRAL_SOURCES,
  SELLING_REASONS,
  type ReferralSource,
  type SellingReason,
  type UseIntakeResult,
} from '../state/useIntake'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

interface IntakeScreenProps {
  intake: UseIntakeResult
  onOpenCalculator: () => void
}

export function IntakeScreen({ intake, onOpenCalculator }: IntakeScreenProps) {
  const { fields, setField } = intake
  const [lookupState, setLookupState] = useState<'idle' | 'searching' | 'done'>('idle')

  // Returning-customer lookup fires once the phone reaches 10 digits.
  const phoneDigits = normalizePhone(fields.phone)
  const lookupKey = phoneDigits.length >= 10 ? phoneDigits : null
  const lastLookupRef = useRef<string | null>(null)

  useEffect(() => {
    if (!lookupKey || lookupKey === lastLookupRef.current) return
    lastLookupRef.current = lookupKey
    setLookupState('searching')
    lookupCustomer(phoneDigits)
      .then((res) => {
        intake.setLookup(res)
        // Pre-fill from the matched profile anything the rep hasn't typed yet.
        // Zip / DL prefill feeds the post-agreement step.
        if (res?.matched && res.customer) {
          if (!fields.name.trim() && res.customer.name) setField('name', res.customer.name)
          if (!fields.zip.trim() && res.customer.zip) setField('zip', res.customer.zip)
          if (!fields.dlNumber.trim() && res.customer.dl_number)
            setField('dlNumber', res.customer.dl_number)
        }
      })
      .catch(() => intake.setLookup(null)) // lookup failure = treat as new customer
      .finally(() => setLookupState('done'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupKey])

  const match = intake.lookup?.matched ? intake.lookup : null

  return (
    <main
      className="min-h-dvh flex flex-col bg-slate-50 pb-32"
      style={{ overscrollBehavior: 'contain' }}
    >
      <header className="px-4 py-3 bg-white border-b border-slate-200">
        <h1 className="text-lg font-semibold text-slate-900">Customer Intake</h1>
        <p className="text-xs text-slate-500">
          Name and reason for coming in are required; everything else can wait.
        </p>
      </header>

      {match && (
        <section
          className="px-4 py-3 bg-sky-50 border-b border-sky-200"
          aria-label="Returning customer"
        >
          <div className="text-sm font-semibold text-sky-900">
            Returning customer: {match.customer?.name}
          </div>
          {match.prior_deals && match.prior_deals.length > 0 ? (
            <ul className="mt-1 text-xs text-sky-800 space-y-0.5">
              {match.prior_deals.slice(0, 5).map((d, i) => (
                <li key={i}>
                  {d.date ?? '—'} · {d.deal_number ?? 'deal'} ·{' '}
                  {d.total_offer != null ? usd.format(d.total_offer) : '—'}
                  {d.status ? ` · ${d.status}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1 text-xs text-sky-800">No prior deals on file.</div>
          )}
        </section>
      )}
      {lookupState === 'searching' && (
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs text-slate-600">
          Checking for returning customer…
        </div>
      )}

      <section className="flex-1 px-4 py-4 space-y-4 max-w-xl w-full mx-auto">
        <div>
          <label htmlFor="intake-name" className="block text-sm font-medium text-slate-700 mb-1">
            Customer name
          </label>
          <input
            id="intake-name"
            type="text"
            autoComplete="off"
            value={fields.name}
            onChange={(e) => setField('name', e.target.value)}
            className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="intake-phone" className="block text-sm font-medium text-slate-700 mb-1">
              Phone <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="intake-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={fields.phone}
              onChange={(e) => setField('phone', e.target.value)}
              className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
            />
          </div>
          <div>
            <label htmlFor="intake-email" className="block text-sm font-medium text-slate-700 mb-1">
              Email <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="intake-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={fields.email}
              onChange={(e) => setField('email', e.target.value)}
              className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="intake-reason"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Reason for coming in
            </label>
            <select
              id="intake-reason"
              value={fields.sellingReason}
              onChange={(e) =>
                setField('sellingReason', e.target.value as SellingReason | '')
              }
              className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
            >
              <option value="">Select…</option>
              {SELLING_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="intake-referral"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              How did they find us?{' '}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <select
              id="intake-referral"
              value={fields.referralSource}
              onChange={(e) =>
                setField('referralSource', e.target.value as ReferralSource | '')
              }
              className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
            >
              <option value="">Select…</option>
              {REFERRAL_SOURCES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-start gap-3 py-1 cursor-pointer">
          <input
            type="checkbox"
            checked={fields.tcpaOptIn}
            onChange={(e) => setField('tcpaOptIn', e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">
            Customer consents to receive calls/texts about this transaction and
            future offers (TCPA). Required to proceed.
          </span>
        </label>

        <p className="text-xs text-slate-500">
          Date of birth, ID photo and lot photo are collected after the customer
          agrees to a deal.
        </p>
      </section>

      <div
        className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {!intake.isComplete && (
          <div className="px-4 pt-2 text-xs text-slate-500">
            Missing: {intake.missing.join(', ')}
          </div>
        )}
        <div className="px-4 pb-3 pt-2 flex gap-2">
          <button
            onClick={onOpenCalculator}
            disabled={!intake.isComplete}
            className="flex-1 min-h-12 py-3 rounded-md bg-emerald-600 text-white text-base font-semibold disabled:bg-slate-300 disabled:text-slate-500 hover:bg-emerald-700"
          >
            Open Calculator
          </button>
          <button
            onClick={() => {
              if (window.confirm('Clear this intake and start over?')) intake.reset()
            }}
            className="min-h-12 px-4 rounded-md border border-slate-300 text-slate-700 text-sm hover:bg-slate-100"
          >
            Clear
          </button>
        </div>
      </div>
    </main>
  )
}
