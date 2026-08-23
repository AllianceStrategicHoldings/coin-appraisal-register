// Acceptance flow (SOW 2.6 + Section 4, restructured 2026-08-23).
// Customer details (DOB with the relocated under-18 hard stop, zip, DL,
// consent) → payment selector → $9,500 cash hard stop (manager PIN) →
// mandatory final lot photo → customer signature → offer-letter PDF generated
// client-side, uploaded to cloud storage, and the accepted-deal webhook fired
// (queued offline per 2.14 when unreachable).

import { useMemo, useState } from 'react'
import type { CartLine, Margin, Spot } from '../api/types'
import type { UseDeploymentResult } from '../state/useDeployment'
import { submitDeal, type DealSubmission, type SubmitResult } from '../lib/dealSubmit'
import { buildOfferLetterPdf } from '../lib/offerLetter'
import { dualPriceBag, dualPriceLine } from '../lib/pricing'
import { zipRadiusMiles } from '../lib/zipDistance'
import { uploadDealFile } from '../lib/storage'
import type { PhotoState, UseIntakeResult } from '../state/useIntake'
import { ManagerPinModal } from './ManagerPinModal'
import { PhotoCapture } from './PhotoCapture'
import { SignaturePad } from './SignaturePad'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const CASH_STOP_THRESHOLD = 9500

type PaymentMethod = 'cash' | 'check' | 'wire' | 'other'

interface AcceptanceScreenProps {
  intake: UseIntakeResult
  lines: CartLine[]
  spot: Spot | null
  margins: Margin[]
  deployment: UseDeploymentResult
  onBack: () => void
  onComplete: (result: SubmitResult) => void
  /** under-18 hard stop: end the deal and return to a fresh intake */
  onAbort: () => void
}

