import { useEffect, useState } from 'react'
import { NumericKeypad } from './NumericKeypad'

interface KeypadFieldProps {
  /** associates a visible <label htmlFor> with the field trigger */
  id?: string
  value: string
  onChange: (next: string) => void
  allowDecimal: boolean
  ariaLabel: string
  keypadLabel?: string
  placeholder?: string
  className?: string
  autoOpen?: boolean
}

export function KeypadField({
  id,
  value,
  onChange,
  allowDecimal,
  ariaLabel,
  keypadLabel,
  placeholder,
  className,
  autoOpen = false,
}: KeypadFieldProps) {
  const [open, setOpen] = useState(autoOpen)

  // While the keypad is open it owns a DRAFT string. Callers usually store a
  // number, and round-tripping through one destroys in-progress input: "240."
  // becomes 240 becomes "240", so a decimal point can never be typed. The
  // draft also keeps a rejected keystroke visible (e.g. an offer above Max
  // Payout) instead of the keypad appearing dead.
  const [draft, setDraft] = useState(value)

  // Re-sync while closed so the field always reflects the committed value;
  // while open, the draft is authoritative.
  useEffect(() => {
    if (!open) setDraft(value)
  }, [value, open])

  const shown = open ? draft : value
  const isPlaceholder = shown === ''
  const display = isPlaceholder ? (placeholder ?? '') : shown

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={() => {
          setDraft(value)
          setOpen(true)
        }}
        aria-label={ariaLabel}
        className={
          className ??
          'w-full min-h-12 px-3 rounded-md border border-slate-300 bg-white text-base text-left'
        }
      >
        <span
          className={isPlaceholder ? 'text-slate-400' : 'text-slate-900 tabular-nums'}
        >
          {display || ' '}
        </span>
      </button>
      <NumericKeypad
        isOpen={open}
        value={draft}
        allowDecimal={allowDecimal}
        label={keypadLabel}
        onChange={(next) => {
          setDraft(next)
          onChange(next)
        }}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
