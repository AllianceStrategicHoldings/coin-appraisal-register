// Deployment settings: which location this iPad is operating at, and the
// manager-PIN-gated roadshow event mode toggle (spec 2.11).

import { useState } from 'react'
import type { UseDeploymentResult } from '../state/useDeployment'
import type { Location } from '../api/types'
import { ManagerPinModal } from './ManagerPinModal'

interface DeploymentModalProps {
  locations: Location[]
  deployment: UseDeploymentResult
  onClose: () => void
}

export function DeploymentModal({
  locations,
  deployment,
  onClose,
}: DeploymentModalProps) {
  // Entering event mode needs a manager PIN; leaving it does not.
  const [pendingEventId, setPendingEventId] = useState<string | null>(null)

  if (pendingEventId) {
    return (
      <ManagerPinModal
        title="Enter Event Mode"
        message="A manager must approve switching this device into roadshow event mode. Deals will be tagged to the event until it is switched off."
        onApproved={() => {
          deployment.setEventId(pendingEventId)
          setPendingEventId(null)
          onClose()
        }}
        onCancel={() => setPendingEventId(null)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-2xl shadow-2xl max-h-[90dvh] flex flex-col">
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Deployment</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-500 hover:text-slate-700 min-h-11 min-w-11 text-2xl leading-none"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <label
              htmlFor="deploy-location"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Location
            </label>
            {locations.length === 0 ? (
              <p className="text-sm text-slate-500">
                No locations configured yet. Deals will record without a
                location until Config_Locations is populated.
              </p>
            ) : (
              <select
                id="deploy-location"
                value={deployment.activeLocation?.id ?? ''}
                onChange={(e) => deployment.setLocationId(e.target.value || null)}
                className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
              >
                <option value="">Select location…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.zip ? ` (${l.zip})` : ''}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Every deal on this device is tagged to this location.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <span className="block text-sm font-medium text-slate-700 mb-1">
              Roadshow event mode
            </span>
            {deployment.eventMode ? (
              <>
                <div className="px-3 py-2 rounded-md bg-indigo-50 border border-indigo-200 text-sm text-indigo-900 mb-2">
                  Currently in event mode:{' '}
                  <span className="font-semibold">{deployment.activeEvent?.name}</span>
                  {deployment.activeEvent?.venue_zip && (
                    <span className="text-indigo-700">
                      {' '}· venue {deployment.activeEvent.venue_zip}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    deployment.setEventId(null)
                    onClose()
                  }}
                  className="min-h-11 px-4 rounded-md border border-slate-300 text-slate-700 text-sm hover:bg-slate-100"
                >
                  Exit event mode
                </button>
              </>
            ) : deployment.eventsForLocation.length === 0 ? (
              <p className="text-sm text-slate-500">
                No events configured for this location.
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-2">
                  Requires a manager PIN. Deals are tagged with the event and
                  travel distance is measured from the venue.
                </p>
                <ul className="space-y-2">
                  {deployment.eventsForLocation.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setPendingEventId(e.id)}
                        className="w-full text-left px-3 py-2 rounded-md border border-slate-300 hover:bg-slate-50"
                      >
                        <div className="text-sm font-medium text-slate-900">{e.name}</div>
                        <div className="text-xs text-slate-500">
                          {e.start_date} → {e.end_date}
                          {e.venue_zip ? ` · venue ${e.venue_zip}` : ''}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        <footer
          className="px-5 py-4 border-t border-slate-200"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-12 rounded-md bg-slate-900 text-white font-semibold hover:bg-slate-800"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  )
}
