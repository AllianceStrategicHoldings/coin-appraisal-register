// Client-side upload helper for cloud storage (SOW 2.12).
//
// Flow: request a presigned PUT URL from /api/presign, upload the file
// directly to R2, return the object key for the deal record. The PWA never
// sees storage credentials.

import { HttpError, NetworkError } from '../api/client'

export type UploadKind =
  | 'intake_lot'
  | 'dl_photo'
  | 'item_photo'
  | 'acceptance_lot'
  | 'signature'
  | 'offer_letter'

export interface UploadResult {
  objectKey: string
}

interface PresignResponse {
  uploadUrl: string
  objectKey: string
  expiresIn: number
}

const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 1500

async function presign(
  kind: UploadKind,
  dealId: string,
  contentType: string,
): Promise<PresignResponse> {
  let res: Response
  try {
    res = await fetch('/api/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, dealId, contentType }),
    })
  } catch {
    throw new NetworkError()
  }
  if (!res.ok) throw new HttpError(res.status, `presign failed (${res.status})`)
  return (await res.json()) as PresignResponse
}

async function putFile(uploadUrl: string, file: Blob, contentType: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    })
  } catch {
    throw new NetworkError()
  }
  if (!res.ok) throw new HttpError(res.status, `upload failed (${res.status})`)
}

/**
 * Upload a photo/PDF for a deal. Retries transient failures; a presigned URL
 * is requested fresh on each attempt so retries never race URL expiry.
 */
export async function uploadDealFile(
  kind: UploadKind,
  dealId: string,
  file: Blob,
  contentType: string,
): Promise<UploadResult> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { uploadUrl, objectKey } = await presign(kind, dealId, contentType)
      await putFile(uploadUrl, file, contentType)
      return { objectKey }
    } catch (err) {
      lastError = err
      // 4xx from presign means a caller bug, not a transient fault — don't retry.
      if (err instanceof HttpError && err.status >= 400 && err.status < 500) throw err
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt))
      }
    }
  }
  throw lastError
}
