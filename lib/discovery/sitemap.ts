export type SitemapEntry = {
  url: string
  slug: string
  lastmod?: string
}

const BLOG_PREFIX = '/blog/'

/** Parse blog URLs from egitim.today sitemap.xml (no XML parser dependency). */
export async function fetchBlogSitemap(
  sitemapUrl = 'https://www.egitim.today/sitemap.xml',
): Promise<SitemapEntry[]> {
  const res = await fetch(sitemapUrl, {
    headers: { 'User-Agent': 'ContentStudio/1.0 (+https://egitim.today)' },
  })
  if (!res.ok) throw new Error(`Sitemap fetch ${res.status}: ${sitemapUrl}`)
  const xml = await res.text()

  const entries: SitemapEntry[] = []
  const re = /<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]*)<\/lastmod>)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const url = m[1].trim()
    if (!url.includes(BLOG_PREFIX)) continue
    const slug = url.split(BLOG_PREFIX)[1]?.replace(/\/$/, '') || ''
    if (!slug) continue
    entries.push({ url, slug, lastmod: m[2]?.trim() || undefined })
  }
  return entries
}
