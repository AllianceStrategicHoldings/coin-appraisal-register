// Deal Summary & Customer View (SOW 2.5).
//
// Rep-facing summary: line items, Value/Max/Offer/Delta totals, margin %,
// Accept / Decline. A swipe gesture (or the toggle button) transitions to a
// clean customer-facing view that hides ALL margin information — no melt
// value, no Max Payout, no delta, no percentages. Same screen flow; no
// separate customer UI.

import { useMemo, useRef, useState } from 'react'
import type { CartLine, Margin, Spot } from '../api/types'
import { dualPriceBag, dualPriceLine } from '../lib/pricing'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const SWIPE_THRESHOLD_PX = 60

export type DealDecision = 'accept' | 'decline'

interface DealSummaryScreenProps {
  customerName: string
  lines: CartLine[]
  spot: Spot | null
  margins: Margin[]
  onBack: () => void
  onDecision: (decision: DealDecision) => void
}

export function DealSummaryScreen({
  customerName,
  lines,
  spot,
  margins,
  onBack,
  onDecision,
}: DealSummaryScreenProps) {
  // Dev-only initial view override for local testing/screenshots; compiled
  // out of production builds.
  const [view, setView] = useState<'rep' | 'customer'>(() =>
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get('view') === 'customer'
      ? 'customer'
      : 'rep',
  )

  const touchStartX = useRef<number | null>(null)

  const totals = useMemo(
    () => dualPriceBag(lines, spot, margins),
    [lines, spot, margins],
  )

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current
    touchStartX.current = null
    if (start === null) return
    const end = e.changedTouches[0]?.clientX ?? start
    const dx = end - start
    // Swipe left: rep -> customer. Swipe right: customer -> rep.
    if (dx < -SWIPE_THRESHOLD_PX && view === 'rep') setView('customer')
    if (dx > SWIPE_THRESHOLD_PX && view === 'customer') setView('rep')
  }

  // ---------------------------------------------------------------- customer
  if (view === 'customer') {
    return (
      <main
        className="min-h-dvh flex flex-col bg-white"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <header className="px-6 pt-8 pb-4 text-center border-b border-slate-100">
          <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">
            Offer Summary
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{customerName}</h1>
          <div className="text-sm text-slate-500 mt-1">
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </header>

        <section className="flex-1 px-6 py-4 max-w-lg w-full mx-auto">
          <ul className="divide-y divide-slate-100">
            {lines.map((line) => {
              const dual = dualPriceLine(line, spot, margins)
              const qty =
                line.priced_by === 'weight_grams'
                  ? `${line.weight_grams} ${line.unit_label}`
                  : `${line.quantity} ${line.unit_label}`
              return (
                <li key={line.id} className="py-3 flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-base text-slate-900">{line.name}</div>
                    <div className="text-sm text-slate-400">{qty}</div>
                  </div>
                  <div className="text-base font-medium text-slate-900 tabular-nums shrink-0">
                    {dual ? usd.format(dual.actualOffer) : '—'}
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="mt-6 pt-4 border-t-2 border-slate-900 flex items-baseline justify-between">
            <span className="text-lg font-semibold text-slate-900">Our offer</span>
            <span className="text-3xl font-bold text-slate-900 tabular-nums">
              {usd.format(totals.totalActualOffer)}
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-500 text-center">
            Payable today by cash, check, or wire.
          </p>
        </section>

        <footer className="px-6 pb-8 pt-2 text-center">
          <button
            onClick={() => setView('rep')}
            className="text-xs text-slate-300 min-h-11 px-4"
            aria-label="Back to rep view"
          >
            ‹ swipe
          </button>
        </footer>
      </main>
    )
  }

  // --------------------------------------------------------------------- rep
  return (
    <main
      className="min-h-dvh flex flex-col bg-slate-50 pb-36"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ overscrollBehavior: 'contain' }}
    >
      <header className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="min-h-11 px-2 text-sm text-slate-600 hover:text-slate-900 shrink-0"
            aria-label="Back to calculator"
          >
            ‹ Bag
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 truncate">
              Deal Summary
            </h1>
            <div className="text-xs text-slate-500 truncate">
              Customer: {customerName}
            </div>
          </div>
        </div>
        <button
          onClick={() => setView('customer')}
          className="min-h-11 px-3 text-sm rounded-md bg-slate-100 hover:bg-slate-200 shrink-0"
        >
          Customer View →
        </button>
      </header>

      <div className="px-4 py-1.5 bg-slate-100 border-b border-slate-200 text-[11px] text-slate-500 text-center">
        Swipe left for the customer-facing view — margin data is hidden there.
      </div>

      <section className="px-4 py-3 bg-white border-b border-slate-200" aria-label="Deal totals">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              Total Value
            </div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {usd.format(totals.meltTotal)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              Max Payout
            </div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {usd.format(totals.totalMaxPayout)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
              Actual Offer
            </div>
            <div className="text-2xl font-bold text-emerald-700 tabular-nums">
              {usd.format(totals.totalActualOffer)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-sky-700 font-semibold">
              Delta
            </div>
            <div className="text-2xl font-bold text-sky-700 tabular-nums">
              {usd.format(totals.totalDelta)}
            </div>
          </div>
        </div>
        {totals.offerPctOfMax !== null && (
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Offer is {(totals.offerPctOfMax * 100).toFixed(1)}% of Max Payout</span>
            <span className="uppercase tracking-wide">Rep view only</span>
          </div>
        )}
        {totals.hasUnpriceable && (
          <div
            role="alert"
            className="mt-2 px-3 py-2 bg-red-50 border border-red-300 rounded text-sm font-bold text-red-700"
          >
            Some lines are missing pricing data and are excluded from totals.
          </div>
        )}
      </section>

      <section className="flex-1 px-4 py-3">
        <h2 className="text-sm font-medium text-slate-700 mb-2">
          Line items ({lines.length})
        </h2>
        <ul className="divide-y divide-slate-200 bg-white rounded-md border border-slate-200">
          {lines.map((line) => {
            const dual = dualPriceLine(line, spot, margins)
            const qty =
              line.priced_by === 'weight_grams'
                ? `${line.weight_grams} ${line.unit_label}`
                : `${line.quantity} ${line.unit_label}`
            return (
              <li key={line.id} className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-900">
                      {line.name}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">{qty}</span>
                    {line.priced_by === 'times_face' && line.grade ? (
                      <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] uppercase tracking-wide">
                        {line.grade}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm font-semibold text-emerald-700 tabular-nums shrink-0">
                    {dual ? usd.format(dual.actualOffer) : '—'}
                  </div>
                </div>
                {dual && (
                  <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                    Max {usd.format(dual.maxPayout)} · Delta{' '}
                    {usd.format(dual.negotiationDelta)}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <div
        className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="px-4 pb-3 pt-3 flex gap-2">
          <button
            onClick={() => onDecision('decline')}
            className="flex-1 min-h-12 py-3 rounded-md border-2 border-red-300 text-red-700 text-base font-semibold hover:bg-red-50"
          >
            Decline
          </button>
          <button
            onClick={() => onDecision('accept')}
            className="flex-[2] min-h-12 py-3 rounded-md bg-emerald-600 text-white text-base font-semibold hover:bg-emerald-700"
          >
            Accept — {usd.format(totals.totalActualOffer)}
          </button>
        </div>
      </div>
    </main>
  )
}
