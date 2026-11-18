import type { SitemapEntry } from './sitemap'

const SKIP_SLUGS = new Set(['yazilar', 'home', 'uncategorized'])
const HUB_BLOG = 'https://blog.egitim.today'
const DEFAULT_POST_SITEMAP = `${HUB_BLOG}/post-sitemap.xml`
const DEFAULT_MAIN_SITEMAP = `${HUB_BLOG}/sitemap.xml`

/** Parse post locs from a urlset (Rank Math flat slugs or /yazilar/{slug}). */
function parseWpSitemapXml(xml: string): SitemapEntry[] {
  if (!xml.includes('<url>') && !xml.includes('<loc>')) {
    throw new Error('WP sitemap is not XML')
  }

  const entries: SitemapEntry[] = []
  const seen = new Set<string>()
  const re = /<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]*)<\/lastmod>)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const url = m[1].trim()
    if (!url.startsWith(`${HUB_BLOG}/`)) continue

    const path = url.replace(`${HUB_BLOG}/`, '').replace(/\/$/, '')
    if (!path || path.endsWith('.xml')) continue

    let slug: string | null = null
    const yazilarMatch = path.match(/^yazilar\/([^/]+)$/)
    if (yazilarMatch) {
      slug = yazilarMatch[1]
    } else if (!path.includes('/')) {
      if (!SKIP_SLUGS.has(path)) slug = path
    }

    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    entries.push({ url, slug, lastmod: m[2]?.trim() || undefined })
  }
  return entries
}

async function fetchSitemapXml(sitemapUrl: string): Promise<string> {
  const res = await fetch(sitemapUrl, {
    headers: { 'User-Agent': 'ContentStudio/1.0 (+https://egitim.today)' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`WP sitemap fetch ${res.status}: ${sitemapUrl}`)
  return res.text()
}

/** Rank Math post sitemap on the SEO hub; falls back to main sitemap when post-sitemap 404s. */
export async function fetchWpPostSitemap(
  postSitemapUrl = process.env.WP_POST_SITEMAP_URL || DEFAULT_POST_SITEMAP,
): Promise<SitemapEntry[]> {
  const fallbacks = [
    postSitemapUrl,
    process.env.WP_SITEMAP_URL || DEFAULT_MAIN_SITEMAP,
  ].filter((url, i, arr) => arr.indexOf(url) === i)

  let lastErr: unknown
  for (const url of fallbacks) {
    try {
      const xml = await fetchSitemapXml(url)
      const entries = parseWpSitemapXml(xml)
      if (entries.length > 0) return entries
      console.warn('[discovery] WP sitemap had 0 post entries', url)
    } catch (err) {
      lastErr = err
      console.warn('[discovery] WP sitemap failed', url, err)
    }
  }

  if (lastErr instanceof Error) throw lastErr
  throw new Error('WP sitemap: no post URLs found')
}
