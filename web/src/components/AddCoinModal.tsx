import { useEffect, useMemo, useState } from 'react'
import type { CartLineInput, CoinType, Metal } from '../api/types'

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
}

export function AddCoinModal({
  isOpen,
  onClose,
  coinTypes,
  onAdd,
}: AddCoinModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [value, setValue] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      setSelectedId(null)
      setValue('')
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

  const numValue = parseFloat(value)
  const canAdd =
    selected !== null && !Number.isNaN(numValue) && numValue > 0

  function handleAdd() {
    if (!selected || !canAdd) return
    const base = {
      coin_type_id: selected.id,
      name: selected.name,
      metal_type: selected.metal_type,
      unit_label: selected.unit_label,
      face_value: selected.face_value,
      fixed_multiplier: selected.fixed_multiplier,
      oz_metal_per_unit: selected.oz_metal_per_unit,
      category: selected.category,
    }
    if (selected.priced_by === 'weight_grams') {
      onAdd({ ...base, priced_by: 'weight_grams', weight_grams: numValue })
    } else if (selected.priced_by === 'times_face') {
      onAdd({ ...base, priced_by: 'times_face', quantity: numValue })
    } else {
      onAdd({ ...base, priced_by: 'each_metal', quantity: numValue })
    }
    onClose()
  }

  if (!isOpen) return null

  const inputLabel =
    selected?.priced_by === 'weight_grams' ? 'Weight (grams)' : 'Quantity'
  const inputIsDecimal = selected?.priced_by === 'weight_grams'

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
          <h2 className="text-lg font-semibold text-slate-900">Add a coin</h2>
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
                          onClick={() => setSelectedId(c.id)}
                          className={`w-full px-3 py-3 text-left flex items-center justify-between gap-3 min-h-12 ${
                            isSelected
                              ? 'bg-emerald-50 ring-1 ring-emerald-500'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-sm font-medium text-slate-900">
                            {c.name}
                          </span>
                          {c.face_value ? (
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
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
            <label
              htmlFor="add-coin-value"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              {inputLabel}
            </label>
            <input
              id="add-coin-value"
              type="text"
              autoFocus
              inputMode={inputIsDecimal ? 'decimal' : 'numeric'}
              pattern={inputIsDecimal ? '[0-9]*\\.?[0-9]*' : '[0-9]*'}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={value}
              onChange={(e) => {
                const next = e.target.value
                const ok = inputIsDecimal
                  ? /^[0-9]*\.?[0-9]*$/.test(next)
                  : /^[0-9]*$/.test(next)
                if (ok) setValue(next)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canAdd) handleAdd()
              }}
              placeholder={inputIsDecimal ? 'e.g. 23.4' : 'e.g. 10'}
              className="w-full min-h-12 px-3 rounded-md border border-slate-300 bg-white text-base"
            />
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
