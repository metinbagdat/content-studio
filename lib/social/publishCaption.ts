import { prisma } from '../prisma'
import { generatePostImage } from '../media/generatePostImage'
import { defaultPostImageUrl } from './brandImage'

function isCustomUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

/** Auto-generate branded PNG for caption if no custom image set. */
export async function ensureGeneratedPostImage(derivedContentId: string): Promise<string[]> {
  const derived = await prisma.derivedContent.findUnique({
    where: { id: derivedContentId },
    include: { source: true },
  })
  if (!derived || derived.contentType !== 'SOCIAL_CAPTION') {
    return []
  }

  const meta =
    derived.metadata && typeof derived.metadata === 'object'
      ? (derived.metadata as Record<string, unknown>)
      : {}

  const existingUrl = typeof meta.imageUrl === 'string' ? meta.imageUrl.trim() : ''
  if (existingUrl && existingUrl.includes('/api/media/') && existingUrl.endsWith('/image')) {
    return [existingUrl]
  }
  if (existingUrl && isCustomUrl(existingUrl) && !existingUrl.includes('opengraph-image')) {
    return [existingUrl]
  }

  const slug = derived.source?.tags?.find((t) => t.startsWith('blog:'))
  if (slug && !existingUrl) {
    const path = slug.replace('blog:', '')
    return [`https://www.egitim.today/blog/${path}/opengraph-image`]
  }

  try {
    const { publicUrl } = await generatePostImage(derivedContentId)
    return [publicUrl]
  } catch (err) {
    console.warn('[ensureGeneratedPostImage]', derivedContentId, err)
    return [defaultPostImageUrl()]
  }
}

/** Generate images + publish all draft/failed posts for a caption. */
export async function publishCaptionWithImages(derivedContentId: string) {
  const mediaUrls = await ensureGeneratedPostImage(derivedContentId)

  await prisma.socialMediaPost.updateMany({
    where: {
      derivedContentId,
      status: { in: ['DRAFT', 'FAILED', 'SCHEDULED'] },
    },
    data: { mediaUrls },
  })

  const posts = await prisma.socialMediaPost.findMany({
    where: {
      derivedContentId,
      status: { in: ['DRAFT', 'FAILED', 'SCHEDULED'] },
    },
    include: { account: true },
  })

  const results: Array<{ postId: string; ok: boolean; platformPostId?: string; error?: string }> = []
  const { publishPost } = await import('./publish')

  for (const post of posts) {
    if (!post.account.isActive) {
      results.push({ postId: post.id, ok: false, error: 'Hesap pasif' })
      continue
    }
    try {
      const out = await publishPost(post.id)
      results.push({
        postId: post.id,
        ok: true,
        platformPostId: String(out.platformPostId || ''),
      })
    } catch (err) {
      results.push({
        postId: post.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { mediaUrls, published: results.filter((r) => r.ok).length, results }
}
