/** Pure title/content-fingerprint helpers used for discovery de-duplication.
 * Deliberately has no DB import so it can be unit-tested without a live database
 * (the DB-touching half lives in `duplicateDetection.ts`, which re-exports these). */

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*[|—–-]\s*egitim\.today.*$/i, '')
    .replace(/[^a-z0-9ğüşıöç\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function hashContent(content: string): string {
  const norm = content.replace(/\s+/g, ' ').trim().slice(0, 4000)
  let h = 0
  for (let i = 0; i < norm.length; i++) h = (h * 31 + norm.charCodeAt(i)) | 0
  return `h${(h >>> 0).toString(16)}`
}

/** Category / index pages from sitemap — not full articles. */
export function isLikelyHubPage(slug: string, title: string, content: string): boolean {
  const s = slug.toLowerCase()
  // Real egitim.today articles are flat slugs (/blog/{article-slug}). Any nested path
  // (e.g. /blog/konu/tyt, /blog/konu/motivasyon — sitemap-confirmed topic index pages)
  // is a category/listing page, never an individual article. Check this first — it's
  // authoritative and doesn't depend on fragile title/content-length heuristics.
  if (s.includes('/')) return true
  if (/(^|-)(rehberleri|rehber|hazirlik|hazırlık)(-|$)/i.test(s) && content.length < 1200) return true
  if (/hazirlik-rehberleri$/i.test(s) || /-rehberleri$/i.test(s)) return true
  if (content.trim().length < 450) return true
  if (normalizeTitle(title).match(/^(tyt|ayt|lgs)\s+hazırlık rehberleri$/i)) return true
  return false
}
