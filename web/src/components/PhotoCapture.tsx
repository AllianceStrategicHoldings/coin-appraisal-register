// Shared photo capture + cloud upload control (SOW 2.1 / 2.6 / 2.12).
// Captures via the iPad camera, uploads through the R2 presign flow, and
// degrades to a 'pending_upload' state when storage is unreachable so the
// deal flow is never blocked by connectivity.

import { useRef } from 'react'
import { uploadDealFile, type UploadKind } from '../lib/storage'
import type { PhotoState } from '../state/useIntake'

export function PhotoCapture({
  label,
  kind,
  dealDraftId,
  photo,
  onChange,
}: {
  label: string
  kind: UploadKind
  dealDraftId: string
  photo: PhotoState
  onChange: (p: PhotoState) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    const previewUrl = URL.createObjectURL(file)
    onChange({ status: 'uploading', objectKey: null, previewUrl })
    try {
      const { objectKey } = await uploadDealFile(kind, dealDraftId, file, file.type)
      onChange({ status: 'uploaded', objectKey, previewUrl })
    } catch {
      onChange({ status: 'pending_upload', objectKey: null, previewUrl })
    }
  }

  return (
    <div>
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="min-h-11 px-4 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-100"
        >
          {photo.status === 'none' ? 'Take photo' : 'Retake'}
        </button>
        {photo.previewUrl && (
          <img
            src={photo.previewUrl}
            alt={`${label} preview`}
            className="h-11 w-11 rounded object-cover border border-slate-200"
          />
        )}
        {photo.status === 'uploading' && (
          <span className="text-xs text-slate-500">Uploading…</span>
        )}
        {photo.status === 'uploaded' && (
          <span className="text-xs text-emerald-700 font-medium">Uploaded ✓</span>
        )}
        {photo.status === 'pending_upload' && (
          <span className="text-xs text-amber-700 font-medium">
            Saved — will upload when storage reconnects
          </span>
        )}
      </div>
      <input
        ref={inputRef}
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
  )
}
