import { prisma } from '../prisma'
import { fetchEgitimTodayBlog } from '../blog/fetchEgitimToday'
import { createPipeline } from '../pipeline'
import { DEFAULT_PIPELINE_PLATFORMS } from '../platforms/targets'
import { isDuplicateArticle, isLikelyHubPage } from './duplicateDetection'
import { fetchBlogSitemap, type SitemapEntry } from './sitemap'
import { fetchBlogRss, isRssAvailable } from './rss'
import { detectAudienceSegment, withSegmentTag } from '../audience/segments'

export type DiscoveryResult = {
  scanned: number
  newArticles: number
  skippedDuplicates: number
  skippedHubPages: number
  errors: string[]
  ingested: Array<{ slug: string; sourceId: string; title: string }>
  source: 'sitemap' | 'rss' | 'manual'
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
  if (isLikelyHubPage(slug, blog.title, blog.contentMarkdown)) {
    throw new Error(`HUB_PAGE:${slug}`)
  }
  if (await isDuplicateArticle(slug, blog.title, blog.contentMarkdown)) {
    throw new Error(`DUPLICATE:${slug}`)
  }
  const source = await prisma.contentSource.create({
    data: {
      title: blog.title,
      content: blog.contentMarkdown,
      category: 'blog',
      tags: withSegmentTag(blog.tags, detectAudienceSegment(`${blog.title}\n${blog.contentMarkdown}`, blog.tags)),
    },
  })
  return { sourceId: source.id, title: blog.title }
}

/** Resolve entries via sitemap, falling back to RSS if sitemap fails or is empty. */
async function resolveEntries(options: DiscoveryOptions): Promise<{ entries: SitemapEntry[]; source: DiscoveryResult['source'] }> {
  if (options.slugs?.length) {
    return {
      source: 'manual',
      entries: options.slugs.map((slug) => ({
        slug,
        url: `https://www.egitim.today/blog/${slug}`,
      })),
    }
  }

  try {
    const sitemapEntries = await fetchBlogSitemap()
    if (sitemapEntries.length > 0) {
      return { source: 'sitemap', entries: sitemapEntries }
    }
    console.warn('[discovery] sitemap returned 0 entries, checking RSS fallback')
  } catch (err) {
    console.warn('[discovery] sitemap fetch failed, checking RSS fallback', err)
  }

  if (await isRssAvailable()) {
    const rssEntries = await fetchBlogRss()
    return { source: 'rss', entries: rssEntries }
  }

  // Neither sitemap nor RSS worked — surface an empty result rather than throwing,
  // so a transient outage doesn't crash the scheduled run.
  console.error('[discovery] both sitemap and RSS unavailable')
  return { source: 'sitemap', entries: [] }
}

/** Phase 0: scan sitemap (or RSS fallback), ingest new blogs, optionally trigger pipeline. */
export async function runContentDiscovery(options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
  const limit = options.limit ?? 3
  const triggerPipeline = options.triggerPipeline ?? true

  const { entries, source } = await resolveEntries(options)

  const result: DiscoveryResult = {
    scanned: entries.length,
    newArticles: 0,
    skippedDuplicates: 0,
    skippedHubPages: 0,
    errors: [],
    ingested: [],
    source,
  }

  for (const entry of entries) {
    if (result.newArticles >= limit) break
    try {
      const blog = await fetchEgitimTodayBlog(entry.slug)
      if (isLikelyHubPage(entry.slug, blog.title, blog.contentMarkdown)) {
        result.skippedHubPages += 1
        continue
      }
      if (await isDuplicateArticle(entry.slug, blog.title, blog.contentMarkdown)) {
        result.skippedDuplicates += 1
        continue
      }
      const source = await prisma.contentSource.create({
        data: {
          title: blog.title,
          content: blog.contentMarkdown,
          category: 'blog',
          tags: withSegmentTag(blog.tags, detectAudienceSegment(`${blog.title}\n${blog.contentMarkdown}`, blog.tags)),
        },
      })
      result.newArticles += 1
      result.ingested.push({ slug: entry.slug, sourceId: source.id, title: blog.title })
      if (triggerPipeline) {
        await createPipeline(source.id, {
          platforms: [...DEFAULT_PIPELINE_PLATFORMS],
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