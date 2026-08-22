import { prisma } from '../lib/prisma'
import { readReviewFault, VIDEO_FAULT_TYPES } from '../lib/review/faultMeta'

const id = process.argv[2] || 'e0b592ce-bb66-4976-b411-ea879f11675a'

async function main() {
  const row = await prisma.derivedContent.findUnique({
    where: { id },
    select: { id: true, title: true, status: true, contentType: true, metadata: true },
  })
  if (row) {
    const f = readReviewFault(row.metadata)
    console.log(JSON.stringify({ ...row, fault: f.fault, last: f.last }, null, 2))
  } else {
    console.log('not found:', id)
  }

  const pending = await prisma.derivedContent.findMany({
    where: { status: 'IN_REVIEW' },
    select: { metadata: true, contentType: true },
  })
  const fault = pending.filter((x) => readReviewFault(x.metadata).fault)
  const videos = pending.filter((x) => VIDEO_FAULT_TYPES.has(x.contentType))
  console.log(`\nIN_REVIEW ${pending.length} · arı ${fault.length} · video ${videos.length}`)
}

main().finally(() => prisma.$disconnect())
