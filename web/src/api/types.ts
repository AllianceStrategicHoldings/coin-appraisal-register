export type Metal = 'silver' | 'gold' | 'platinum' | 'numismatic'
export type PricedBy = 'each_metal' | 'weight_grams' | 'times_face'
export type MarginCategory = 'silver' | 'gold' | 'platinum' | 'numismatic'

export interface CoinType {
  id: string
  name: string
  metal_type: Metal
  priced_by: PricedBy
  unit_label: string
  face_value?: number
  fixed_multiplier?: number
  oz_metal_per_unit?: number
  category?: MarginCategory
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
  | { coin_type_id: string; quantity: number }
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

interface CartLineBase {
  id: string
  coin_type_id: string
  name: string
  metal_type: Metal
  unit_label: string
  face_value?: number
  fixed_multiplier?: number
  oz_metal_per_unit?: number
  category?: MarginCategory
}

export type CartLine =
  | (CartLineBase & { priced_by: 'each_metal'; quantity: number })
  | (CartLineBase & { priced_by: 'weight_grams'; weight_grams: number })
  | (CartLineBase & { priced_by: 'times_face'; quantity: number })

type DistributiveOmit<T, K extends keyof CartLineBase | keyof CartLine> =
  T extends unknown ? Omit<T, K> : never

export type CartLineInput = DistributiveOmit<CartLine, 'id'>

export function cartLineToRequestItem(line: CartLine): BulkCalcRequestItem {
  if (line.priced_by === 'weight_grams') {
    return { coin_type_id: line.coin_type_id, weight_grams: line.weight_grams }
  }
  return { coin_type_id: line.coin_type_id, quantity: line.quantity }
}
