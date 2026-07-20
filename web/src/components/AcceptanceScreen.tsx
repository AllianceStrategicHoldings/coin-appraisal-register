// Acceptance flow (SOW 2.6 + Section 4).
// Payment selector → $9,500 cash hard stop (manager PIN) → mandatory final
// lot photo → customer signature → offer-letter PDF generated client-side,
// uploaded to cloud storage, and the accepted-deal webhook fired (queued
// offline per 2.14 when unreachable).

import { useMemo, useState } from 'react'
import type { CartLine, Margin, Spot } from '../api/types'
import { submitDeal, type DealSubmission, type SubmitResult } from '../lib/dealSubmit'
import { buildOfferLetterPdf } from '../lib/offerLetter'
import { dualPriceBag, dualPriceLine } from '../lib/pricing'
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
  onBack: () => void
  onComplete: (result: SubmitResult) => void
}

export function AcceptanceScreen({
  intake,
  lines,
  spot,
  margins,
  onBack,
  onComplete,
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

  const missing: string[] = []
  if (!payment) missing.push('Payment method')
  if (needsCashStop) missing.push('Manager approval ($9,500 cash stop)')
  if (lotPhoto.status === 'none') missing.push('Final lot photo')
  if (!signature) missing.push('Customer signature')
  const canComplete = missing.length === 0 && !submitting

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

      // 3. Accepted-deal webhook (Make.com owns the 2.10 fan-out).
      const payload: DealSubmission = {
        event_type: 'deal_accepted',
        deal_draft_id: intake.dealDraftId,
        submitted_at: new Date().toISOString(),
        customer: {
          name: intake.fields.name,
          phone: intake.fields.phone,
          dob: intake.fields.dob,
          zip: intake.fields.zip,
          dl_number: intake.fields.dlNumber,
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
        customer_zip_radius_miles: null,
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
