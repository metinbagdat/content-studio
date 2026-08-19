import { prisma } from '../prisma'
import { fetchEgitimTodayBlog } from '../blog/fetchEgitimToday'
import { createPipeline } from '../pipeline'
import { DEFAULT_PIPELINE_PLATFORMS } from '../platforms/targets'
import { isDuplicateArticle, isLikelyHubPage } from './duplicateDetection'
import { fetchBlogSitemap, type SitemapEntry } from './sitemap'
import { fetchWpPostSitemap } from './wpSitemap'
import { fetchWpPostBySlug, wpHtmlToText } from '../wordpress/fetchWpPost'
import { ingestWordpressPublished } from '../wordpress/ingestPublished'
import { fetchBlogRss, isRssAvailable } from './rss'
import { detectAudienceSegment, withSegmentTag } from '../audience/segments'

export type DiscoveryResult = {
  scanned: number
  newArticles: number
  skippedDuplicates: number
  skippedHubPages: number
  errors: string[]
  ingested: Array<{ slug: string; sourceId: string; title: string }>
  source: 'sitemap' | 'rss' | 'manual' | 'wordpress'
}

export type DiscoveryOptions = {
  /** Max new articles to ingest per run */
  limit?: number
  /** Run pipeline after ingest */
  triggerPipeline?: boolean
  /** Only these slugs (manual mode) */
  slugs?: string[]
  /** wordpress = blog.egitim.today (default). learncon = legacy /blog scrape. */
  origin?: 'wordpress' | 'learncon'
}

function discoveryOrigin(options: DiscoveryOptions): 'wordpress' | 'learncon' {
  if (options.origin) return options.origin
  const env = (process.env.DISCOVERY_ORIGIN || 'wordpress').toLowerCase()
  return env === 'learncon' ? 'learncon' : 'wordpress'
}

async function ingestWpSlug(
  slug: string,
  triggerPipeline: boolean,
): Promise<{ sourceId: string; title: string; duplicate: boolean }> {
  const post = await fetchWpPostBySlug(slug)
  if (!post) throw new Error(`WP post not found: ${slug}`)
  const text = wpHtmlToText(post.contentHtml)
  if (isLikelyHubPage(slug, post.title, text)) {
    throw new Error(`HUB_PAGE:${slug}`)
  }
  const result = await ingestWordpressPublished(
    {
      post_id: post.id,
      title: post.title,
      link: post.link,
      content: post.contentHtml,
      excerpt: post.excerpt,
      post_type: 'article',
    },
    { triggerPipeline },
  )
  if (!result.sourceId) throw new Error(result.message || `WP ingest failed: ${slug}`)
  return { sourceId: result.sourceId, title: post.title, duplicate: result.duplicate }
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
  const origin = discoveryOrigin(options)
  if (options.slugs?.length) {
    const prefix =
      origin === 'wordpress' ? 'https://blog.egitim.today/' : 'https://www.egitim.today/blog/'
    return {
      source: origin === 'wordpress' ? 'wordpress' : 'manual',
      entries: options.slugs.map((slug) => ({
        slug,
        url: `${prefix}${slug}`,
      })),
    }
  }

  if (origin === 'wordpress') {
    try {
      const entries = await fetchWpPostSitemap()
      if (entries.length > 0) return { source: 'wordpress', entries }
      console.warn('[discovery] WP post sitemap empty')
    } catch (err) {
      console.warn('[discovery] WP sitemap failed', err)
    }
    return { source: 'wordpress', entries: [] }
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
  const origin = discoveryOrigin(options)

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
      if (origin === 'wordpress') {
        const { sourceId, title, duplicate } = await ingestWpSlug(entry.slug, triggerPipeline)
        if (duplicate) {
          result.skippedDuplicates += 1
          continue
        }
        result.newArticles += 1
        result.ingested.push({ slug: entry.slug, sourceId, title })
        continue
      }
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
      if (msg.startsWith('HUB_PAGE:')) {
        result.skippedHubPages += 1
        continue
      }
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