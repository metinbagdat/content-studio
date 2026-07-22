/**
 * Fetch blog from egitim.today + full content pipeline.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/run-zaman-pipeline.ts
 *   npx tsx --env-file=.env scripts/run-zaman-pipeline.ts --fresh
 */

import { prisma } from '../lib/prisma'
import { createPipeline, processPipeline } from '../lib/pipeline'
import { llmModeLabel } from '../lib/ai/llmClient'
import { fetchEgitimTodayBlog } from '../lib/blog/fetchEgitimToday'

const BLOG_SLUG = 'zamani-zafere-donusturmek'
const fresh = process.argv.includes('--fresh')

async function main() {
  console.log(`AI mode: ${llmModeLabel()}`)
  if (llmModeLabel().startsWith('mock')) {
    console.log('  Groq (önerilen): GROQ_API_KEY=gsk_...  https://console.groq.com/keys')
  }

  console.log(`Fetching https://www.egitim.today/blog/${BLOG_SLUG} ...`)
  const blog = await fetchEgitimTodayBlog(BLOG_SLUG)
  console.log(`Title: ${blog.title}`)
  console.log(`Sections: ${blog.contentMarkdown.split(/\n## /).length - 1} h2 blocks`)

  const existing = await prisma.contentSource.findFirst({
    where: { tags: { has: `blog:${BLOG_SLUG}` } },
  })

  const source = existing
    ? await prisma.contentSource.update({
        where: { id: existing.id },
        data: {
          title: blog.title,
          content: blog.contentMarkdown,
          tags: blog.tags,
          category: 'motivasyon',
        },
      })
    : await prisma.contentSource.create({
        data: {
          title: blog.title,
          content: blog.contentMarkdown,
          category: 'motivasyon',
          tags: blog.tags,
        },
      })

  if (fresh) {
    const removedDerived = await prisma.derivedContent.deleteMany({
      where: { sourceId: source.id, status: { in: ['DRAFT', 'IN_REVIEW'] } },
    })
    const removedPosts = await prisma.socialMediaPost.deleteMany({
      where: {
        derivedContent: { sourceId: source.id },
        status: { in: ['DRAFT', 'SCHEDULED'] },
      },
    })
    console.log(`--fresh: ${removedDerived.count} taslak + ${removedPosts.count} sosyal taslak silindi`)
  }

  console.log('Source:', source.id)

  const batchStart = new Date()

  const pipeline = await createPipeline(source.id, {
    platforms: ['TWITTER', 'LINKEDIN'],
    includeMarchSong: true,
    marchStyle: 'motivational',
    musicGenre: 'pop',
    podcastDuration: 10,
    videoStyle: 'educational',
  })

  await processPipeline(pipeline.id)

  const derived = await prisma.derivedContent.findMany({
    where: { sourceId: source.id, createdAt: { gte: batchStart } },
    orderBy: [{ contentType: 'asc' }, { title: 'asc' }],
    select: { id: true, contentType: true, title: true, status: true, content: true, metadata: true },
  })

  const byType = derived.reduce<Record<string, number>>((acc, d) => {
    acc[d.contentType] = (acc[d.contentType] || 0) + 1
    return acc
  }, {})

  console.log('\n=== Bu batch özeti ===')
  for (const [type, count] of Object.entries(byType).sort()) {
    console.log(`  ${type}: ${count}`)
  }

  const latestPipeline = await prisma.contentPipeline.findFirst({
    where: { sourceId: source.id },
    orderBy: { createdAt: 'desc' },
  })
  const cfg = latestPipeline?.config && typeof latestPipeline.config === 'object'
    ? (latestPipeline.config as Record<string, unknown>)
    : {}
  if (cfg.atomizedCreated) {
    console.log(`\nAtomization: ${cfg.atomizedCreated} parça`)
    const abt = cfg.atomizedByType as Record<string, number> | undefined
    if (abt) {
      for (const [t, c] of Object.entries(abt).sort()) console.log(`  ${t}: ${c}`)
    }
  }

  console.log('\n=== SOCIAL_CAPTION serisi ===')
  for (const d of derived.filter((x) => x.contentType === 'SOCIAL_CAPTION')) {
    const meta = d.metadata && typeof d.metadata === 'object' ? (d.metadata as Record<string, unknown>) : {}
    console.log(`  ${meta.partIndex}/${meta.partTotal} — ${d.content.slice(0, 120).replace(/\n/g, ' ')}…`)
  }

  console.log(`\nPipeline ${pipeline.id} COMPLETED → http://localhost:3100/admin/review`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
