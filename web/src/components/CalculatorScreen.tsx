import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateBulk, HttpError, NetworkError } from '../api/client'
import { cartLineToRequestItem } from '../api/types'
import { dualPriceBag, dualPriceLine, valueLine } from '../lib/pricing'
import type { UseCartResult } from '../state/useCart'
import type { UseConfigResult } from '../state/useConfig'
import type { UseSessionResult } from '../state/useSession'
import { AddCoinModal } from './AddCoinModal'
import { KeypadField } from './KeypadField'

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

interface CalculatorScreenProps {
  config: UseConfigResult
  cart: UseCartResult
  session: UseSessionResult
  customerName?: string
  onBackToIntake?: () => void
  onReviewDeal?: () => void
}

export function CalculatorScreen({
  config,
  cart,
  session,
  customerName,
  onBackToIntake,
  onReviewDeal,
}: CalculatorScreenProps) {

  const [calcLoading, setCalcLoading] = useState(false)
  const [calcError, setCalcError] = useState<string | null>(null)
  const [showAddCoin, setShowAddCoin] = useState(false)
  // Lines where the rep tried to enter an Actual Offer above Max Payout
  const [offerWarnIds, setOfferWarnIds] = useState<Set<string>>(new Set())

  const prevRepRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevRepRef.current
    if (
      prev !== null &&
      session.selectedRepId !== null &&
      prev !== session.selectedRepId
    ) {
      cart.clear()
      session.setLastCalc(null)
    }
    prevRepRef.current = session.selectedRepId
  }, [session.selectedRepId, cart, session])

  async function handleCalculate() {
    if (cart.lines.length === 0) return
    setCalcLoading(true)
    setCalcError(null)
    try {
      const items = cart.lines.map(cartLineToRequestItem)
      const result = await calculateBulk(items)
      session.setLastCalc(result)
    } catch (err) {
      if (err instanceof NetworkError) {
        setCalcError(
          'No internet connection. Check Wi-Fi and try again — your bag is saved.',
        )
      } else if (err instanceof HttpError) {
        setCalcError(
          `The pricing service returned an error (HTTP ${err.status}). Try again, or contact admin if it keeps happening.`,
        )
      } else {
        setCalcError(
          err instanceof Error ? err.message : String(err),
        )
      }
    } finally {
      setCalcLoading(false)
    }
  }

  function handleNewBag() {
    if (cart.lines.length === 0 && !session.lastCalc) return
    if (window.confirm('Start a new bag? This clears the cart.')) {
      cart.clear()
      session.setLastCalc(null)
    }
  }

  const effectiveSpot = config.spot ?? session.lastCalc?.spot ?? null
  const effectiveMargins = config.margins

  const liveTotals = useMemo(
    () => dualPriceBag(cart.lines, effectiveSpot, effectiveMargins),
    [cart.lines, effectiveSpot, effectiveMargins],
  )

  const canCalculate =
    session.selectedRepId !== null && cart.lines.length > 0 && !calcLoading

  const hasMargins = effectiveMargins.length > 0
  const canShowLiveOffer = effectiveSpot !== null && hasMargins
  const canShowLiveMelt = effectiveSpot !== null
  const spot = session.lastCalc?.spot ?? config.spot ?? null

  return (
    <main
      className="min-h-dvh flex flex-col bg-slate-50 pb-40"
      style={{ overscrollBehavior: 'contain' }}
    >
      <header className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          {onBackToIntake && (
            <button
              onClick={onBackToIntake}
              className="min-h-11 px-2 text-sm text-slate-600 hover:text-slate-900 shrink-0"
              aria-label="Back to customer intake"
            >
              ‹ Intake
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 truncate">
              Coin Appraisal Register
            </h1>
            {customerName && (
              <div className="text-xs text-slate-500 truncate">
                Customer: {customerName}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => void config.refresh()}
          disabled={config.loading}
          className="min-h-11 px-3 text-sm rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-50 shrink-0"
          title="Refresh config from Airtable"
        >
          {config.loading ? 'Refreshing…' : 'Refresh Config'}
        </button>
      </header>

      {config.error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-800">
          Could not load config: {config.error.message}
        </div>
      )}

      {calcError && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-900 flex items-center justify-between gap-3">
          <span>Calculate failed: {calcError}</span>
          <button
            onClick={() => setCalcError(null)}
            className="text-amber-700 underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <section className="px-4 py-3 bg-white border-b border-slate-200">
        <label
          htmlFor="rep-select"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Rep
        </label>
        <select
          id="rep-select"
          value={session.selectedRepId ?? ''}
          onChange={(e) => session.setSelectedRepId(e.target.value || null)}
          className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
        >
          <option value="">Select rep…</option>
          {config.reps.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </section>

      <section
        className="px-4 py-3 bg-white border-b border-slate-200"
        aria-label="Bag totals"
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              Total Value
            </div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {canShowLiveMelt ? usd.format(liveTotals.meltTotal) : '—'}
            </div>
            <div className="text-[11px] text-slate-500 leading-tight">
              What the items are worth
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              Max Payout
            </div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {canShowLiveOffer ? usd.format(liveTotals.totalMaxPayout) : '—'}
            </div>
            <div className="text-[11px] text-slate-500 leading-tight">
              Ceiling we can pay
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
              Actual Offer
            </div>
            <div className="text-2xl font-bold text-emerald-700 tabular-nums">
              {canShowLiveOffer ? usd.format(liveTotals.totalActualOffer) : '—'}
            </div>
            <div className="text-[11px] text-slate-500 leading-tight">
              What we're offering
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-sky-700 font-semibold">
              Delta
            </div>
            <div className="text-2xl font-bold text-sky-700 tabular-nums">
              {canShowLiveOffer ? usd.format(liveTotals.totalDelta) : '—'}
            </div>
            <div className="text-[11px] text-slate-500 leading-tight">
              Negotiation room kept
            </div>
          </div>
        </div>
        {canShowLiveOffer && liveTotals.offerPctOfMax !== null && (
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Offer is {(liveTotals.offerPctOfMax * 100).toFixed(1)}% of Max Payout</span>
            <span className="uppercase tracking-wide">Rep view only</span>
          </div>
        )}
        {cart.lines.length > 0 && (
          !canShowLiveMelt ? (
            <p className="mt-2 text-[11px] text-slate-500">
              Tap Calculate Total to refresh spot prices.
            </p>
          ) : !canShowLiveOffer ? (
            <p className="mt-2 text-[11px] text-slate-500">
              Tap Calculate Total — margins not yet loaded for live offer.
            </p>
          ) : liveTotals.hasUnpriceable ? (
            <div
              role="alert"
              className="mt-2 px-3 py-2 bg-red-50 border border-red-300 rounded text-sm font-bold text-red-700"
            >
              Some lines are missing pricing data — Calculate for full result.
            </div>
          ) : null
        )}
      </section>

      {session.lastCalc && (
        <section
          className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 flex items-baseline justify-between gap-3"
          aria-label="Last calculated total"
        >
          <span className="text-xs uppercase tracking-wide text-emerald-800 font-semibold">
            Last calculated total
          </span>
          <span className="text-xl font-bold text-emerald-900 tabular-nums">
            {usd.format(session.lastCalc.total)}
          </span>
        </section>
      )}

      {spot && (
        <section className="px-4 py-2 bg-slate-100 text-xs text-slate-600 border-b border-slate-200 flex flex-wrap gap-x-4 gap-y-1">
          <span>Gold: {usd.format(spot.gold)}/oz</span>
          <span>Silver: {usd.format(spot.silver)}/oz</span>
          <span>Platinum: {usd.format(spot.platinum)}/oz</span>
        </section>
      )}

      <section className="flex-1 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-slate-700">
            Bag ({cart.lines.length})
          </h2>
          <button
            onClick={() => setShowAddCoin(true)}
            disabled={config.loading || config.coinTypes.length === 0}
            className="min-h-11 px-4 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500"
          >
            Add Coin
          </button>
        </div>

        {cart.lines.length === 0 ? (
          <p className="py-8 text-center text-slate-500 text-sm">
            Add a coin to get started.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 bg-white rounded-md border border-slate-200">
            {cart.lines.map((line) => {
              const value =
                line.priced_by === 'weight_grams' ? line.weight_grams : line.quantity
              const isDecimal = line.priced_by === 'weight_grams'
              const isUnpriceable = liveTotals.unpriceableIds.has(line.id)
              const lineVal = valueLine(line, effectiveSpot, effectiveMargins)
              const dual = dualPriceLine(line, effectiveSpot, effectiveMargins)
              const showOverWarn = offerWarnIds.has(line.id)
              return (
                <li
                  key={line.id}
                  className={`px-3 py-2 ${
                    isUnpriceable ? 'bg-red-50 border-l-4 border-red-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {line.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {value} {line.unit_label}
                        {line.priced_by === 'times_face' && line.grade ? (
                          <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] uppercase tracking-wide">
                            {line.grade}
                          </span>
                        ) : null}
                      </div>
                      {lineVal && (
                        <div className="text-xs mt-0.5 tabular-nums text-slate-500">
                          {lineVal.meltValue > 0 ? (
                            <>Value {usd.format(lineVal.meltValue)} · </>
                          ) : null}
                          <span className="font-semibold text-slate-700">
                            Max {usd.format(lineVal.offerValue)}
                          </span>
                        </div>
                      )}
                      {isUnpriceable && (
                        <div className="text-xs font-bold text-red-700 mt-0.5">
                          Missing pricing data
                        </div>
                      )}
                    </div>
                    <div className="w-24">
                      <KeypadField
                        value={String(value)}
                        onChange={(next) => {
                          if (next === '' || next === '.') {
                            cart.updateLine(line.id, 0)
                            return
                          }
                          const v = parseFloat(next)
                          if (!Number.isNaN(v) && v >= 0) {
                            cart.updateLine(line.id, v)
                          }
                        }}
                        allowDecimal={isDecimal}
                        ariaLabel={`Edit ${line.name}`}
                        keypadLabel={`${line.name} — ${line.unit_label}`}
                        className="w-full min-h-11 px-2 text-sm rounded border border-slate-300 bg-white text-right"
                      />
                    </div>
                    <button
                      onClick={() => cart.removeLine(line.id)}
                      className="text-slate-400 hover:text-red-500 min-h-11 min-w-11 text-2xl leading-none"
                      aria-label={`Remove ${line.name}`}
                    >
                      ×
                    </button>
                  </div>
                  {dual && (
                    <div className="mt-1.5 flex items-center gap-2 pl-1">
                      <span className="text-xs text-slate-500 shrink-0">Offer $</span>
                      <div className="w-28">
                        <KeypadField
                          value={
                            line.actual_offer != null
                              ? String(line.actual_offer)
                              : dual.actualOffer.toFixed(2)
                          }
                          onChange={(next) => {
                            if (next === '' || next === '.') {
                              cart.setActualOffer(line.id, null)
                              setOfferWarnIds((prev) => {
                                const s = new Set(prev)
                                s.delete(line.id)
                                return s
                              })
                              return
                            }
                            const v = parseFloat(next)
                            if (Number.isNaN(v) || v < 0) return
                            if (v > dual.maxPayout) {
                              // Above Max Payout requires a manager override
                              // code (2.13) — blocked until that lands in M3.
                              setOfferWarnIds((prev) => new Set(prev).add(line.id))
                              return
                            }
                            setOfferWarnIds((prev) => {
                              const s = new Set(prev)
                              s.delete(line.id)
                              return s
                            })
                            cart.setActualOffer(line.id, v)
                          }}
                          allowDecimal
                          ariaLabel={`Actual offer for ${line.name}`}
                          keypadLabel={`${line.name} — Actual Offer ($)`}
                          className={`w-full min-h-11 px-2 text-sm rounded border bg-white text-right font-semibold ${
                            line.actual_offer != null
                              ? 'border-emerald-400 text-emerald-800'
                              : 'border-slate-300 text-slate-500'
                          }`}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-sky-700 font-medium shrink-0">
                        Delta {usd.format(dual.negotiationDelta)}
                      </span>
                      {line.actual_offer != null && (
                        <button
                          onClick={() => {
                            cart.setActualOffer(line.id, null)
                            setOfferWarnIds((prev) => {
                              const s = new Set(prev)
                              s.delete(line.id)
                              return s
                            })
                          }}
                          className="text-xs text-slate-400 underline shrink-0 min-h-11"
                        >
                          reset
                        </button>
                      )}
                    </div>
                  )}
                  {showOverWarn && dual && (
                    <div
                      role="alert"
                      className="mt-1 ml-1 text-xs font-semibold text-red-700"
                    >
                      Above Max Payout ({usd.format(dual.maxPayout)}) — requires a
                      manager override code.
                    </div>
                  )}
                  {!showOverWarn && dual?.capped && (
                    <div
                      role="alert"
                      className="mt-1 ml-1 text-xs font-semibold text-amber-700"
                    >
                      Entered offer exceeds Max Payout — capped at{' '}
                      {usd.format(dual.maxPayout)} (manager override required to
                      exceed).
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div
        className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {!canCalculate && !calcLoading && (
          <div className="px-4 pt-2 pb-1 text-xs text-slate-500 text-right">
            {session.selectedRepId === null
              ? 'Select a rep to calculate.'
              : cart.lines.length === 0
                ? 'Add a coin to calculate.'
                : null}
          </div>
        )}
        {onReviewDeal && cart.lines.length > 0 && (
          <div className="px-4 pt-3">
            <button
              onClick={onReviewDeal}
              className="w-full min-h-12 py-3 rounded-md bg-slate-900 text-white text-base font-semibold hover:bg-slate-800"
            >
              Review Deal →
            </button>
          </div>
        )}
        <div className="px-4 pb-3 pt-3 flex gap-2">
          <button
            onClick={() => void handleCalculate()}
            disabled={!canCalculate}
            className="flex-1 min-h-12 py-3 rounded-md bg-emerald-600 text-white text-base font-semibold disabled:bg-slate-300 disabled:text-slate-500 hover:bg-emerald-700 inline-flex items-center justify-center gap-2"
          >
            {calcLoading && (
              <span
                className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
            )}
            {calcLoading ? 'Calculating…' : 'Calculate Total'}
          </button>
          <button
            onClick={handleNewBag}
            className="min-h-12 px-4 rounded-md border border-slate-300 text-slate-700 text-sm hover:bg-slate-100"
          >
            New Bag
          </button>
        </div>
      </div>

      <AddCoinModal
        isOpen={showAddCoin}
        onClose={() => setShowAddCoin(false)}
        coinTypes={config.coinTypes}
        onAdd={cart.addLine}
      />
    </main>
  )
}
