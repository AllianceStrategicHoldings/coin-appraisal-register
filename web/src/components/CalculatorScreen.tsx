import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateBulk, HttpError, NetworkError } from '../api/client'
import { cartLineToRequestItem } from '../api/types'
import { valueBag } from '../lib/pricing'
import { useCart } from '../state/useCart'
import { useConfig } from '../state/useConfig'
import { useSession } from '../state/useSession'
import { AddCoinModal } from './AddCoinModal'

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export function CalculatorScreen() {
  const config = useConfig()
  const cart = useCart()
  const session = useSession()

  const [calcLoading, setCalcLoading] = useState(false)
  const [calcError, setCalcError] = useState<string | null>(null)
  const [showAddCoin, setShowAddCoin] = useState(false)

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
    () => valueBag(cart.lines, effectiveSpot, effectiveMargins),
    [cart.lines, effectiveSpot, effectiveMargins],
  )

  const canCalculate =
    session.selectedRepId !== null && cart.lines.length > 0 && !calcLoading

  const hasMargins = effectiveMargins.length > 0
  const canShowLiveOffer = effectiveSpot !== null && hasMargins
  const canShowLiveMelt = effectiveSpot !== null
  const showLiveTotalsBlock = cart.lines.length > 0
  const spot = session.lastCalc?.spot ?? config.spot ?? null

  return (
    <main
      className="min-h-dvh flex flex-col bg-slate-50 pb-40"
      style={{ overscrollBehavior: 'contain' }}
    >
      <header className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900 truncate">
          Coin Appraisal Register
        </h1>
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

      {showLiveTotalsBlock && (
        <section
          className="px-4 py-3 bg-white border-b border-slate-200"
          aria-label="Bag totals"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                100% Melt
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {canShowLiveMelt ? usd.format(liveTotals.meltTotal) : '—'}
              </div>
              <div className="text-[11px] text-slate-500 leading-tight">
                What the metal is worth
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
                Offer at Margin
              </div>
              <div className="text-2xl font-bold text-emerald-700 tabular-nums">
                {canShowLiveOffer ? usd.format(liveTotals.offerTotal) : '—'}
              </div>
              <div className="text-[11px] text-slate-500 leading-tight">
                What we pay
              </div>
            </div>
          </div>
          {(!canShowLiveMelt || !canShowLiveOffer || liveTotals.hasUnpriceable) && (
            <p className="mt-2 text-[11px] text-slate-500">
              {!canShowLiveMelt
                ? 'Tap Calculate Total to refresh spot prices.'
                : !canShowLiveOffer
                  ? 'Tap Calculate Total — margins not yet loaded for live offer.'
                  : 'Some lines are missing pricing data — Calculate for full result.'}
            </p>
          )}
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
              return (
                <li
                  key={line.id}
                  className="px-3 py-2 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {line.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {value} {line.unit_label}
                    </div>
                  </div>
                  <input
                    type="text"
                    inputMode={isDecimal ? 'decimal' : 'numeric'}
                    pattern={isDecimal ? '[0-9]*\\.?[0-9]*' : '[0-9]*'}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={String(value)}
                    onChange={(e) => {
                      const next = e.target.value
                      const ok = isDecimal
                        ? /^[0-9]*\.?[0-9]*$/.test(next)
                        : /^[0-9]*$/.test(next)
                      if (!ok) return
                      const v = parseFloat(next)
                      if (Number.isNaN(v)) {
                        cart.updateLine(line.id, 0)
                      } else if (v >= 0) {
                        cart.updateLine(line.id, v)
                      }
                    }}
                    className="w-20 min-h-11 px-2 text-sm rounded border border-slate-300"
                    aria-label={`Edit ${line.name}`}
                  />
                  <button
                    onClick={() => cart.removeLine(line.id)}
                    className="text-slate-400 hover:text-red-500 min-h-11 min-w-11 text-2xl leading-none"
                    aria-label={`Remove ${line.name}`}
                  >
                    ×
                  </button>
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
