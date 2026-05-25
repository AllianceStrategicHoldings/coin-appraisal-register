import { useEffect, useRef } from 'react'

interface NumericKeypadProps {
  isOpen: boolean
  value: string
  allowDecimal: boolean
  label?: string
  onChange: (next: string) => void
  onClose: () => void
}

const ROWS: Array<Array<'1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '0' | '.' | 'back'>> = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'back'],
]

export function NumericKeypad({
  isOpen,
  value,
  allowDecimal,
  label,
  onChange,
  onClose,
}: NumericKeypadProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        press('back')
        return
      }
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        press(e.key as '0')
        return
      }
      if (e.key === '.' && allowDecimal) {
        e.preventDefault()
        press('.')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, value, allowDecimal])

  function press(key: (typeof ROWS)[number][number]) {
    if (key === 'back') {
      onChange(value.slice(0, -1))
      return
    }
    if (key === '.') {
      if (!allowDecimal) return
      if (value.includes('.')) return
      onChange(value === '' ? '0.' : value + '.')
      return
    }
    if (value === '0') {
      onChange(key)
      return
    }
    onChange(value + key)
  }

  function handleClear() {
    onChange('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col">
      <button
        type="button"
        aria-label="Dismiss keypad"
        onClick={onClose}
        className="flex-1 bg-black/30"
      />
      <div
        ref={panelRef}
        className="bg-slate-100 border-t border-slate-300 shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="px-4 pt-3 pb-2 flex items-baseline justify-between gap-3">
          <span className="text-xs uppercase tracking-wide text-slate-600 font-semibold">
            {label ?? 'Enter value'}
          </span>
          <span className="text-2xl font-bold text-slate-900 tabular-nums">
            {value === '' ? '0' : value}
          </span>
        </div>
        <div className="px-3 pb-3 grid grid-cols-4 gap-2">
          <div className="col-span-3 grid grid-cols-3 gap-2">
            {ROWS.map((row, ri) =>
              row.map((key) => {
                if (key === '.' && !allowDecimal) {
                  return <div key={`${ri}-spacer`} aria-hidden="true" />
                }
                const display =
                  key === 'back' ? '⌫' : key === '.' ? '.' : key
                return (
                  <button
                    key={`${ri}-${key}`}
                    type="button"
                    onClick={() => press(key)}
                    className="h-14 rounded-lg bg-white border border-slate-300 text-2xl font-medium text-slate-900 active:bg-slate-200 select-none"
                    aria-label={
                      key === 'back' ? 'Backspace' : `Press ${key}`
                    }
                  >
                    {display}
                  </button>
                )
              }),
            )}
          </div>
          <div className="grid grid-rows-2 gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg bg-amber-100 border border-amber-300 text-sm font-semibold text-amber-800 active:bg-amber-200 select-none"
              aria-label="Clear"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-emerald-600 text-white text-sm font-semibold active:bg-emerald-700 select-none"
              aria-label="Done"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
