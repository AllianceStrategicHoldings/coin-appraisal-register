// Customer intake state (SOW 2.1). All five required fields must be complete
// before the calculator opens; DOB under 18 is a hard block with no override.

import { useCallback, useMemo, useState } from 'react'
import type { CustomerLookupResponse } from '../api/types'

const DRAFT_KEY = 'car.intake.v1'

export type PhotoStatus = 'none' | 'uploading' | 'uploaded' | 'pending_upload'

export type SellingReason =
  | 'estate'
  | 'divorce'
  | 'debt'
  | 'cleanup'
  | 'investor'
  | 'other'
export type ReferralSource = 'google' | 'yelp' | 'friend' | 'drive_by' | 'other'

export const SELLING_REASONS: Array<{ value: SellingReason; label: string }> = [
  { value: 'estate', label: 'Estate' },
  { value: 'divorce', label: 'Divorce' },
  { value: 'debt', label: 'Debt' },
  { value: 'cleanup', label: 'Cleanup' },
  { value: 'investor', label: 'Investor' },
  { value: 'other', label: 'Other' },
]

export const REFERRAL_SOURCES: Array<{ value: ReferralSource; label: string }> = [
  { value: 'google', label: 'Google' },
  { value: 'yelp', label: 'Yelp' },
  { value: 'friend', label: 'Friend' },
  { value: 'drive_by', label: 'Drive-by' },
  { value: 'other', label: 'Other' },
]

export interface IntakeFields {
  name: string
  phone: string
  /** ISO date from <input type="date"> */
  dob: string
  zip: string
  tcpaOptIn: boolean
  dlNumber: string
  /** operator analytics fields, asked at intake (2026-07-20 addition) */
  sellingReason: SellingReason | ''
  referralSource: ReferralSource | ''
}

/** Rep-entered deal-level observations (2026-07-20 addition) */
export interface DealExtras {
  estimatedCollectionAge: string
  competitorOffersReceived: boolean | null
  competitorOfferAmount: string
}

export interface PhotoState {
  status: PhotoStatus
  /** R2 object key once uploaded; null while pending */
  objectKey: string | null
  /** local preview URL (object URL) for the captured file */
  previewUrl: string | null
}

const EMPTY_FIELDS: IntakeFields = {
  name: '',
  phone: '',
  dob: '',
  zip: '',
  tcpaOptIn: false,
  dlNumber: '',
  sellingReason: '',
  referralSource: '',
}

const EMPTY_EXTRAS: DealExtras = {
  estimatedCollectionAge: '',
  competitorOffersReceived: null,
  competitorOfferAmount: '',
}

const EMPTY_PHOTO: PhotoState = { status: 'none', objectKey: null, previewUrl: null }

export function ageFromDob(dobIso: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dobIso)) return null
  const dob = new Date(`${dobIso}T00:00:00`)
  if (Number.isNaN(dob.getTime())) return null
  let age = now.getFullYear() - dob.getFullYear()
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
  if (beforeBirthday) age -= 1
  return age
}

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

function loadDraft(): { fields: IntakeFields; dealDraftId: string } {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { fields: IntakeFields; dealDraftId: string }
      if (parsed?.fields && parsed?.dealDraftId) {
        // merge so drafts saved before new fields existed pick up defaults
        return {
          fields: { ...EMPTY_FIELDS, ...parsed.fields },
          dealDraftId: parsed.dealDraftId,
        }
      }
    }
  } catch {
    // corrupted/unavailable draft — start fresh
  }
  return { fields: { ...EMPTY_FIELDS }, dealDraftId: crypto.randomUUID() }
}

export interface UseIntakeResult {
  fields: IntakeFields
  setField: <K extends keyof IntakeFields>(key: K, value: IntakeFields[K]) => void
  /** client-side draft id used to key photo uploads before the deal record exists */
  dealDraftId: string
  lotPhoto: PhotoState
  setLotPhoto: (p: PhotoState) => void
  dlPhoto: PhotoState
  setDlPhoto: (p: PhotoState) => void
  lookup: CustomerLookupResponse | null
  setLookup: (r: CustomerLookupResponse | null) => void
  /** rep-entered deal-level observations (collection age, competitor offers) */
  dealExtras: DealExtras
  setDealExtra: <K extends keyof DealExtras>(key: K, value: DealExtras[K]) => void
  /** age in whole years, or null while DOB incomplete */
  age: number | null
  /** DOB entered and under 18 — hard stop, no override (2.1) */
  isUnder18: boolean
  /** every gate to open the calculator */
  missing: string[]
  isComplete: boolean
  reset: () => void
}

export function useIntake(): UseIntakeResult {
  const [{ fields, dealDraftId }, setDraft] = useState(loadDraft)
  const [lotPhoto, setLotPhoto] = useState<PhotoState>(EMPTY_PHOTO)
  const [dlPhoto, setDlPhoto] = useState<PhotoState>(EMPTY_PHOTO)
  const [lookup, setLookup] = useState<CustomerLookupResponse | null>(null)
  const [dealExtras, setDealExtras] = useState<DealExtras>({ ...EMPTY_EXTRAS })

  const setDealExtra = useCallback(
    <K extends keyof DealExtras>(key: K, value: DealExtras[K]) => {
      setDealExtras((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const setField = useCallback(
    <K extends keyof IntakeFields>(key: K, value: IntakeFields[K]) => {
      setDraft((prev) => {
        const next = { ...prev, fields: { ...prev.fields, [key]: value } }
        try {
          sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next))
        } catch {
          // sessionStorage unavailable; in-memory state still updates
        }
        return next
      })
    },
    [],
  )

  const reset = useCallback(() => {
    try {
      sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      // ignore
    }
    setDraft({ fields: { ...EMPTY_FIELDS }, dealDraftId: crypto.randomUUID() })
    setLotPhoto(EMPTY_PHOTO)
    setDlPhoto(EMPTY_PHOTO)
    setLookup(null)
    setDealExtras({ ...EMPTY_EXTRAS })
  }, [])

  const age = useMemo(() => ageFromDob(fields.dob), [fields.dob])
  const isUnder18 = age !== null && age < 18

  const missing = useMemo(() => {
    const out: string[] = []
    if (fields.name.trim().length < 2) out.push('Customer name')
    if (normalizePhone(fields.phone).length < 10) out.push('Phone (10 digits)')
    if (age === null) out.push('Date of birth')
    if (!/^\d{5}$/.test(fields.zip.trim())) out.push('Zip (5 digits)')
    if (!fields.tcpaOptIn) out.push('TCPA consent')
    if (fields.dlNumber.trim().length < 4) out.push("Driver's license number")
    if (!fields.sellingReason) out.push('Selling reason')
    if (!fields.referralSource) out.push('Referral source')
    if (lotPhoto.status === 'none') out.push('Lot photo')
    if (dlPhoto.status === 'none') out.push("Driver's license photo")
    return out
  }, [fields, age, lotPhoto.status, dlPhoto.status])

  const isComplete = missing.length === 0 && !isUnder18

  return {
    fields,
    setField,
    dealDraftId,
    lotPhoto,
    setLotPhoto,
    dlPhoto,
    setDlPhoto,
    lookup,
    setLookup,
    dealExtras,
    setDealExtra,
    age,
    isUnder18,
    missing,
    isComplete,
    reset,
  }
}
