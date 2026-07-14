// Presigned-URL signing endpoint for Cloudflare R2 (SOW 2.12).
//
// The PWA never holds R2 credentials: it POSTs here, receives a short-lived
// presigned PUT URL, and uploads the file directly to the bucket. Runs as a
// Vercel Edge Function; R2_* secrets come from Vercel env vars.
//
// POST { kind, dealId, contentType }
//  -> { uploadUrl, objectKey, expiresIn }

import { AwsClient } from 'aws4fetch'

export const config = { runtime: 'edge' }

// Object kinds map 1:1 to the deal-record URL fields in supabase/deal_log.
const KINDS: Record<string, { prefix: string; types: string[] }> = {
  intake_lot:     { prefix: 'intake-lot',     types: ['image/jpeg', 'image/png', 'image/webp'] },
  dl_photo:       { prefix: 'dl',             types: ['image/jpeg', 'image/png', 'image/webp'] },
  item_photo:     { prefix: 'items',          types: ['image/jpeg', 'image/png', 'image/webp'] },
  acceptance_lot: { prefix: 'acceptance-lot', types: ['image/jpeg', 'image/png', 'image/webp'] },
  signature:      { prefix: 'signatures',     types: ['image/png'] },
  offer_letter:   { prefix: 'offer-letters',  types: ['application/pdf'] },
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

const EXPIRES_SECONDS = 600 // 10 minutes

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json(405, { error: 'method not allowed' })
  }

  const endpoint = process.env.R2_S3_ENDPOINT
  const bucket = process.env.R2_BUCKET
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return json(500, { error: 'storage not configured' })
  }

  let body: { kind?: string; dealId?: string; contentType?: string }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'invalid JSON body' })
  }

  const kind = KINDS[body.kind ?? '']
  if (!kind) return json(400, { error: `unknown kind; expected one of ${Object.keys(KINDS).join(', ')}` })

  const contentType = body.contentType ?? ''
  if (!kind.types.includes(contentType)) {
    return json(400, { error: `contentType must be one of ${kind.types.join(', ')} for this kind` })
  }

  const dealId = (body.dealId ?? '').trim()
  if (!/^[A-Za-z0-9-]{1,64}$/.test(dealId)) {
    return json(400, { error: 'dealId required (alphanumeric/dash, max 64 chars)' })
  }

  // Key layout: <kind-prefix>/<dealId>/<timestamp>-<random>.<ext>
  // Timestamped + random so re-uploads never overwrite an audit artifact.
  const stamp = Date.now()
  const rand = crypto.randomUUID().slice(0, 8)
  const objectKey = `${kind.prefix}/${dealId}/${stamp}-${rand}.${EXT[contentType]}`

  const r2 = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region: 'auto',
  })

  const url = new URL(`${endpoint}/${bucket}/${objectKey}`)
  url.searchParams.set('X-Amz-Expires', String(EXPIRES_SECONDS))

  const signed = await r2.sign(
    new Request(url.toString(), { method: 'PUT', headers: { 'Content-Type': contentType } }),
    { aws: { signQuery: true } },
  )

  return json(200, {
    uploadUrl: signed.url,
    objectKey,
    expiresIn: EXPIRES_SECONDS,
  })
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
