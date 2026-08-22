/**
 * IN_REVIEW video scriptleri (ve isteğe bağlı id listesi) Arı kuyruğuna alır.
 * Toplu onay bir daha bu kayıtlara dokunmaz (metadata.reviewFault).
 *
 *   tsx --env-file=.env scripts/quarantine-review-faults.ts
 *   tsx --env-file=.env scripts/quarantine-review-faults.ts --ids=id1,id2
 */
import { prisma } from '../lib/prisma'
import { quarantineByIds, quarantineVideoScripts } from '../lib/review/fault'
import { readReviewFault, VIDEO_FAULT_TYPES } from '../lib/review/faultMeta'

const DEFAULT_REASON =
  "Video — prod/Vercel'de üretilemez; Arı kuyruğuna alındı (yerel npm run dev)"

async function main() {
  const idsArg = process.argv.find((a) => a.startsWith('--ids='))
  const reasonArg = process.argv.find((a) => a.startsWith('--reason='))
  const reason = reasonArg?.slice('--reason='.length).trim() || DEFAULT_REASON

  const pending = await prisma.derivedContent.findMany({
    where: { status: 'IN_REVIEW' },
    select: { id: true, contentType: true, title: true, metadata: true },
    orderBy: { createdAt: 'desc' },
  })

  const alreadyFault = pending.filter((r) => readReviewFault(r.metadata).fault)
  const pendingVideos = pending.filter((r) => VIDEO_FAULT_TYPES.has(r.contentType))
  const pendingVideosClean = pendingVideos.filter((r) => !readReviewFault(r.metadata).fault)

  console.log(`DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') ?? '(no DATABASE_URL)'}`)
  console.log(`IN_REVIEW: ${pending.length} · arı: ${alreadyFault.length} · video bekleyen: ${pendingVideosClean.length}`)

  let count = 0
  if (idsArg) {
    const ids = idsArg
      .slice('--ids='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    count = await quarantineByIds(ids, reason)
    console.log(`quarantineByIds: ${count} kayıt`)
  } else {
    count = await quarantineVideoScripts(reason)
    console.log(`quarantineVideoScripts: ${count} kayıt`)
  }

  if (count > 0) {
    console.log('\nArı\'ya alınanlar (son batch):')
    const after = await prisma.derivedContent.findMany({
      where: {
        status: 'IN_REVIEW',
        contentType: { in: ['VIDEO_SCRIPT', 'SHORT_VIDEO_SCRIPT'] },
      },
      select: { id: true, title: true, metadata: true },
      take: 30,
      orderBy: { createdAt: 'desc' },
    })
    for (const r of after.filter((x) => readReviewFault(x.metadata).fault)) {
      console.log(`  ${r.id} · ${r.title.slice(0, 60)}`)
    }
  }

  console.log('\nBitti.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
