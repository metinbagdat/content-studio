import { prisma } from '../prisma'

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*[|—–-]\s*egitim\.today.*$/i, '')
    .replace(/[^a-z0-9ğüşıöç\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Skip if slug tag or normalized title already exists. */
export async function isDuplicateArticle(slug: string, title: string): Promise<boolean> {
  const bySlug = await prisma.contentSource.findFirst({
    where: { tags: { has: `blog:${slug}` } },
    select: { id: true },
  })
  if (bySlug) return true

  const norm = normalizeTitle(title)
  if (!norm) return false

  const sources = await prisma.contentSource.findMany({
    select: { title: true },
    take: 500,
    orderBy: { createdAt: 'desc' },
  })
  return sources.some((s) => normalizeTitle(s.title) === norm)
}

export { normalizeTitle }
