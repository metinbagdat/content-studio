import { prisma } from '../lib/prisma'
import { bulkPublishDraftPosts } from '../lib/pipeline'
import { syncPostImagesFromCaptions } from '../lib/social/publishCaption'

async function main() {
  const platform = process.argv[2] || 'LINKEDIN'

  const targets = await prisma.socialMediaPost.findMany({
    where: { status: { in: ['DRAFT', 'FAILED'] }, platform: platform as 'LINKEDIN' | 'TWITTER' },
    include: { account: true },
  })

  const real = targets.filter((p) => {
    const cfg = p.account.config && typeof p.account.config === 'object' ? (p.account.config as Record<string, unknown>) : {}
    return p.account.isActive && !p.account.accountId.startsWith('dryrun_') && !cfg.dryRun
  })

  console.log(`${platform} hedef: ${real.length} post (${targets.length} toplam DRAFT/FAILED)`)

  if (platform === 'LINKEDIN') {
    const images = await syncPostImagesFromCaptions()
    console.log(`Görseller senkron: ${images.postsUpdated} post`)
  }

  // bulkPublishDraftPosts tüm platformları dener; LinkedIn-only için filtreli yayın
  const { publishPost } = await import('../lib/social/publish')
  const { preparePostForPublish } = await import('../lib/social/preparePublish')

  let published = 0
  let failed = 0
  const errors: string[] = []

  for (const post of real) {
    try {
      await preparePostForPublish(post.id)
      const r = await publishPost(post.id, { requireImage: post.platform === 'LINKEDIN' })
      if (r.skipped) {
        console.log(`  atlandı ${post.id.slice(0, 8)} (değişmedi)`)
      } else {
        published += 1
        console.log(`  ✓ ${post.id.slice(0, 8)} yayınlandı`)
      }
    } catch (err) {
      failed += 1
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${post.id.slice(0, 8)}: ${msg.slice(0, 100)}`)
      console.log(`  ✗ ${post.id.slice(0, 8)} ${msg.slice(0, 80)}`)
    }
  }

  console.log('\nSonuç:', { published, failed, errors: errors.slice(0, 5) })

  const counts = await prisma.socialMediaPost.groupBy({ by: ['status'], _count: true })
  console.log('\nGüncel:', Object.fromEntries(counts.map((c) => [c.status, c._count])))
}

main().finally(() => prisma.$disconnect())
