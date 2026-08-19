import type { SitemapEntry } from './sitemap'

const SKIP_SLUGS = new Set(['yazilar', 'home', 'uncategorized'])

/** Rank Math post sitemap on the SEO hub. */
export async function fetchWpPostSitemap(
  sitemapUrl = 'https://blog.egitim.today/post-sitemap.xml',
): Promise<SitemapEntry[]> {
  const res = await fetch(sitemapUrl, {
    headers: { 'User-Agent': 'ContentStudio/1.0 (+https://egitim.today)' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`WP sitemap fetch ${res.status}: ${sitemapUrl}`)
  const xml = await res.text()
  if (!xml.includes('<url>') && !xml.includes('<loc>')) {
    throw new Error(`WP sitemap is not XML: ${sitemapUrl}`)
  }

  const entries: SitemapEntry[] = []
  const re = /<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]*)<\/lastmod>)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const url = m[1].trim()
    if (!url.startsWith('https://blog.egitim.today/')) continue
    const path = url.replace('https://blog.egitim.today/', '').replace(/\/$/, '')
    if (!path || path.includes('/')) continue
    if (path.endsWith('.xml')) continue
    if (SKIP_SLUGS.has(path)) continue
    entries.push({ url, slug: path, lastmod: m[2]?.trim() || undefined })
  }
  return entries
}
