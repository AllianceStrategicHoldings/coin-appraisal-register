// Decline flow (SOW 2.7).
// On decline: confirm the customer's phone is on file (it is, from intake —
// editable here as a safety net), optionally grant a 24-hour price lock, and
// fire the declined-deal webhook with deal_declined + price_lock_24hr tags.

import { useMemo, useState } from 'react'
import type { CartLine, Margin, Spot } from '../api/types'
import { submitDeal, type DealSubmission, type SubmitResult } from '../lib/dealSubmit'
import { dualPriceBag, dualPriceLine } from '../lib/pricing'
import { normalizePhone, type UseIntakeResult } from '../state/useIntake'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const LOCK_HOURS = 24

interface DeclineScreenProps {
  intake: UseIntakeResult
  lines: CartLine[]
  spot: Spot | null
  margins: Margin[]
  onBack: () => void
  onComplete: (result: SubmitResult, priceLocked: boolean, expiresAt: Date | null) => void
}

export function DeclineScreen({
  intake,
  lines,
  spot,
  margins,
  onBack,
  onComplete,
}: DeclineScreenProps) {
  const totals = useMemo(
    () => dualPriceBag(lines, spot, margins),
    [lines, spot, margins],
  )

  const [phone, setPhone] = useState(intake.fields.phone)
  const [priceLock, setPriceLock] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const phoneOk = normalizePhone(phone).length >= 10
  const canConfirm = priceLock !== null && (!priceLock || phoneOk) && !submitting

  async function handleConfirm() {
    if (!canConfirm || priceLock === null) return
    setSubmitting(true)
    const expiresAt = priceLock
      ? new Date(Date.now() + LOCK_HOURS * 60 * 60 * 1000)
      : null

    const payload: DealSubmission = {
      event_type: 'deal_declined',
      deal_draft_id: intake.dealDraftId,
      submitted_at: new Date().toISOString(),
      customer: {
        name: intake.fields.name,
        phone,
        dob: intake.fields.dob,
        zip: intake.fields.zip,
        dl_number: intake.fields.dlNumber,
        tcpa_opt_in: intake.fields.tcpaOptIn,
      },
      lines: lines.map((line) => {
        const dual = dualPriceLine(line, spot, margins)
        return {
          coin_type_id: line.coin_type_id,
          name: line.name,
          priced_by: line.priced_by,
          quantity:
            line.priced_by === 'weight_grams' ? line.weight_grams : line.quantity,
          unit_label: line.unit_label,
          grade: line.priced_by === 'times_face' ? line.grade : undefined,
          max_payout: dual?.maxPayout ?? null,
          actual_offer: dual?.actualOffer ?? null,
        }
      }),
      totals: {
        total_value: totals.meltTotal,
        total_max_payout: totals.totalMaxPayout,
        total_actual_offer: totals.totalActualOffer,
        total_delta: totals.totalDelta,
      },
      spot,
      price_lock_24hr: priceLock,
      price_lock_expires_at: expiresAt?.toISOString(),
      object_keys: {
        intake_lot: intake.lotPhoto.objectKey,
        dl_photo: intake.dlPhoto.objectKey,
      },
    }

    const result = await submitDeal(payload)
    setSubmitting(false)
    onComplete(result, priceLock, expiresAt)
  }

  return (
    <main
      className="min-h-dvh flex flex-col bg-slate-50 pb-32"
      style={{ overscrollBehavior: 'contain' }}
    >
      <header className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2">
        <button
          onClick={onBack}
          className="min-h-11 px-2 text-sm text-slate-600 hover:text-slate-900 shrink-0"
          aria-label="Back to summary"
        >
          ‹ Summary
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-900">Decline Deal</h1>
          <div className="text-xs text-slate-500 truncate">
            {intake.fields.name} · offer was {usd.format(totals.totalActualOffer)}
          </div>
        </div>
      </header>

      <section className="flex-1 px-4 py-4 space-y-5 max-w-xl w-full mx-auto">
        <div className="px-4 py-3 bg-white rounded-md border border-slate-200">
          <div className="text-sm text-slate-600">
            The customer is declining our offer of{' '}
            <span className="font-semibold text-slate-900">
              {usd.format(totals.totalActualOffer)}
            </span>
            .
          </div>
        </div>

        <div>
          <span className="block text-sm font-medium text-slate-700 mb-2">
            Offer a {LOCK_HOURS}-hour price lock?
          </span>
          <p className="text-xs text-slate-500 mb-2">
            If the customer returns within {LOCK_HOURS} hours, this offer stands
            even if spot prices move.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPriceLock(true)}
              className={`min-h-12 rounded-md border text-sm font-medium ${
                priceLock === true
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              Yes — lock the price
            </button>
            <button
              onClick={() => setPriceLock(false)}
              className={`min-h-12 rounded-md border text-sm font-medium ${
                priceLock === false
                  ? 'border-slate-900 bg-slate-100 text-slate-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              No lock
            </button>
          </div>
        </div>

        {priceLock === true && (
          <div>
            <label
              htmlFor="decline-phone"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Customer phone (for the price-lock record)
            </label>
            <input
              id="decline-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
            />
            {!phoneOk && (
              <div className="mt-1 text-xs text-red-700">
                A 10-digit phone number is required for the price lock.
              </div>
            )}
          </div>
        )}
      </section>

      <div
        className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {priceLock === null && (
          <div className="px-4 pt-2 text-xs text-slate-500">
            Choose whether to offer the price lock.
          </div>
        )}
        <div className="px-4 pb-3 pt-2">
          <button
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
            className="w-full min-h-12 py-3 rounded-md bg-red-700 text-white text-base font-semibold disabled:bg-slate-300 disabled:text-slate-500 hover:bg-red-800 inline-flex items-center justify-center gap-2"
          >
            {submitting && (
              <span
                className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
            )}
            {submitting ? 'Recording…' : 'Confirm Decline'}
          </button>
        </div>
      </div>
    </main>
  )
}
