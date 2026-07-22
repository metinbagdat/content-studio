import { prisma } from '../prisma'
import { fetchEgitimTodayBlog } from '../blog/fetchEgitimToday'
import { createPipeline } from '../pipeline'
import { isDuplicateArticle } from './duplicateDetection'
import { fetchBlogSitemap, type SitemapEntry } from './sitemap'

export type DiscoveryResult = {
  scanned: number
  newArticles: number
  skippedDuplicates: number
  errors: string[]
  ingested: Array<{ slug: string; sourceId: string; title: string }>
}

export type DiscoveryOptions = {
  /** Max new articles to ingest per run */
  limit?: number
  /** Run pipeline after ingest */
  triggerPipeline?: boolean
  /** Only these slugs (manual mode) */
  slugs?: string[]
}

async function ingestBlogSlug(slug: string): Promise<{ sourceId: string; title: string }> {
  const blog = await fetchEgitimTodayBlog(slug)
  if (await isDuplicateArticle(slug, blog.title)) {
    throw new Error(`DUPLICATE:${slug}`)
  }

  const source = await prisma.contentSource.create({
    data: {
      title: blog.title,
      content: blog.contentMarkdown,
      category: 'blog',
      tags: blog.tags,
    },
  })

  return { sourceId: source.id, title: blog.title }
}

/** Phase 0: scan sitemap, ingest new blogs, optionally trigger pipeline. */
export async function runContentDiscovery(options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
  const limit = options.limit ?? 3
  const triggerPipeline = options.triggerPipeline ?? true
  const result: DiscoveryResult = {
    scanned: 0,
    newArticles: 0,
    skippedDuplicates: 0,
    errors: [],
    ingested: [],
  }

  let entries: SitemapEntry[] = []
  if (options.slugs?.length) {
    entries = options.slugs.map((slug) => ({
      slug,
      url: `https://www.egitim.today/blog/${slug}`,
    }))
  } else {
    entries = await fetchBlogSitemap()
  }

  result.scanned = entries.length

  for (const entry of entries) {
    if (result.newArticles >= limit) break

    try {
      const blog = await fetchEgitimTodayBlog(entry.slug)
      if (await isDuplicateArticle(entry.slug, blog.title)) {
        result.skippedDuplicates += 1
        continue
      }

      const source = await prisma.contentSource.create({
        data: {
          title: blog.title,
          content: blog.contentMarkdown,
          category: 'blog',
          tags: blog.tags,
        },
      })

      result.newArticles += 1
      result.ingested.push({ slug: entry.slug, sourceId: source.id, title: blog.title })

      if (triggerPipeline) {
        await createPipeline(source.id, {
          platforms: ['TWITTER', 'LINKEDIN'],
          includeMarchSong: true,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.startsWith('DUPLICATE:')) {
        result.skippedDuplicates += 1
        continue
      }
      result.errors.push(`${entry.slug}: ${msg}`)
    }
  }

  return result
}

export { ingestBlogSlug }
