import type { CartLine, Grade, Margin, MarginCategory, Spot } from '../api/types'

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

function multiplierForLine(
  line: Extract<CartLine, { priced_by: 'times_face' }>,
): number | null {
  if (line.grade) {
    const byGrade: Record<Grade, number | undefined> = {
      circulated: line.mult_circulated,
      uncirculated: line.mult_uncirculated,
      slabbed: line.mult_slabbed,
    }
    return byGrade[line.grade] ?? null
  }
  return line.fixed_multiplier ?? null
}

export function valueLine(
  line: CartLine,
  spot: Spot | null,
  margins: Margin[],
): LineValuation | null {
  if (line.priced_by === 'times_face') {
    if (line.face_value == null) return null
    const mult = multiplierForLine(line)
    if (mult == null) return null
    const offer = line.quantity * line.face_value * mult
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

// --- Dual Pricing Engine (SOW 2.4) ----------------------------------------
// Each line carries a Max Payout (calculated ceiling = valueLine's offer) and
// a rep-entered Actual Offer. Negotiation Delta = Max Payout - Actual Offer.
// An untouched line's Actual Offer defaults to its Max Payout.

export interface DualLine {
  maxPayout: number
  /** effective Actual Offer: rep-entered (capped at max) or = maxPayout */
  actualOffer: number
  negotiationDelta: number
  /** true when the stored rep entry exceeded the current Max Payout and was capped */
  capped: boolean
}

export interface DualTotals {
  meltTotal: number
  totalMaxPayout: number
  totalActualOffer: number
  totalDelta: number
  /** Total Actual Offer relative to Total Max Payout (rep view only); null when max is 0 */
  offerPctOfMax: number | null
  hasUnpriceable: boolean
  unpriceableIds: Set<string>
}

export function dualPriceLine(
  line: CartLine,
  spot: Spot | null,
  margins: Margin[],
): DualLine | null {
  const v = valueLine(line, spot, margins)
  if (v === null) return null
  const maxPayout = v.offerValue
  const entered = line.actual_offer
  // Actual Offer must be <= Max Payout unless a manager override applies
  // (2.13, M3). Until the override mechanism lands, entries are capped.
  const actualOffer =
    entered == null ? maxPayout : Math.min(entered, maxPayout)
  return {
    maxPayout,
    actualOffer,
    negotiationDelta: maxPayout - actualOffer,
    capped: entered != null && entered > maxPayout,
  }
}

export function dualPriceBag(
  lines: CartLine[],
  spot: Spot | null,
  margins: Margin[],
): DualTotals {
  let melt = 0
  let max = 0
  let actual = 0
  const unpriceableIds = new Set<string>()
  for (const line of lines) {
    const v = valueLine(line, spot, margins)
    const d = dualPriceLine(line, spot, margins)
    if (v === null || d === null) {
      unpriceableIds.add(line.id)
      continue
    }
    melt += v.meltValue
    max += d.maxPayout
    actual += d.actualOffer
  }
  return {
    meltTotal: melt,
    totalMaxPayout: max,
    totalActualOffer: actual,
    totalDelta: max - actual,
    offerPctOfMax: max > 0 ? actual / max : null,
    hasUnpriceable: unpriceableIds.size > 0,
    unpriceableIds,
  }
}
