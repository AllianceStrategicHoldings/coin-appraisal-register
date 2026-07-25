// Sterling hallmark acknowledgment (spec 2.2). Blocks weight entry until the
// rep confirms they checked the piece for a sterling hallmark — the common
// costly mistake is weighing silver-plate as sterling.

interface HallmarkAckModalProps {
  itemName: string
  onAcknowledge: () => void
  onCancel: () => void
}

export function HallmarkAckModal({
  itemName,
  onAcknowledge,
  onCancel,
}: HallmarkAckModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-6">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="text-4xl mb-3" aria-hidden="true">🔍</div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Check the hallmark first
        </h2>
        <p className="text-sm text-slate-600 mb-3">
          Before weighing <span className="font-semibold">{itemName}</span>,
          confirm the piece is actually sterling. Look for a hallmark reading:
        </p>
        <ul className="text-sm text-slate-700 mb-4 space-y-1 bg-slate-50 rounded-md p-3 border border-slate-200">
          <li>· <strong>STERLING</strong></li>
          <li>· <strong>925</strong> or <strong>.925</strong></li>
          <li>· <strong>925/1000</strong></li>
        </ul>
        <p className="text-xs text-slate-500 mb-5">
          Marks like <strong>EPNS</strong>, <strong>silver plate</strong>, or no
          mark at all are <strong>not</strong> sterling and must not be weighed
          as sterling. If you are unsure, use Ask Manager.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 px-4 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAcknowledge}
            className="flex-1 min-h-12 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
          >
            Hallmark confirmed — continue
          </button>
        </div>
      </div>
    </div>
  )
}