export function AcceptanceScreen({
  intake,
  lines,
  spot,
  margins,
  deployment,
  onBack,
  onComplete,
  onAbort,
}: AcceptanceScreenProps) {
  const totals = useMemo(
    () => dualPriceBag(lines, spot, margins),
    [lines, spot, margins],
  )

  const [payment, setPayment] = useState<PaymentMethod | null>(null)
  const [cashAck, setCashAck] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [lotPhoto, setLotPhoto] = useState<PhotoState>({
    status: 'none',
    objectKey: null,
    previewUrl: null,
  })
  const [signature, setSignature] = useState<{ blob: Blob; dataUrl: string } | null>(
    null,
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const needsCashStop =
    payment === 'cash' && totals.totalActualOffer > CASH_STOP_THRESHOLD && !cashAck

  function choosePayment(m: PaymentMethod) {
    setPayment(m)
    if (m === 'cash' && totals.totalActualOffer > CASH_STOP_THRESHOLD && !cashAck) {
      setShowPin(true)
    }
  }

  const missing: string[] = [...intake.dealMissing]
  if (!payment) missing.push('Payment method')
  if (needsCashStop) missing.push('Manager approval ($9,500 cash stop)')
  if (lotPhoto.status === 'none') missing.push('Final lot photo')
  if (!signature) missing.push('Customer signature')
  const canComplete = missing.length === 0 && !intake.isUnder18 && !submitting

  // Under-18 hard stop, relocated here from intake (2026-08-23). Fires the
  // moment a complete DOB computes to under 18; no override, deal cannot
  // complete. ageFromDob ignores partial dates, so it can't fire mid-typing.
  if (intake.isUnder18) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center bg-red-700 text-white px-8 text-center">
        <div className="text-6xl mb-6" aria-hidden="true">⛔</div>
        <h1 className="text-3xl font-bold mb-3">Cannot Proceed</h1>
        <p className="text-lg mb-2">This customer is under 18 years old.</p>
        <p className="text-red-100 mb-10">
          Purchases from minors are not permitted. This deal cannot be completed
          and there is no override.
        </p>
        <button
          onClick={onAbort}
          className="min-h-12 px-8 rounded-md bg-white text-red-700 text-base font-semibold hover:bg-red-50"
        >
          End Deal — Start New Customer
        </button>
      </main>
    )
  }

  async function handleComplete() {
    if (!canComplete || !payment || !signature) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      // 1. Signature PNG to cloud storage (Section 4).
      let signatureKey: string | null = null
      try {
        const up = await uploadDealFile(
          'signature',
          intake.dealDraftId,
          signature.blob,
          'image/png',
        )
        signatureKey = up.objectKey
      } catch {
        signatureKey = null // storage pending — PNG stays embedded in the PDF
      }

      // 2. Offer letter PDF, generated client-side with the signature inline.
      const pdfBlob = buildOfferLetterPdf({
        customerName: intake.fields.name,
        dlNumber: intake.fields.dlNumber,
        dealDraftId: intake.dealDraftId,
        lines,
        spot,
        margins,
        totalOffer: totals.totalActualOffer,
        paymentMethod: payment,
        signatureDataUrl: signature.dataUrl,
        signedAt: new Date(),
      })
      let offerLetterKey: string | null = null
      try {
        const up = await uploadDealFile(
          'offer_letter',
          intake.dealDraftId,
          pdfBlob,
          'application/pdf',
        )
        offerLetterKey = up.objectKey
      } catch {
        offerLetterKey = null
      }

      // 3. Customer travel distance (2.11) — never blocks the deal.
      const zipRadius = await zipRadiusMiles(
        intake.fields.zip,
        deployment.referenceZip,
      )

      // 4. Accepted-deal webhook (Make.com owns the 2.10 fan-out).
      const payload: DealSubmission = {
        event_type: 'deal_accepted',
        deal_draft_id: intake.dealDraftId,
        submitted_at: new Date().toISOString(),
        customer: {
          name: intake.fields.name,
          phone: intake.fields.phone,
          email: intake.fields.email.trim() || undefined,
          dob: intake.fields.dob,
          zip: intake.fields.zip.trim() || undefined,
          dl_number: intake.fields.dlNumber.trim() || undefined,
          tcpa_opt_in: intake.fields.tcpaOptIn,
        },
        selling_reason: intake.fields.sellingReason || undefined,
        referral_source: intake.fields.referralSource || undefined,
        estimated_collection_age:
          intake.dealExtras.estimatedCollectionAge.trim() || undefined,
        competitor_offers_received:
          intake.dealExtras.competitorOffersReceived ?? undefined,
        competitor_offer_amount: intake.dealExtras.competitorOfferAmount
          ? parseFloat(intake.dealExtras.competitorOfferAmount)
          : undefined,
        customer_zip_radius_miles: zipRadius,
        location_id: deployment.activeLocation?.id ?? null,
        event_id: deployment.activeEvent?.id ?? null,
        reference_zip: deployment.referenceZip,
        pre1933_gold_ack: intake.dealExtras.pre1933AckAt ? true : undefined,
        pre1933_ack_at: intake.dealExtras.pre1933AckAt ?? undefined,
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
            manual_offer:
              line.priced_by === 'manual' ? line.manual_offer : undefined,
            description:
              line.priced_by === 'manual'
                ? [line.details.denomination, line.details.year, line.details.condition]
                    .filter(Boolean)
                    .join(' · ')
                : undefined,
            purity_factor_used: line.purity_factor_used,
            hallmark_acknowledged: line.hallmark_acknowledged,
            pre1933_ack: line.pre1933_ack,
          }
        }),
        totals: {
          total_value: totals.meltTotal,
          total_max_payout: totals.totalMaxPayout,
          total_actual_offer: totals.totalActualOffer,
          total_delta: totals.totalDelta,
        },
        spot,
        payment_method: payment,
        cash_over_9500_ack: cashAck || undefined,
        object_keys: {
          intake_lot: intake.lotPhoto.objectKey,
          dl_photo: intake.dlPhoto.objectKey,
          acceptance_lot: lotPhoto.objectKey,
          signature: signatureKey,
          offer_letter: offerLetterKey,
        },
      }
      const result = await submitDeal(payload)
      onComplete(result)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main
      className="min-h-dvh flex flex-col bg-slate-50 pb-36"
      style={{ overscrollBehavior: 'contain' }}
    >
      {showPin && (
        <ManagerPinModal
          title="$9,500 Cash Stop"
          message={`This single cash transaction of ${usd.format(
            totals.totalActualOffer,
          )} exceeds $9,500. A manager must approve before proceeding.`}
          onApproved={() => {
            setCashAck(true)
            setShowPin(false)
          }}
          onCancel={() => {
            setPayment(null)
            setShowPin(false)
          }}
        />
      )}

      <header className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2">
        <button
          onClick={onBack}
          className="min-h-11 px-2 text-sm text-slate-600 hover:text-slate-900 shrink-0"
          aria-label="Back to summary"
        >
          ‹ Summary
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-900">Accept Deal</h1>
          <div className="text-xs text-slate-500 truncate">
            {intake.fields.name} · {usd.format(totals.totalActualOffer)}
          </div>
        </div>
      </header>

      <section className="flex-1 px-4 py-4 space-y-5 max-w-xl w-full mx-auto">
        <div className="bg-white rounded-md border border-slate-200 px-3 py-3 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Customer details
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="accept-dob"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Date of birth
              </label>
              <input
                id="accept-dob"
                type="date"
                value={intake.fields.dob}
                onChange={(e) => intake.setField('dob', e.target.value)}
                className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
              />
            </div>
            <div>
              <label
                htmlFor="accept-zip"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Zip code{' '}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="accept-zip"
                type="text"
                inputMode="numeric"
                maxLength={5}
                autoComplete="off"
                value={intake.fields.zip}
                onChange={(e) =>
                  intake.setField('zip', e.target.value.replace(/\D/g, ''))
                }
                className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="accept-dl"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Driver's license #{' '}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="accept-dl"
              type="text"
              autoComplete="off"
              value={intake.fields.dlNumber}
              onChange={(e) => intake.setField('dlNumber', e.target.value)}
              className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
            />
          </div>
          <PhotoCapture
            label="Driver's license photo (optional)"
            kind="dl_photo"
            dealDraftId={intake.dealDraftId}
            photo={intake.dlPhoto}
            onChange={intake.setDlPhoto}
          />
          <label className="flex items-start gap-3 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={intake.fields.tcpaOptIn}
              onChange={(e) => intake.setField('tcpaOptIn', e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">
              Customer consents to receive calls/texts about this transaction
              (TCPA). Required to complete.
            </span>
          </label>
        </div>

        <div>
          <span className="block text-sm font-medium text-slate-700 mb-2">
            Payment method
          </span>
          <div className="grid grid-cols-4 gap-2">
            {(['cash', 'check', 'wire', 'other'] as const).map((m) => (
              <button
                key={m}
                onClick={() => choosePayment(m)}
                className={`min-h-12 rounded-md border text-sm font-medium capitalize ${
                  payment === m
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {payment === 'cash' && cashAck && (
            <div className="mt-2 text-xs text-emerald-700 font-medium">
              Manager approved cash over $9,500 ✓
            </div>
          )}
        </div>

        <PhotoCapture
          label="Final lot photo — items received"
          kind="acceptance_lot"
          dealDraftId={intake.dealDraftId}
          photo={lotPhoto}
          onChange={setLotPhoto}
        />

        <div>
          <span className="block text-sm font-medium text-slate-700 mb-1">
            Customer signature
          </span>
          <SignaturePad onChange={setSignature} />
        </div>

        {submitError && (
          <div
            role="alert"
            className="px-3 py-2 bg-red-50 border border-red-300 rounded text-sm text-red-800"
          >
            {submitError}
          </div>
        )}
      </section>

      <div
        className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {!canComplete && !submitting && (
          <div className="px-4 pt-2 text-xs text-slate-500">
            Missing: {missing.join(', ')}
          </div>
        )}
        <div className="px-4 pb-3 pt-2">
          <button
            onClick={() => void handleComplete()}
            disabled={!canComplete}
            className="w-full min-h-12 py-3 rounded-md bg-emerald-600 text-white text-base font-semibold disabled:bg-slate-300 disabled:text-slate-500 hover:bg-emerald-700 inline-flex items-center justify-center gap-2"
          >
            {submitting && (
              <span
                className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
            )}
            {submitting
              ? 'Completing…'
              : `Complete Deal — ${usd.format(totals.totalActualOffer)}`}
          </button>
        </div>
      </div>
    </main>
  )
}
