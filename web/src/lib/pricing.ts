import type { CartLine, Margin, MarginCategory, Spot } from '../api/types'

export interface LineValuation {
  meltValue: number
  offerValue: number
}

export interface BagTotals {
  meltTotal: number
  offerTotal: number
  hasUnpriceable: boolean
  unpriceableIds: Set<string>
}

function spotForMetal(spot: Spot, metal: 'silver' | 'gold' | 'platinum'): number {
  return spot[metal]
}

function marginForCategory(margins: Margin[], category: MarginCategory): number | null {
  const m = margins.find((row) => row.category === category)
  return m ? m.margin_pct : null
}

export function valueLine(
  line: CartLine,
  spot: Spot | null,
  margins: Margin[],
): LineValuation | null {
  if (line.priced_by === 'times_face') {
    if (line.face_value == null || line.fixed_multiplier == null) return null
    const offer = line.quantity * line.face_value * line.fixed_multiplier
    return { meltValue: 0, offerValue: offer }
  }

  if (!spot) return null
  if (line.metal_type === 'numismatic') return null
  if (line.oz_metal_per_unit == null) return null

  const category: MarginCategory = line.category ?? line.metal_type
  const marginPct = marginForCategory(margins, category)
  if (marginPct == null) return null

  const units =
    line.priced_by === 'each_metal' ? line.quantity : line.weight_grams
  const melt = units * line.oz_metal_per_unit * spotForMetal(spot, line.metal_type)
  return { meltValue: melt, offerValue: melt * marginPct }
}

export function valueBag(
  lines: CartLine[],
  spot: Spot | null,
  margins: Margin[],
): BagTotals {
  let melt = 0
  let offer = 0
  const unpriceableIds = new Set<string>()
  for (const line of lines) {
    const v = valueLine(line, spot, margins)
    if (v === null) {
      unpriceableIds.add(line.id)
      continue
    }
    melt += v.meltValue
    offer += v.offerValue
  }
  return {
    meltTotal: melt,
    offerTotal: offer,
    hasUnpriceable: unpriceableIds.size > 0,
    unpriceableIds,
  }
}
