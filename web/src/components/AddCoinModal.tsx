import { useEffect, useMemo, useState } from 'react'
import type { CartLineInput, CoinType, Grade, Metal } from '../api/types'
import type { Margin } from '../api/types'
import { CertLookupPanel, type CertLookupValue } from './CertLookupPanel'
import { HallmarkAckModal } from './HallmarkAckModal'
import { KeypadField } from './KeypadField'
import { Pre1933GoldStop } from './Pre1933GoldStop'

const GRADES: Array<{ value: Grade; label: string }> = [
  { value: 'circulated', label: 'Circulated' },
  { value: 'uncirculated', label: 'Uncirculated' },
  { value: 'slabbed', label: 'Slabbed' },
]

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const METAL_ORDER: Metal[] = ['silver', 'gold', 'platinum', 'numismatic']
const METAL_LABEL: Record<Metal, string> = {
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  numismatic: 'Numismatic / Other',
}

interface AddCoinModalProps {
  isOpen: boolean
  onClose: () => void
  coinTypes: CoinType[]
  onAdd: (line: CartLineInput) => void
  /** records the timestamped Pre-1933 gold manager acknowledgment on the deal */
  onPre1933Ack?: (at: string) => void
  /** margins, for showing CDN price beside our offer at margin (2.3) */
  margins?: Margin[]
  /** escalate to a manager when the fallback chain runs out (2.3) */
  onAskManager?: () => void
}

