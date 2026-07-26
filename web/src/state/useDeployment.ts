// Multi-location & roadshow deployment state (spec 2.11).
//
// The active location is a per-DEVICE setting (each iPad is deployed to a
// location), so it persists in localStorage rather than per-deal state.
// Event mode is likewise sticky "for the duration of the event" and is
// manager-PIN gated to turn on.

import { useCallback, useMemo, useState } from 'react'
import type { Location, LocationEvent } from '../api/types'

const LOCATION_KEY = 'car.deployment.locationId.v1'
const EVENT_KEY = 'car.deployment.eventId.v1'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // storage unavailable; in-memory state still updates
  }
}

export interface UseDeploymentResult {
  activeLocation: Location | null
  activeEvent: LocationEvent | null
  /** true while the app is in roadshow/event mode (2.11) */
  eventMode: boolean
  setLocationId: (id: string | null) => void
  /** null exits event mode */
  setEventId: (id: string | null) => void
  /** events available at the active location */
  eventsForLocation: LocationEvent[]
  /**
   * Reference zip for customer_zip_radius_miles: the event venue in event
   * mode, otherwise the store location (operator decision 2026-07-21).
   */
  referenceZip: string | null
}

export function useDeployment(locations: Location[]): UseDeploymentResult {
  const [locationId, setLocationIdState] = useState<string | null>(() => read(LOCATION_KEY))
  const [eventId, setEventIdState] = useState<string | null>(() => read(EVENT_KEY))

  // Fall back to the only location when just one is deployed, so a
  // single-store operator never has to pick.
  const activeLocation = useMemo(() => {
    if (locations.length === 0) return null
    const found = locations.find((l) => l.id === locationId)
    if (found) return found
    return locations.length === 1 ? locations[0] : null
  }, [locations, locationId])

  const eventsForLocation = useMemo(
    () => (activeLocation?.config_events ?? []).filter((e) => e.active !== false),
    [activeLocation],
  )

  const activeEvent = useMemo(
    () => eventsForLocation.find((e) => e.id === eventId) ?? null,
    [eventsForLocation, eventId],
  )

  const setLocationId = useCallback((id: string | null) => {
    setLocationIdState(id)
    write(LOCATION_KEY, id)
    // Leaving a location drops its event context.
    setEventIdState(null)
    write(EVENT_KEY, null)
  }, [])

  const setEventId = useCallback((id: string | null) => {
    setEventIdState(id)
    write(EVENT_KEY, id)
  }, [])

  const referenceZip = activeEvent?.venue_zip ?? activeLocation?.zip ?? null

  return {
    activeLocation,
    activeEvent,
    eventMode: activeEvent !== null,
    setLocationId,
    setEventId,
    eventsForLocation,
    referenceZip,
  }
}
