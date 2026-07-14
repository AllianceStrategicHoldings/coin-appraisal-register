import { useCallback, useEffect, useState } from 'react'
import type { CartLine, CartLineInput } from '../api/types'

const STORAGE_KEY = 'car.cart.v1'

function readInitial(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as CartLine[]) : []
  } catch {
    return []
  }
}

export interface UseCartResult {
  lines: CartLine[]
  addLine: (line: CartLineInput) => void
  removeLine: (id: string) => void
  updateLine: (id: string, value: number) => void
  /** Rep-entered Actual Offer for a line; null resets to "= Max Payout" (SOW 2.4) */
  setActualOffer: (id: string, value: number | null) => void
  clear: () => void
}

export function useCart(): UseCartResult {
  const [lines, setLines] = useState<CartLine[]>(readInitial)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  }, [lines])

  const addLine = useCallback((line: CartLineInput) => {
    setLines((prev) => [...prev, { ...line, id: crypto.randomUUID() } as CartLine])
  }, [])

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const updateLine = useCallback((id: string, value: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        if (l.priced_by === 'weight_grams') return { ...l, weight_grams: value }
        return { ...l, quantity: value }
      }),
    )
  }, [])

  const setActualOffer = useCallback((id: string, value: number | null) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, actual_offer: value } : l)),
    )
  }, [])

  const clear = useCallback(() => setLines([]), [])

  return { lines, addLine, removeLine, updateLine, setActualOffer, clear }
}
