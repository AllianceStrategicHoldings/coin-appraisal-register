export type Metal = 'silver' | 'gold' | 'platinum' | 'numismatic'
export type PricedBy = 'each_metal' | 'weight_grams' | 'times_face' | 'manual'
export type MarginCategory = 'silver' | 'gold' | 'platinum' | 'numismatic'
export type Grade = 'circulated' | 'uncirculated' | 'slabbed'

export interface CoinType {
  id: string
  name: string
  metal_type: Metal
  priced_by: PricedBy
  unit_label: string
  face_value?: number
  fixed_multiplier?: number
  mult_circulated?: number
  mult_uncirculated?: number
  mult_slabbed?: number
  oz_metal_per_unit?: number
  category?: MarginCategory
  /** bullion: unit x spot + this premium per unit (2.2) */
  premium_per_unit?: number
  /** sterling / foreign silver purity (2.2) */
  purity_factor?: number
  /** sterling: hallmark popup must be acknowledged before weight entry (2.2) */
  requires_hallmark_ack?: boolean
  /** full-screen red stop + manager PIN before this item can be added (2.2) */
  is_pre1933_gold?: boolean
  /** foreign silver: rep may override the stored purity factor (2.2) */
  allow_purity_override?: boolean
  /** static note shown on the entry screen (e.g. paper-money review note) */
  entry_note?: string
}

export interface Rep {
  id: string
  name: string
}

export interface Spot {
  gold: number
  silver: number
  platinum: number
}

export interface Margin {
  category: MarginCategory
  margin_pct: number
}

export interface ConfigLoadResponse {
  coin_types: CoinType[]
  reps: Rep[]
  spot?: Spot
  margins?: Margin[]
}

export type BulkCalcRequestItem =
  | { coin_type_id: string; quantity: number; grade?: Grade }
  | { coin_type_id: string; weight_grams: number }

export interface BulkCalcLine {
  coin_type_id: string
  unit_value: number
  line_total: number
  name?: string
  units?: number
}

export interface BulkCalcResponse {
  spot: Spot
  lines: BulkCalcLine[]
  total: number
  melt_total?: number
}

// --- Customer intake (SOW 2.1) -------------------------------------------

export interface CustomerLookupRequest {
  phone: string
  /** ISO date, e.g. 1980-01-31 */
  dob: string
}

export interface CustomerPriorDeal {
  deal_number?: string
  date?: string
  total_offer?: number
  status?: string
}

export interface CustomerLookupResponse {
  matched: boolean
  customer?: {
    id: string
    name: string
    zip?: string
    dl_number?: string
    tcpa_opt_in?: boolean
  }
  prior_deals?: CustomerPriorDeal[]
}

interface CartLineBase {
  id: string
  coin_type_id: string
  name: string
  metal_type: Metal
  unit_label: string
  /**
   * Rep-entered Actual Offer for the line (SOW 2.4). Null/undefined means
   * "not negotiated" and defaults to the line's Max Payout. Must be
   * <= Max Payout unless a manager override applies (2.13).
   */
  actual_offer?: number | null
  face_value?: number
  fixed_multiplier?: number
  mult_circulated?: number
  mult_uncirculated?: number
  mult_slabbed?: number
  oz_metal_per_unit?: number
  category?: MarginCategory
  /** bullion premium per unit, from Config_CoinTypes (2.2) */
  premium_per_unit?: number
  /** stored purity factor for sterling / foreign silver (2.2) */
  purity_factor?: number
  /** rep's manual purity override; wins over purity_factor when set (2.2) */
  purity_factor_used?: number
  /** true once the rep acknowledged the sterling hallmark popup (2.2) */
  hallmark_acknowledged?: boolean
  /** true once a manager PIN cleared the Pre-1933 US Gold stop (2.2 / 3.2) */
  pre1933_ack?: boolean
}

/** Paper money manual entry (2.2) */
export interface ManualEntryDetails {
  denomination: string
  year: string
  condition: string
}

export type CartLine =
  | (CartLineBase & { priced_by: 'each_metal'; quantity: number })
  | (CartLineBase & { priced_by: 'weight_grams'; weight_grams: number })
  | (CartLineBase & { priced_by: 'times_face'; quantity: number; grade?: Grade })
  | (CartLineBase & {
      priced_by: 'manual'
      quantity: number
      manual_offer: number
      details: ManualEntryDetails
    })

type DistributiveOmit<T, K extends keyof CartLineBase | keyof CartLine> =
  T extends unknown ? Omit<T, K> : never

export type CartLineInput = DistributiveOmit<CartLine, 'id'>

export function cartLineToRequestItem(line: CartLine): BulkCalcRequestItem {
  if (line.priced_by === 'weight_grams') {
    return { coin_type_id: line.coin_type_id, weight_grams: line.weight_grams }
  }
  if (line.priced_by === 'times_face' && line.grade) {
    return { coin_type_id: line.coin_type_id, quantity: line.quantity, grade: line.grade }
  }
  return { coin_type_id: line.coin_type_id, quantity: line.quantity }
}
