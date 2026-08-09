import { prisma } from '../lib/prisma'
import { generatePostClip } from '../lib/media/generatePostClip'

async function main() {
  const cap = await prisma.derivedContent.findFirst({
    where: { contentType: 'SOCIAL_CAPTION', status: 'APPROVED' },
    select: { id: true },
  })
  if (!cap) {
    console.log('no caption found')
    return
  }
  console.log('testing clip for', cap.id)
  const r = await generatePostClip(cap.id)
  console.log('result', { reused: r.reused, url: r.publicUrl, size: r.media?.fileSize })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
