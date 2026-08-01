import { prisma } from '../prisma'

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*[|—–-]\s*egitim\.today.*$/i, '')
    .replace(/[^a-z0-9ğüşıöç\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hashContent(content: string): string {
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

/** Skip if slug tag, normalized title, or content fingerprint already exists. */
export async function isDuplicateArticle(
  slug: string,
  title: string,
  content?: string,
): Promise<boolean> {
  const bySlug = await prisma.contentSource.findFirst({
    where: { tags: { has: `blog:${slug}` } },
    select: { id: true },
  })
  if (bySlug) return true

  const norm = normalizeTitle(title)
  if (!norm) return false

  const fingerprint = content ? hashContent(content) : null
  const sources = await prisma.contentSource.findMany({
    select: { title: true, content: true },
    take: 500,
    orderBy: { createdAt: 'desc' },
  })
  for (const s of sources) {
    if (normalizeTitle(s.title) === norm) return true
    if (fingerprint && hashContent(s.content) === fingerprint) return true
  }
  return false
}

export { hashContent }
