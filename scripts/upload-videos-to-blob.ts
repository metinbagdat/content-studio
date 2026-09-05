/**
 * Backfill local MP4s → Vercel Blob (`videos/{id}.mp4`) and set MediaFile.fileUrl.
 *
 * Usage (local, with Blob token from Vercel project):
 *   npx tsx --env-file=.env scripts/upload-videos-to-blob.ts
 *   npx tsx --env-file=.env scripts/upload-videos-to-blob.ts --limit=5
 *
 * Does not regenerate video. Skips rows that already have a durable HTTPS URL.
 * Prefer running against local Docker DB after generate; for prod DB use
 * CS_ALLOW_SUPABASE_WORKER=1 only for this short command, then unset.
 */
import { readFile } from 'fs/promises'
import { prisma } from '../lib/prisma'
import {
  isDurableMediaUrl,
  persistGeneratedVideo,
  videoDiskPath,
} from '../lib/video/videoStorage'

const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 20) : 20

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error('BLOB_READ_WRITE_TOKEN gerekli (Vercel → Storage → Blob → .env)')
  }

  const rows = await prisma.mediaFile.findMany({
    where: { mediaType: 'VIDEO', processingStatus: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  let uploaded = 0
  let skipped = 0
  let missing = 0

  for (const row of rows) {
    if (uploaded >= limit) break
    if (isDurableMediaUrl(row.fileUrl)) {
      skipped += 1
      continue
    }
    const path = videoDiskPath(`${row.id}.mp4`)
    let buffer: Buffer
    try {
      buffer = await readFile(path)
    } catch {
      console.warn('skip (no disk)', row.id)
      missing += 1
      continue
    }
    const url = await persistGeneratedVideo(row.id, buffer)
    await prisma.mediaFile.update({
      where: { id: row.id },
      data: { fileUrl: url, fileSize: buffer.length },
    })
    console.log('uploaded', row.id, `${(buffer.length / 1e6).toFixed(1)}MB`, url.slice(0, 60) + '…')
    uploaded += 1
  }

  console.log({ uploaded, skippedDurable: skipped, missingDisk: missing, scanned: rows.length })
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
