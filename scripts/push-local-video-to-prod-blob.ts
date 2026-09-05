/**
 * Push a local MP4 to production Blob via admin API (uses Vercel BLOB_READ_WRITE_TOKEN).
 *
 *   ADMIN_API_KEY=... npx tsx scripts/push-local-video-to-prod-blob.ts --media=<uuid> --file=storage/videos/<uuid>.mp4
 *   ADMIN_API_KEY=... npx tsx scripts/push-local-video-to-prod-blob.ts --derived=<uuid> --file=... --create
 *
 * Hobby body limit ~4.5MB — larger files need local BLOB_READ_WRITE_TOKEN + upload-videos-to-blob.ts
 */
import { readFile, stat } from 'fs/promises'
import path from 'path'

const key = process.env.ADMIN_API_KEY || ''
const base = (process.env.PROD_URL || 'https://studio.egitim.today').replace(/\/$/, '')

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

async function main() {
  if (!key) throw new Error('ADMIN_API_KEY required')
  const mediaId = arg('media')
  const derived = arg('derived')
  const file = arg('file')
  const create = process.argv.includes('--create')
  if (!file) throw new Error('--file=path/to.mp4 required')
  if (!mediaId && !(create && derived)) {
    throw new Error('--media=id or --create --derived=id required')
  }

  const full = path.resolve(file)
  const st = await stat(full)
  console.log({ bytes: st.size, mb: +(st.size / 1e6).toFixed(2), full })
  if (st.size > 4_500_000) {
    throw new Error('File too large for Hobby upload API — use local Blob token script')
  }
  const buf = await readFile(full)

  const qs = new URLSearchParams()
  if (mediaId) qs.set('mediaId', mediaId)
  if (create && derived) {
    qs.set('create', '1')
    qs.set('derivedContentId', derived)
  }

  const res = await fetch(`${base}/api/media/blob-upload?${qs}`, {
    method: 'POST',
    headers: {
      'x-admin-key': key,
      'Content-Type': 'video/mp4',
    },
    body: buf,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 500)}`)
  console.log(text)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
