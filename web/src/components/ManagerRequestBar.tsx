// Permanent Ask Manager / Not Sure controls (spec 2.8: "permanent on every
// screen"). Sits above the screen's own action bar on every deal screen.

import type { ApprovalTrigger } from '../lib/approvalRequest'

interface ManagerRequestBarProps {
  onRequest: (trigger: ApprovalTrigger) => void
}

export function ManagerRequestBar({ onRequest }: ManagerRequestBarProps) {
  return (
    <div className="px-4 pt-2 pb-1 flex gap-2 border-b border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => onRequest('ask_manager')}
        className="flex-1 min-h-11 rounded-md border border-amber-400 bg-amber-50 text-amber-900 text-sm font-semibold hover:bg-amber-100"
      >
        Ask Manager
      </button>
      <button
        type="button"
        onClick={() => onRequest('not_sure_what_this_is')}
        className="flex-1 min-h-11 rounded-md border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-100"
      >
        Not Sure What This Is
      </button>
    </div>
  )
}
