// Ask Manager / "Not Sure What This Is" request composer (spec 2.8).
//
// Ask Manager: rep writes a timestamped note; submitting freezes the deal.
// Not Sure: rep photographs the item and searches Config_CoinTypes reference
// content to try to identify it before escalating.

import { useMemo, useRef, useState } from 'react'
import type { CoinType } from '../api/types'
import { uploadDealFile } from '../lib/storage'
import type { ApprovalTrigger } from '../lib/approvalRequest'

interface ManagerRequestModalProps {
  trigger: ApprovalTrigger
  dealDraftId: string
  coinTypes: CoinType[]
  onCancel: () => void
  onSubmit: (input: {
    note: string
    itemDescription: string
    itemPhotoKey: string | null
  }) => void
}

export function ManagerRequestModal({
  trigger,
  dealDraftId,
  coinTypes,
  onCancel,
  onSubmit,
}: ManagerRequestModalProps) {
  const isNotSure = trigger === 'not_sure_what_this_is'
  const [note, setNote] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [search, setSearch] = useState('')
  const [photoKey, setPhotoKey] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoState, setPhotoState] = useState<'none' | 'uploading' | 'done' | 'pending'>(
    'none',
  )
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Reference search over Config_CoinTypes (2.8) — name or category.
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []
    return coinTypes
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.category ?? '').toLowerCase().includes(q) ||
          c.metal_type.toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [search, coinTypes])

  async function handleFile(file: File) {
    setPhotoUrl(URL.createObjectURL(file))
    setPhotoState('uploading')
    try {
      const { objectKey } = await uploadDealFile(
        'item_photo',
        dealDraftId,
        file,
        file.type,
      )
      setPhotoKey(objectKey)
      setPhotoState('done')
    } catch {
      setPhotoKey(null)
      setPhotoState('pending')
    }
  }

  const canSubmit = isNotSure
    ? (photoState === 'done' || photoState === 'pending') && !submitting
    : note.trim().length > 0 && !submitting

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl shadow-2xl max-h-[92dvh] flex flex-col">
        <header className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {isNotSure ? 'Not sure what this is' : 'Ask a manager'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isNotSure
              ? 'Photograph the item and search the reference list. A manager will identify it.'
              : 'The deal pauses until a manager responds.'}
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isNotSure && (
            <>
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-1">
                  Photo of the item
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="min-h-11 px-4 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-100"
                  >
                    {photoState === 'none' ? 'Take photo' : 'Retake'}
                  </button>
                  {photoUrl && (
                    <img
                      src={photoUrl}
                      alt="Item preview"
                      className="h-11 w-11 rounded object-cover border border-slate-200"
                    />
                  )}
                  {photoState === 'uploading' && (
                    <span className="text-xs text-slate-500">Uploading…</span>
                  )}
                  {photoState === 'done' && (
                    <span className="text-xs text-emerald-700 font-medium">Uploaded ✓</span>
                  )}
                  {photoState === 'pending' && (
                    <span className="text-xs text-amber-700 font-medium">
                      Saved — sends when storage reconnects
                    </span>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void handleFile(f)
                    e.target.value = ''
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="ns-search"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Search the reference list
                </label>
                <input
                  id="ns-search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="e.g. eagle, sterling, gold"
                  className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
                />
                {search.trim().length >= 2 && (
                  <ul className="mt-2 border border-slate-200 rounded-md divide-y divide-slate-100 max-h-44 overflow-y-auto">
                    {matches.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-slate-500">
                        No match — a manager will identify it.
                      </li>
                    ) : (
                      matches.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => setItemDescription(c.name)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex justify-between gap-2"
                          >
                            <span className="text-slate-900">{c.name}</span>
                            <span className="text-xs text-slate-400 shrink-0">
                              {c.metal_type}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>

              <div>
                <label
                  htmlFor="ns-desc"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  What it looks like{' '}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="ns-desc"
                  type="text"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="markings, size, colour"
                  className="w-full min-h-11 px-3 rounded-md border border-slate-300 bg-white text-base"
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="mr-note"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Note for the manager
              {!isNotSure && <span className="text-red-600"> *</span>}
            </label>
            <textarea
              id="mr-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isNotSure
                  ? 'Anything else the manager should know'
                  : 'What do you need help with?'
              }
              className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-base"
            />
          </div>
        </div>

        <footer
          className="px-5 py-4 border-t border-slate-200 flex gap-2"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 px-4 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              setSubmitting(true)
              onSubmit({ note: note.trim(), itemDescription: itemDescription.trim(), itemPhotoKey: photoKey })
            }}
            className="flex-1 min-h-12 rounded-md bg-amber-600 text-white text-base font-semibold disabled:bg-slate-300 disabled:text-slate-500 hover:bg-amber-700"
          >
            {submitting ? 'Sending…' : 'Send to manager'}
          </button>
        </footer>
      </div>
    </div>
  )
}
