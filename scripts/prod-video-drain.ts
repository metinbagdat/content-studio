/**
 * Local one-shot: generate MP4 for prod Arı (IN_REVIEW + reviewFault) videos.
 *
 *   # .env.prod.pull from: npx vercel env pull .env.prod.pull --environment=production
 *   # (BLOB may be [SENSITIVE] — disk publish still works locally)
 *
 *   node --env-file=.env.prod.pull --import tsx scripts/prod-video-drain.ts --limit=1
 *   node --env-file=.env.prod.pull --import tsx scripts/prod-video-drain.ts --limit=3 --type=VIDEO_SCRIPT
 *   node --env-file=.env.prod.pull --import tsx scripts/prod-video-drain.ts --limit=5 --type=SHORT_VIDEO_SCRIPT
 *
 * Requires CS_ALLOW_SUPABASE_WORKER=1 (set below). Unset / switch .env back to Docker after.
 */
process.env.CS_ALLOW_SUPABASE_WORKER = '1'
// Local drain: static RW token must win over store OIDC (dev env often not linked).
if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
  delete process.env.BLOB_STORE_ID
  delete process.env.VERCEL_OIDC_TOKEN
}

import { prisma } from '../lib/prisma'
import { generateVideoVariants } from '../lib/video/generateVideo'
import { clearReviewFault } from '../lib/review/fault'
import { readReviewFault } from '../lib/review/faultMeta'
import type { AspectRatio } from '../lib/video/renderVideo'

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

async function main() {
  const limit = Math.max(1, Number(arg('limit', '1')) || 1)
  const typeFilter = arg('type') // VIDEO_SCRIPT | SHORT_VIDEO_SCRIPT
  const approve = process.argv.includes('--approve')

  if (!process.env.DATABASE_URL || /localhost:5434/.test(process.env.DATABASE_URL)) {
    throw new Error('Use prod DATABASE_URL (.env.prod.pull). Refusing localhost Docker for this drain.')
  }

  const rows = await prisma.derivedContent.findMany({
    where: {
      status: 'IN_REVIEW',
      contentType: typeFilter
        ? (typeFilter as 'VIDEO_SCRIPT' | 'SHORT_VIDEO_SCRIPT')
        : { in: ['VIDEO_SCRIPT', 'SHORT_VIDEO_SCRIPT'] },
    },
    select: { id: true, title: true, contentType: true, metadata: true },
    orderBy: { createdAt: 'asc' },
    take: 400,
  })

  const fault = rows.filter((r) => readReviewFault(r.metadata).fault)
  console.log(`IN_REVIEW videos=${rows.length} arı=${fault.length} willProcess=${Math.min(limit, fault.length)}`)

  let ok = 0
  let fail = 0
  for (const row of fault.slice(0, limit)) {
    const aspects: AspectRatio[] = row.contentType === 'SHORT_VIDEO_SCRIPT' ? ['9:16'] : ['16:9']
    console.log(`[${ok + fail + 1}/${limit}] ${row.contentType} ${row.id.slice(0, 8)}… ${row.title.slice(0, 50)}`)
    try {
      const variants = await generateVideoVariants(row.id, aspects)
      if (!variants.length) throw new Error('no variants')
      await clearReviewFault(row.id)
      if (approve) {
        await prisma.derivedContent.update({
          where: { id: row.id },
          data: { status: 'APPROVED', approvedAt: new Date() },
        })
      }
      console.log('  ok', variants.map((v) => `${v.aspect} ${v.publicUrl.slice(0, 56)}`).join(' · '))
      ok += 1
    } catch (err) {
      fail += 1
      console.error('  FAIL', err instanceof Error ? err.message : String(err))
    }
  }
  console.log(JSON.stringify({ ok, fail, remainingHint: fault.length - ok }))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
