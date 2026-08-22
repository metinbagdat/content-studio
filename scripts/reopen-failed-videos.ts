import { prisma } from '../lib/prisma'
import { markReviewFault } from '../lib/review/fault'
import { readReviewFault, VIDEO_FAULT_TYPES } from '../lib/review/faultMeta'

const REASON =
  "Video üretimi prod'da başarısız (ENOENT/storage) — Arı kuyruğuna alındı; yerel npm run dev"

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const rows = await prisma.derivedContent.findMany({
    where: {
      contentType: { in: ['VIDEO_SCRIPT', 'SHORT_VIDEO_SCRIPT'] },
      status: { in: ['APPROVED', 'IN_REVIEW'] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      contentType: true,
      metadata: true,
      mediaFiles: { where: { mediaType: 'VIDEO' }, select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const needsFix = rows.filter((r) => {
    if (readReviewFault(r.metadata).fault) return false
    if (r.mediaFiles.length > 0) return false
    return true
  })

  console.log(`Video türev: ${rows.length} · medyasız + arı değil: ${needsFix.length}`)
  for (const r of needsFix.slice(0, 25)) {
    console.log(`  ${r.status} ${r.id} · ${r.title.slice(0, 55)}`)
  }
  if (needsFix.length > 25) console.log(`  … +${needsFix.length - 25} daha`)

  if (dryRun) {
    console.log('\n--dry-run: değişiklik yok')
    return
  }

  let n = 0
  for (const r of needsFix) {
    if (r.status === 'APPROVED') {
      await prisma.derivedContent.update({
        where: { id: r.id },
        data: { status: 'IN_REVIEW', approvedAt: null },
      })
    }
    await markReviewFault(r.id, REASON)
    n += 1
  }
  console.log(`\n${n} kayıt IN_REVIEW + Arı olarak işaretlendi`)
}

main().finally(() => prisma.$disconnect())
