import { prisma } from '../lib/prisma'

async function main() {
  const rows = await prisma.derivedContent.findMany({
    where: {
      contentType: 'PODCAST_SCRIPT',
      status: { in: ['APPROVED', 'IN_REVIEW', 'PUBLISHED'] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      mediaFiles: {
        where: { mediaType: 'AUDIO' },
        select: { id: true, processingStatus: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  let need = 0
  for (const r of rows) {
    const ok = r.mediaFiles.some((m) => m.processingStatus === 'COMPLETED')
    if (!ok) need += 1
    console.log(ok ? 'OK  ' : 'NEED', r.status.padEnd(10), r.id, r.title.slice(0, 50))
  }
  console.log('\nNEED:', need, '/ listed', rows.length)
}

main().finally(() => prisma.$disconnect())
