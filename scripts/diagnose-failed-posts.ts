import { prisma } from '../lib/prisma'

function errorBucket(raw: string | null): string {
  if (!raw) return '(boş hata)'
  const e = raw.toLowerCase()
  if (e.includes('dry-run') || e.includes('dry run')) return 'dry-run hesap'
  if (e.includes('403') || e.includes('forbidden')) return '403 yetki'
  if (e.includes('401') || e.includes('unauthorized')) return '401 token'
  if (e.includes('429') || e.includes('rate limit')) return '429 rate limit'
  if (e.includes('image') || e.includes('görsel') || e.includes('media')) return 'görsel/medya'
  if (e.includes('video') || e.includes('ffmpeg')) return 'video'
  if (e.includes('timeout') || e.includes('timed out')) return 'timeout'
  if (e.includes('duplicate') || e.includes('çift paylaşım')) return 'duplicate'
  if (e.includes('localhost') || e.includes('redirect')) return 'oauth/redirect'
  if (e.includes('meta graph') || e.includes('facebook') || e.includes('instagram')) return 'meta api'
  if (e.includes('linkedin')) return 'linkedin api'
  if (e.includes('youtube')) return 'youtube api'
  if (e.includes('tiktok')) return 'tiktok api'
  return raw.slice(0, 72)
}

async function main() {
  const byStatus = await prisma.socialMediaPost.groupBy({
    by: ['status'],
    _count: true,
  })
  console.log('=== POST DURUM ===')
  for (const r of byStatus.sort((a, b) => a.status.localeCompare(b.status))) {
    console.log(`  ${r.status}: ${r._count}`)
  }

  const byPlatform = await prisma.socialMediaPost.groupBy({
    by: ['platform', 'status'],
    where: { status: 'FAILED' },
    _count: true,
  })
  console.log('\n=== FAILED / PLATFORM ===')
  for (const r of byPlatform.sort((a, b) => b._count - a._count)) {
    console.log(`  ${r.platform}: ${r._count}`)
  }

  const failed = await prisma.socialMediaPost.findMany({
    where: { status: 'FAILED' },
    select: {
      id: true,
      platform: true,
      error: true,
      createdAt: true,
      account: { select: { accountName: true, accountId: true, config: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const buckets = new Map<string, { count: number; sample: string; platform: string }>()
  for (const p of failed) {
    const bucket = errorBucket(p.error)
    const key = `${p.platform} · ${bucket}`
    const prev = buckets.get(key)
    if (prev) prev.count += 1
    else buckets.set(key, { count: 1, sample: p.error || '—', platform: p.platform })
  }

  console.log('\n=== FAILED / HATA ÖZETİ ===')
  const sorted = [...buckets.entries()].sort((a, b) => b[1].count - a[1].count)
  for (const [key, v] of sorted) {
    console.log(`  ${v.count}x  ${key}`)
    if (v.sample && v.sample !== '—') console.log(`       örnek: ${v.sample.slice(0, 140)}`)
  }

  const dryRunFails = failed.filter((p) => {
    const cfg = p.account.config && typeof p.account.config === 'object' ? (p.account.config as Record<string, unknown>) : {}
    return p.account.accountId.startsWith('dryrun_') || Boolean(cfg.dryRun)
  })
  console.log(`\nDry-run hesaptaki FAILED: ${dryRunFails.length}/${failed.length}`)

  const recent = failed.slice(0, 8)
  console.log('\n=== SON 8 FAILED ===')
  for (const p of recent) {
    console.log(
      `  ${p.platform} · ${p.createdAt.toISOString().slice(0, 10)} · ${p.error?.slice(0, 100) || '—'}`,
    )
  }
}

main().finally(() => prisma.$disconnect())
