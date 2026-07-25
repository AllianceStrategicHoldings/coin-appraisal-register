import { useState } from 'react'
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

  const display = value === '' ? (placeholder ?? '') : value
  const isPlaceholder = value === ''

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        className={
          className ??
          'w-full min-h-12 px-3 rounded-md border border-slate-300 bg-white text-base text-left'
        }
      >
        <span
          className={
            isPlaceholder
              ? 'text-slate-400'
              : 'text-slate-900 tabular-nums'
          }
        >
          {display || ' '}
        </span>
      </button>
      <NumericKeypad
        isOpen={open}
        value={value}
        allowDecimal={allowDecimal}
        label={keypadLabel}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
