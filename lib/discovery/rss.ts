import type { SitemapEntry } from './sitemap'

const BLOG_PREFIX = '/blog/'

/** Parse blog URLs from egitim.today RSS feed (fallback when sitemap fails). */
export async function fetchBlogRss(
  rssUrl = 'https://www.egitim.today/rss',
): Promise<SitemapEntry[]> {
  const res = await fetch(rssUrl, {
    headers: { 'User-Agent': 'ContentStudio/1.0 (+https://egitim.today)' },
  })
  if (!res.ok) throw new Error(`RSS fetch ${res.status}: ${rssUrl}`)
  const xml = await res.text()
  const entries: SitemapEntry[] = []
  const itemRe = /<item>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml))) {
    const block = m[1]
    const linkMatch = /<link>([^<]+)<\/link>/i.exec(block)
    const pubDateMatch = /<pubDate>([^<]+)<\/pubDate>/i.exec(block)
    const url = linkMatch?.[1]?.trim()
    if (!url || !url.includes(BLOG_PREFIX)) continue
    const slug = url.split(BLOG_PREFIX)[1]?.replace(/\/$/, '') || ''
    if (!slug) continue
    entries.push({
      url,
      slug,
      lastmod: pubDateMatch?.[1]?.trim()
        ? new Date(pubDateMatch[1].trim()).toISOString()
        : undefined,
    })
  }
  return entries
}

/** Quick check whether the RSS endpoint is live (used to decide fallback). */
export async function isRssAvailable(rssUrl = 'https://www.egitim.today/rss'): Promise<boolean> {
  try {
    const res = await fetch(rssUrl, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}