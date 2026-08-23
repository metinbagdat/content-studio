import { prisma } from '../lib/prisma'

async function main() {
  const total = await prisma.mediaFile.count({ where: { mediaType: 'AUDIO' } })
  const done = await prisma.mediaFile.count({
    where: { mediaType: 'AUDIO', processingStatus: 'COMPLETED' },
  })
  const failed = await prisma.mediaFile.count({
    where: { mediaType: 'AUDIO', processingStatus: 'FAILED' },
  })
  const byType = await prisma.mediaFile.findMany({
    where: { mediaType: 'AUDIO', processingStatus: 'COMPLETED' },
    select: {
      id: true,
      derivedContent: { select: { contentType: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  const stillNeed = await prisma.derivedContent.findMany({
    where: {
      contentType: { in: ['PODCAST_SCRIPT', 'MARCH_LYRICS', 'SONG_LYRICS'] },
      status: { in: ['APPROVED', 'IN_REVIEW', 'PUBLISHED'] },
      NOT: {
        mediaFiles: { some: { mediaType: 'AUDIO', processingStatus: 'COMPLETED' } },
      },
    },
    select: { id: true, contentType: true, title: true },
  })
  console.log(JSON.stringify({ total, done, failed, completedList: byType.length, stillNeed: stillNeed.length }, null, 2))
  for (const r of byType) {
    console.log('OK', r.derivedContent?.contentType, r.derivedContent?.title?.slice(0, 50))
  }
  if (stillNeed.length) {
    console.log('--- NEED ---')
    for (const r of stillNeed) console.log(r.contentType, r.id, r.title.slice(0, 40))
  }
}

main().finally(() => prisma.$disconnect())
