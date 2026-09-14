import { prisma } from '../prisma'
import { normalizeTitle, hashContent, isLikelyHubPage } from './articleFingerprint'

export { normalizeTitle, hashContent, isLikelyHubPage }

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
