/**
 * Delete FAILED MediaFile rows (stale after ffmpeg/path failures).
 * Keeps COMPLETED. Usage:
 *   npx tsx --env-file=.env scripts/cleanup-failed-media.ts
 *   npx tsx --env-file=.env scripts/cleanup-failed-media.ts --dry-run
 */
import { prisma } from '../lib/prisma'

async function main() {
  const dry = process.argv.includes('--dry-run')
  const failed = await prisma.mediaFile.findMany({
    where: { processingStatus: 'FAILED' },
    select: {
      id: true,
      mediaType: true,
      derivedContentId: true,
      derivedContent: { select: { title: true, contentType: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  console.log(`FAILED rows: ${failed.length}`)
  for (const f of failed.slice(0, 25)) {
    console.log(`  ${f.mediaType} ${f.id.slice(0, 8)} · ${f.derivedContent?.contentType} · ${f.derivedContent?.title?.slice(0, 45)}`)
  }
  if (failed.length > 25) console.log(`  … +${failed.length - 25}`)

  if (dry) {
    console.log('--dry-run: no delete')
    return
  }
  const r = await prisma.mediaFile.deleteMany({ where: { processingStatus: 'FAILED' } })
  console.log(`Deleted ${r.count} FAILED media rows`)
}

main().finally(() => prisma.$disconnect())
