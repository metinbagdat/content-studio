import { prisma } from '../lib/prisma'

async function main() {
  const scripts = await prisma.derivedContent.findMany({
    where: { contentType: 'PODCAST_SCRIPT', status: { in: ['IN_REVIEW', 'APPROVED', 'PUBLISHED'] } },
    select: { id: true, title: true, status: true },
  })
  const missing: string[] = []
  for (const s of scripts) {
    const audio = await prisma.mediaFile.findFirst({
      where: {
        derivedContentId: s.id,
        mediaType: 'AUDIO',
        processingStatus: 'COMPLETED',
      },
    })
    if (!audio) {
      missing.push(s.id)
      console.log('MISSING:', s.id, s.title || '(no title)')
    }
  }
  console.log('\nTotal missing:', missing.length)
}

main().finally(() => prisma.$disconnect())
