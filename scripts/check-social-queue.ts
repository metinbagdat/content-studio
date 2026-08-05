import { prisma } from '../lib/prisma'
import { runSocialAutopilot } from '../lib/social/autopilot'
import { drainDuePosts } from '../lib/social/publish'
import { bulkPublishDraftPosts } from '../lib/pipeline'
import { syncPostImagesFromCaptions } from '../lib/social/publishCaption'

async function main() {
  const now = new Date()

  const byStatus = await prisma.socialMediaPost.groupBy({
    by: ['status'],
    _count: true,
  })

  const accounts = await prisma.socialMediaAccount.findMany({
    where: { isActive: true },
    select: { id: true, platform: true, accountName: true, accountId: true, config: true },
  })

  const scheduled = await prisma.socialMediaPost.findMany({
    where: { status: 'SCHEDULED' },
    orderBy: { scheduledAt: 'asc' },
    take: 10,
    include: { account: { select: { accountName: true, accountId: true } } },
  })

  const failed = await prisma.socialMediaPost.findMany({
    where: { status: 'FAILED' },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { account: { select: { platform: true, accountName: true } } },
  })

  const drafts = await prisma.socialMediaPost.count({ where: { status: 'DRAFT' } })
  const published = await prisma.socialMediaPost.count({ where: { status: 'PUBLISHED' } })

  console.log('\n=== SOSYAL KUYRUK DURUMU ===')
  console.log('Zaman:', now.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }), 'IST')
  console.log('\nPost sayıları:')
  for (const row of byStatus.sort((a, b) => a.status.localeCompare(b.status))) {
    console.log(`  ${row.status}: ${row._count}`)
  }

  console.log('\nBağlı hesaplar:')
  for (const a of accounts) {
    const cfg = a.config && typeof a.config === 'object' ? (a.config as Record<string, unknown>) : {}
    const dry = a.accountId.startsWith('dryrun_') || Boolean(cfg.dryRun)
    console.log(`  ${a.platform} · ${a.accountName} · ${dry ? 'DRY-RUN' : 'OAuth'}`)
  }

  console.log('\nZamanlanmış (ilk 10):')
  if (!scheduled.length) console.log('  (yok)')
  for (const p of scheduled) {
    const due = p.scheduledAt ? p.scheduledAt <= now : false
    console.log(
      `  ${p.platform} · ${p.scheduledAt?.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} · ${due ? 'VAKTİ GELDİ' : 'bekliyor'} · ${p.account.accountName}`,
    )
  }

  console.log('\nBaşarısız (son 10):')
  if (!failed.length) console.log('  (yok)')
  for (const p of failed) {
    console.log(`  ${p.platform} · ${p.error?.slice(0, 80) || '—'} · ${p.account.accountName}`)
  }

  console.log('\n=== AUTOPILOT TİCK ===')
  const autopilot = await runSocialAutopilot(12)
  console.log(JSON.stringify(autopilot, null, 2))

  console.log('\n=== ZAMANI GELEN YAYINLAR ===')
  const drained = await drainDuePosts(10)
  console.log(`Yayınlanan: ${drained}`)

  const draftsAfter = await prisma.socialMediaPost.count({ where: { status: 'DRAFT' } })
  const scheduledAfter = await prisma.socialMediaPost.count({ where: { status: 'SCHEDULED' } })
  const publishedAfter = await prisma.socialMediaPost.count({ where: { status: 'PUBLISHED' } })
  const failedAfter = await prisma.socialMediaPost.count({ where: { status: 'FAILED' } })

  console.log('\n=== GÜNCEL DURUM ===')
  console.log(`  DRAFT: ${drafts} → ${draftsAfter}`)
  console.log(`  SCHEDULED: ${scheduled.length} → ${scheduledAfter}`)
  console.log(`  PUBLISHED: ${published} → ${publishedAfter}`)
  console.log(`  FAILED: ${failed.length} → ${failedAfter}`)

  const doBulk = process.argv.includes('--publish')
  if (doBulk && draftsAfter > 0) {
    console.log('\n=== TOPLU YAYIN (gerçek OAuth) ===')
    const images = await syncPostImagesFromCaptions()
    console.log(`Görseller: ${images.captions} caption, ${images.postsUpdated} post güncellendi`)
    const bulk = await bulkPublishDraftPosts({ includeDryRun: false })
    console.log(JSON.stringify(bulk, null, 2))
  } else if (draftsAfter > 0) {
    console.log('\nKalan taslakları hemen yayınlamak için: npx tsx --env-file=.env scripts/check-social-queue.ts --publish')
  }
}

main().finally(() => prisma.$disconnect())