export function AddCoinModal({
  isOpen,
  onClose,
  coinTypes,
  onAdd,
  onPre1933Ack,
  margins,
  onAskManager,
}: AddCoinModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [value, setValue] = useState<string>('')
  const [grade, setGrade] = useState<Grade | null>(null)

  // 2.2 gates and overrides
  const [hallmarkAck, setHallmarkAck] = useState(false)
  const [showHallmark, setShowHallmark] = useState(false)
  const [pre1933Ack, setPre1933Ack] = useState(false)
  const [showPre1933, setShowPre1933] = useState(false)
  const [purityOverride, setPurityOverride] = useState<string>('')

  // cert lookup (2.3)
  const [lookup, setLookup] = useState<CertLookupValue | null>(null)

  // manual entry (paper money)
  const [denomination, setDenomination] = useState('')
  const [year, setYear] = useState('')
  const [condition, setCondition] = useState('')

  function resetEntry() {
    setValue('')
    setGrade(null)
    setHallmarkAck(false)
    setShowHallmark(false)
    setPre1933Ack(false)
    setShowPre1933(false)
    setPurityOverride('')
    setLookup(null)
    setDenomination('')
    setYear('')
    setCondition('')
  }

  useEffect(() => {
    if (isOpen) {
      setSelectedId(null)
      resetEntry()
    }
  }, [isOpen])

  const grouped = useMemo(() => {
    const groups: Record<Metal, CoinType[]> = {
      silver: [],
      gold: [],
      platinum: [],
      numismatic: [],
    }
    for (const c of coinTypes) groups[c.metal_type].push(c)
    for (const metal of METAL_ORDER) {
      groups[metal].sort((a, b) => a.name.localeCompare(b.name))
    }
    return groups
  }, [coinTypes])

  const selected = useMemo(
    () => coinTypes.find((c) => c.id === selectedId) ?? null,
    [coinTypes, selectedId],
  )

  function handleSelect(c: CoinType) {
    setSelectedId(c.id)
    resetEntry()
    // Gates fire on selection so the rep can't enter values first (2.2).
    if (c.is_pre1933_gold) setShowPre1933(true)
    else if (c.requires_hallmark_ack) setShowHallmark(true)
    if (c.allow_purity_override && c.purity_factor != null) {
      setPurityOverride(String(c.purity_factor))
    }
  }

  const numValue = parseFloat(value)
  const isManual = selected?.priced_by === 'manual'
  const needsGrade = selected?.metal_type === 'numismatic' && !isManual
  // Grading is open to every coin-unit item (spec: "extended to all graded
  // categories", 2026-08-30) — any coin can be slabbed. Scrap (by weight) and
  // paper money are not gradable. Grade stays REQUIRED only for numismatic.
  const gradable =
    selected !== null && !isManual && selected.priced_by !== 'weight_grams'
  // Slabbed on any coin opens the cert lookup + manual wholesale override;
  // numismatic items show it up front as before (lookup stands in for grade).
  const showLookup = needsGrade || (gradable && grade === 'slabbed')

  // Switching away from Slabbed hides the panel — its resolved price must not
  // keep pricing the line from behind a closed panel.
  useEffect(() => {
    if (!showLookup) setLookup(null)
  }, [showLookup])
  const overrideNum = parseFloat(purityOverride)
  const purityValid =
    !selected?.allow_purity_override ||
    (!Number.isNaN(overrideNum) && overrideNum > 0 && overrideNum <= 1)

  // Weight entry stays blocked until the hallmark popup is acknowledged (2.2)
  const entryBlocked =
    (selected?.requires_hallmark_ack === true && !hallmarkAck) ||
    (selected?.is_pre1933_gold === true && !pre1933Ack)

  // Graded/numismatic items may be priced by cert lookup instead of the
  // grade multiplier (2.3). A lookup that resolved to a price stands in for
  // the grade selection.
  const usingLookup = lookup?.price != null
  // A cert number identifies one specific slab, so a lookup-priced line is
  // always quantity 1 — ten identical graded coins are ten certs, ten lines.
  const qtyLocked = usingLookup && !isManual && selected?.priced_by !== 'weight_grams'
  const canAdd =
    selected !== null &&
    !entryBlocked &&
    purityValid &&
    (qtyLocked || (!Number.isNaN(numValue) && numValue > 0)) &&
    (!needsGrade || grade !== null || usingLookup) &&
    (!isManual || denomination.trim().length > 0)

  function handleAdd() {
    if (!selected || !canAdd) return
    const base = {
      coin_type_id: selected.id,
      name: selected.name,
      metal_type: selected.metal_type,
      unit_label: selected.unit_label,
      face_value: selected.face_value,
      fixed_multiplier: selected.fixed_multiplier,
      mult_circulated: selected.mult_circulated,
      mult_uncirculated: selected.mult_uncirculated,
      mult_slabbed: selected.mult_slabbed,
      oz_metal_per_unit: selected.oz_metal_per_unit,
      category: selected.category,
      premium_per_unit: selected.premium_per_unit,
      purity_factor: selected.purity_factor,
      ...(selected.allow_purity_override && !Number.isNaN(overrideNum)
        ? { purity_factor_used: overrideNum }
        : {}),
      ...(selected.requires_hallmark_ack ? { hallmark_acknowledged: true } : {}),
      ...(selected.is_pre1933_gold ? { pre1933_ack: true } : {}),
      ...(lookup
        ? {
            cert_number: lookup.certNumber || undefined,
            price_source: lookup.priceSource,
            cdn_price: lookup.result?.cdn_price,
            manual_price_override: lookup.manualOverride ?? undefined,
            lookup_value: lookup.price ?? undefined,
            ebay_low: lookup.result?.comps.low,
            ebay_median: lookup.result?.comps.median,
            ebay_high: lookup.result?.comps.high,
          }
        : {}),
    }

    if (isManual) {
      // Paper money: quantity is 1 unless the rep entered more; the value
      // field IS the offer (2.2).
      onAdd({
        ...base,
        priced_by: 'manual',
        quantity: 1,
        manual_offer: numValue,
        details: {
          denomination: denomination.trim(),
          year: year.trim(),
          condition: condition.trim(),
        },
      })
    } else if (selected.priced_by === 'weight_grams') {
      onAdd({ ...base, priced_by: 'weight_grams', weight_grams: numValue })
    } else if (selected.priced_by === 'times_face') {
      onAdd({
        ...base,
        priced_by: 'times_face',
        quantity: qtyLocked ? 1 : numValue,
        ...(grade ? { grade } : {}),
      })
    } else {
      onAdd({
        ...base,
        priced_by: 'each_metal',
        quantity: qtyLocked ? 1 : numValue,
        ...(grade ? { grade } : {}),
      })
    }
    onClose()
  }

  if (!isOpen) return null

  // --- blocking gates render over everything (2.2) ---
  if (showPre1933 && selected) {
    return (
      <Pre1933GoldStop
        itemName={selected.name}
        onAcknowledged={(at) => {
          setPre1933Ack(true)
          setShowPre1933(false)
          onPre1933Ack?.(at)
        }}
        onCancel={() => {
          setShowPre1933(false)
          setSelectedId(null)
        }}
      />
    )
  }

  if (showHallmark && selected) {
    return (
      <HallmarkAckModal
        itemName={selected.name}
        onAcknowledge={() => {
          setHallmarkAck(true)
          setShowHallmark(false)
        }}
        onCancel={() => {
          setShowHallmark(false)
          setSelectedId(null)
        }}
      />
    )
  }

  const inputLabel = isManual
    ? 'Offer ($)'
    : selected?.priced_by === 'weight_grams'
      ? `Weight (${selected.unit_label ?? 'grams'})`
      : 'Quantity'
  const inputIsDecimal = isManual || selected?.priced_by === 'weight_grams'

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="flex-1 bg-black/40"
      />

      <div className="bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[90dvh]">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add an item</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-500 hover:text-slate-700 min-h-11 min-w-11 text-2xl leading-none"
          >
            ×
          </button>
        </header>

        <div
          className="flex-1 overflow-y-auto px-4 py-3"
          style={{ overscrollBehavior: 'contain' }}
        >
          {METAL_ORDER.map((metal) => {
            const items = grouped[metal]
            if (items.length === 0) return null
            return (
              <section key={metal} className="mb-4 last:mb-0">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  {METAL_LABEL[metal]}
                </h3>
                <ul className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-md overflow-hidden">
                  {items.map((c) => {
                    const isSelected = c.id === selectedId
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(c)}
                          className={`w-full px-3 py-3 text-left flex items-center justify-between gap-3 min-h-12 ${
                            isSelected
                              ? 'bg-emerald-50 ring-1 ring-emerald-500'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-sm font-medium text-slate-900">
                            {c.name}
                            {c.is_pre1933_gold && (
                              <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wide">
                                Manager
                              </span>
                            )}
                          </span>
                          {c.premium_per_unit != null ? (
                            <span className="text-xs text-slate-500 shrink-0">
                              +{usd.format(c.premium_per_unit)} premium
                            </span>
                          ) : c.face_value ? (
                            <span className="text-xs text-slate-500 shrink-0">
                              {usd.format(c.face_value)} face
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>

        {selected && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 space-y-3">
            {selected.entry_note && (
              <div className="px-3 py-2 rounded-md bg-amber-50 border border-amber-300 text-xs text-amber-900">
                {selected.entry_note}
              </div>
            )}

            {selected.requires_hallmark_ack && hallmarkAck && (
              <div className="text-xs text-emerald-700 font-medium">
                Hallmark confirmed ✓
              </div>
            )}
            {selected.is_pre1933_gold && pre1933Ack && (
              <div className="text-xs text-emerald-700 font-medium">
                Manager approved Pre-1933 US Gold ✓
              </div>
            )}

            {showLookup && margins && (
              <div className="pb-1 border-b border-slate-200">
                <CertLookupPanel
                  marginPct={
                    margins.find((m) => m.category === (selected.category ?? 'numismatic'))
                      ?.margin_pct ?? 0.3
                  }
                  onChange={setLookup}
                  onAskManager={() => {
                    onClose()
                    onAskManager?.()
                  }}
                />
              </div>
            )}

            {gradable && (
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-1">
                  Grade
                  {!needsGrade && (
                    <span className="ml-1 font-normal text-slate-400">(optional)</span>
                  )}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {GRADES.map((g) => {
                    const isActive = grade === g.value
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setGrade(g.value)}
                        className={`min-h-12 px-2 rounded-md border text-sm font-medium ${
                          isActive
                            ? 'bg-emerald-600 border-emerald-700 text-white'
                            : 'bg-white border-slate-300 text-slate-700'
                        }`}
                        aria-pressed={isActive}
                      >
                        {g.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {selected.allow_purity_override && (
              <div>
                <label
                  htmlFor="purity-override"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Purity factor{' '}
                  <span className="font-normal text-slate-500">
                    (stored {selected.purity_factor ?? '—'}; edit if the piece
                    differs)
                  </span>
                </label>
                <input
                  id="purity-override"
                  type="text"
                  inputMode="decimal"
                  value={purityOverride}
                  onChange={(e) =>
                    setPurityOverride(e.target.value.replace(/[^0-9.]/g, ''))
                  }
                  className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
                />
                {!purityValid && (
                  <div className="mt-1 text-xs text-red-700">
                    Purity must be between 0 and 1 (e.g. 0.900 for 90% silver).
                  </div>
                )}
              </div>
            )}

            {isManual && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label
                    htmlFor="pm-denom"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    Denomination
                  </label>
                  <input
                    id="pm-denom"
                    type="text"
                    value={denomination}
                    onChange={(e) => setDenomination(e.target.value)}
                    placeholder="$20"
                    className="w-full min-h-11 px-2 rounded-md border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pm-year"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    Year
                  </label>
                  <input
                    id="pm-year"
                    type="text"
                    inputMode="numeric"
                    value={year}
                    onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
                    placeholder="1934"
                    className="w-full min-h-11 px-2 rounded-md border border-slate-300 bg-white text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pm-cond"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    Condition
                  </label>
                  <input
                    id="pm-cond"
                    type="text"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    placeholder="VF"
                    className="w-full min-h-11 px-2 rounded-md border border-slate-300 bg-white text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="add-coin-value"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                {inputLabel}
              </label>
              {qtyLocked ? (
                <div className="w-full min-h-11 px-3 py-2.5 rounded-md border border-slate-200 bg-slate-100 text-base text-slate-700">
                  1{' '}
                  <span className="text-xs text-slate-500">
                    — priced per certified coin; add each slab as its own line
                  </span>
                </div>
              ) : (
                <KeypadField
                  id="add-coin-value"
                  value={value}
                  onChange={setValue}
                  allowDecimal={inputIsDecimal}
                  ariaLabel={inputLabel}
                  keypadLabel={inputLabel}
                  placeholder={inputIsDecimal ? 'e.g. 23.4' : 'e.g. 10'}
                />
              )}
              {entryBlocked && (
                <div className="mt-1 text-xs text-amber-700 font-medium">
                  {selected.is_pre1933_gold
                    ? 'Manager approval required before this item can be added.'
                    : 'Acknowledge the hallmark check before entering weight.'}
                </div>
              )}
            </div>
          </div>
        )}

        <footer
          className="px-4 py-3 border-t border-slate-200 flex gap-2 bg-white"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="flex-1 min-h-12 py-3 rounded-md bg-emerald-600 text-white text-base font-semibold disabled:bg-slate-300 disabled:text-slate-500 hover:bg-emerald-700"
          >
            Add to Bag
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 px-4 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}
