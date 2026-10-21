/**
 * Backfill local MP3s → Vercel Blob (`audio/{id}.mp3`) and set MediaFile.fileUrl.
 *
 * Usage (local Docker DB, Blob token in .env):
 *   npx tsx --env-file=.env scripts/upload-audio-to-blob.ts
 *   npx tsx --env-file=.env scripts/upload-audio-to-blob.ts --limit=5
 *
 * Does not call TTS. Skips rows that already have a durable HTTPS URL.
 * For prod DB use CS_ALLOW_SUPABASE_WORKER=1 only for this short command, then unset.
 */
import { prisma } from '../lib/prisma'
import { isDurableAudioUrl, promoteAudioFromDisk } from '../lib/media/tts'

const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1]) || 20) : 20

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error('BLOB_READ_WRITE_TOKEN gerekli (Vercel → Storage → Blob → .env)')
  }

  const rows = await prisma.mediaFile.findMany({
    where: { mediaType: 'AUDIO', processingStatus: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  let uploaded = 0
  let skipped = 0
  let missing = 0

  for (const row of rows) {
    if (uploaded >= limit) break
    if (isDurableAudioUrl(row.fileUrl)) {
      skipped += 1
      continue
    }
    const url = await promoteAudioFromDisk(row.id)
    if (!url || !isDurableAudioUrl(url)) {
      console.warn('skip (no disk)', row.id)
      missing += 1
      continue
    }
    await prisma.mediaFile.update({
      where: { id: row.id },
      data: { fileUrl: url },
    })
    console.log('uploaded', row.id, url.slice(0, 64) + '…')
    uploaded += 1
  }

  console.log({ uploaded, skippedDurable: skipped, missingDisk: missing, scanned: rows.length })
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
