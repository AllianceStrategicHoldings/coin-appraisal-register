// Customer intake (SOW 2.1). Five required fields + lot photo + DL capture
// gate the calculator. Under-18 DOB is a full-screen hard stop with no
// override. Returning customers are looked up in Customer_Master by
// phone + DOB as soon as both are entered.

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
import { PhotoCapture } from './PhotoCapture'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

interface IntakeScreenProps {
  intake: UseIntakeResult
  onOpenCalculator: () => void
}

export function IntakeScreen({ intake, onOpenCalculator }: IntakeScreenProps) {
  const { fields, setField } = intake
  const [lookupState, setLookupState] = useState<'idle' | 'searching' | 'done'>('idle')

  // Returning-customer lookup fires once phone (10 digits) + full DOB exist.
  const phoneDigits = normalizePhone(fields.phone)
  const lookupKey =
    phoneDigits.length >= 10 && intake.age !== null ? `${phoneDigits}|${fields.dob}` : null
  const lastLookupRef = useRef<string | null>(null)

  useEffect(() => {
    if (!lookupKey || lookupKey === lastLookupRef.current) return
    lastLookupRef.current = lookupKey
    setLookupState('searching')
    lookupCustomer(phoneDigits, fields.dob)
      .then((res) => {
        intake.setLookup(res)
        // Pre-fill from the matched profile anything the rep hasn't typed yet.
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

  // ---- Under-18 hard stop (no override, no back-door) ----
  if (intake.isUnder18) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center bg-red-700 text-white px-8 text-center">
        <div className="text-6xl mb-6" aria-hidden="true">⛔</div>
        <h1 className="text-3xl font-bold mb-3">Cannot Proceed</h1>
        <p className="text-lg mb-2">This customer is under 18 years old.</p>
        <p className="text-red-100 mb-10">
          Purchases from minors are not permitted. This deal cannot continue and
          there is no override.
        </p>
        <button
          onClick={intake.reset}
          className="min-h-12 px-8 rounded-md bg-white text-red-700 text-base font-semibold hover:bg-red-50"
        >
          End — Start New Customer
        </button>
      </main>
    )
  }

  const match = intake.lookup?.matched ? intake.lookup : null

  return (
    <main
      className="min-h-dvh flex flex-col bg-slate-50 pb-32"
      style={{ overscrollBehavior: 'contain' }}
    >
      <header className="px-4 py-3 bg-white border-b border-slate-200">
        <h1 className="text-lg font-semibold text-slate-900">Customer Intake</h1>
        <p className="text-xs text-slate-500">
          All fields are required before the calculator opens.
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
              Phone
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
            <label htmlFor="intake-dob" className="block text-sm font-medium text-slate-700 mb-1">
              Date of birth
            </label>
            <input
              id="intake-dob"
              type="date"
              value={fields.dob}
              onChange={(e) => setField('dob', e.target.value)}
              className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="intake-zip" className="block text-sm font-medium text-slate-700 mb-1">
              Zip code
            </label>
            <input
              id="intake-zip"
              type="text"
              inputMode="numeric"
              maxLength={5}
              autoComplete="off"
              value={fields.zip}
              onChange={(e) => setField('zip', e.target.value.replace(/\D/g, ''))}
              className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
            />
          </div>
          <div>
            <label htmlFor="intake-dl" className="block text-sm font-medium text-slate-700 mb-1">
              Driver's license #
            </label>
            <input
              id="intake-dl"
              type="text"
              autoComplete="off"
              value={fields.dlNumber}
              onChange={(e) => setField('dlNumber', e.target.value)}
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
              Reason for selling
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
              How did they find us?
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

        <PhotoCapture
          label="Driver's license photo"
          kind="dl_photo"
          dealDraftId={intake.dealDraftId}
          photo={intake.dlPhoto}
          onChange={intake.setDlPhoto}
        />

        <PhotoCapture
          label="Lot photo — one photo of the entire haul"
          kind="intake_lot"
          dealDraftId={intake.dealDraftId}
          photo={intake.lotPhoto}
          onChange={intake.setLotPhoto}
        />

        <label className="flex items-start gap-3 py-1 cursor-pointer">
          <input
            type="checkbox"
            checked={fields.tcpaOptIn}
            onChange={(e) => setField('tcpaOptIn', e.target.checked)}
            className="mt-1 h-5 w-5 rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">
            Customer consents to receive calls/texts about this transaction
            (TCPA). Required to proceed.
          </span>
        </label>
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
