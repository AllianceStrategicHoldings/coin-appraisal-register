// Cert lookup + wholesale pricing panel (spec 2.3).
//
// Manual cert entry (no barcode SDK in scope) → PCGS validates → CDN
// Greysheet wholesale shown SIDE BY SIDE with our offer at the configured
// margin → eBay sold comps low/median/high. Falls back CDN →
// Manual_Price_Override → Ask Manager.

import { useState } from 'react'
import { HttpError, NetworkError } from '../api/client'
import {
  lookupCert,
  offerAtMargin,
  resolvePriceSource,
  type LookupResult,
} from '../lib/lookup'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export interface CertLookupValue {
  certNumber: string
  result: LookupResult | null
  manualOverride: number | null
  priceSource: 'cdn' | 'manual_override' | 'ask_manager'
  /** the price the line should use, or null when a manager is required */
  price: number | null
}

interface CertLookupPanelProps {
  marginPct: number
  onChange: (value: CertLookupValue) => void
  onAskManager: () => void
}

export function CertLookupPanel({
  marginPct,
  onChange,
  onAskManager,
}: CertLookupPanelProps) {
  const [certNumber, setCertNumber] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)
  const [manual, setManual] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const manualNum = manual.trim() === '' ? null : parseFloat(manual)
  const manualValid = manualNum === null || (!Number.isNaN(manualNum) && manualNum > 0)
  const chain = resolvePriceSource(result, manualValid ? manualNum : null)

  function emit(next?: Partial<CertLookupValue>) {
    const r = next?.result !== undefined ? next.result : result
    const m = next?.manualOverride !== undefined ? next.manualOverride : (manualValid ? manualNum : null)
    const c = resolvePriceSource(r, m)
    onChange({
      certNumber: next?.certNumber ?? certNumber,
      result: r,
      manualOverride: m,
      priceSource: c.source,
      price: c.price,
    })
  }

  async function runLookup() {
    const cert = certNumber.trim()
    if (cert.length < 6) {
      setError('Enter the full certification number (7–8 digits).')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const r = await lookupCert(cert)
      setResult(r)
      emit({ result: r, certNumber: cert })
      if (!r.cert.found) {
        setError('PCGS has no record of this certification number. Check the slab, or use Ask Manager.')
      }
    } catch (err) {
      setResult(null)
      emit({ result: null })
      if (err instanceof NetworkError) {
        setError('No connection — enter a manual price or use Ask Manager.')
      } else if (err instanceof HttpError && err.status === 503) {
        setError('Lookup service not connected yet — enter a manual price or use Ask Manager.')
      } else {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="cert-number"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Certification number
        </label>
        <div className="flex gap-2">
          <input
            id="cert-number"
            type="text"
            inputMode="numeric"
            value={certNumber}
            onChange={(e) => {
              setCertNumber(e.target.value.replace(/\D/g, ''))
              setResult(null)
              setError(null)
            }}
            placeholder="e.g. 30000001"
            className="flex-1 min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
          />
          <button
            type="button"
            onClick={() => void runLookup()}
            disabled={loading}
            className="min-h-11 px-4 rounded-md bg-slate-900 text-white text-sm font-semibold disabled:bg-slate-300 disabled:text-slate-500"
          >
            {loading ? 'Looking up…' : 'Look up'}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Type the number from the slab — no scanner needed.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="px-3 py-2 rounded-md bg-amber-50 border border-amber-300 text-xs text-amber-900"
        >
          {error}
        </div>
      )}

      {result?.cert.found && (
        <div className="px-3 py-2 rounded-md bg-sky-50 border border-sky-200">
          <div className="text-sm font-semibold text-sky-900">
            {result.cert.name ?? 'Verified'}
            {result.cert.grade ? ` · ${result.cert.grade}` : ''}
          </div>
          <div className="text-[11px] text-sky-800">
            PCGS verified{result.cert.pcgs_no ? ` · PCGS #${result.cert.pcgs_no}` : ''}
          </div>
        </div>
      )}

      {/* CDN price shown side by side with our offer at margin (2.3) */}
      {result?.cdn_price != null && (
        <div className="grid grid-cols-2 gap-3 px-3 py-2 rounded-md bg-white border border-slate-200">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
              CDN wholesale
            </div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {usd.format(result.cdn_price)}
            </div>
            {result.cdn_label && (
              <div className="text-[11px] text-slate-500">{result.cdn_label}</div>
            )}
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold">
              Our offer
            </div>
            <div className="text-xl font-bold text-emerald-700 tabular-nums">
              {usd.format(offerAtMargin(result.cdn_price, marginPct))}
            </div>
            <div className="text-[11px] text-slate-500">
              at {(marginPct * 100).toFixed(0)}% margin
            </div>
          </div>
        </div>
      )}

      {/* eBay comps — empty is a valid result, not an error (2.3) */}
      {result?.comps.ran && (
        <div className="px-3 py-2 rounded-md bg-slate-50 border border-slate-200">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
            eBay sold comps
          </div>
          {result.comps.count === 0 ? (
            <div className="text-xs text-slate-500">
              No recent sales found — normal for scarce items.
            </div>
          ) : (
            <div className="flex justify-between text-sm tabular-nums">
              <span className="text-slate-700">
                Low <strong>{usd.format(result.comps.low ?? 0)}</strong>
              </span>
              <span className="text-slate-900">
                Median <strong>{usd.format(result.comps.median ?? 0)}</strong>
              </span>
              <span className="text-slate-700">
                High <strong>{usd.format(result.comps.high ?? 0)}</strong>
              </span>
            </div>
          )}
          <div className="text-[11px] text-slate-400 mt-0.5">
            {result.comps.count} sale{result.comps.count === 1 ? '' : 's'} logged
          </div>
        </div>
      )}

      {/* Fallback: manual price override, then Ask Manager */}
      {result?.cdn_price == null && (
        <div>
          <label
            htmlFor="manual-price"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Manual price override
            <span className="font-normal text-slate-400"> (no CDN price)</span>
          </label>
          <input
            id="manual-price"
            type="text"
            inputMode="decimal"
            value={manual}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, '')
              setManual(v)
              const n = v.trim() === '' ? null : parseFloat(v)
              emit({ manualOverride: Number.isNaN(n as number) ? null : n })
            }}
            placeholder="wholesale value"
            className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
          />
          {!manualValid && (
            <div className="mt-1 text-xs text-red-700">Enter a positive amount.</div>
          )}
          {manualValid && manualNum != null && (
            <div className="mt-1 text-xs text-slate-600">
              Offer at margin:{' '}
              <strong className="text-emerald-700">
                {usd.format(offerAtMargin(manualNum, marginPct))}
              </strong>
            </div>
          )}
        </div>
      )}

      {chain.source === 'ask_manager' && (
        <div className="px-3 py-2 rounded-md bg-amber-50 border border-amber-300">
          <div className="text-xs text-amber-900 mb-2">
            No CDN price and no manual override — a manager must price this item.
          </div>
          <button
            type="button"
            onClick={onAskManager}
            className="min-h-11 px-4 rounded-md bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700"
          >
            Ask Manager
          </button>
        </div>
      )}

      <div className="text-[11px] text-slate-400">
        Price source:{' '}
        <span className="font-semibold text-slate-600">
          {chain.source === 'cdn'
            ? 'CDN Greysheet'
            : chain.source === 'manual_override'
              ? 'Manual override'
              : 'Awaiting manager'}
        </span>
      </div>
    </div>
  )
}
