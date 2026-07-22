import { prisma } from '../prisma'
import { generatePostImage, readPostImageBuffer } from '../media/generatePostImage'

const FALLBACK = 'https://www.egitim.today/opengraph-image.png'

/** Default promo / blog image for social posts. */
export function defaultPostImageUrl(): string {
  return (
    process.env.POST_DEFAULT_IMAGE?.trim() ||
    process.env.BRAND_OG_IMAGE?.trim() ||
    FALLBACK
  )
}

export async function resolvePostMediaUrls(derivedContentId: string): Promise<string[]> {
  const derived = await prisma.derivedContent.findUnique({
    where: { id: derivedContentId },
    include: { source: true },
  })
  if (!derived) return [defaultPostImageUrl()]

  const meta =
    derived.metadata && typeof derived.metadata === 'object'
      ? (derived.metadata as Record<string, unknown>)
      : {}

  if (typeof meta.imageUrl === 'string' && meta.imageUrl.trim()) {
    const url = meta.imageUrl.trim()
    if (url.includes('/api/media/') || !url.includes('opengraph-image.png')) {
      return [url]
    }
  }
  if (Array.isArray(meta.mediaUrls)) {
    const urls = meta.mediaUrls.map(String).filter((u) => u.startsWith('http'))
    if (urls.length) return urls
  }

  // Blog slug heuristic for egitim.today sources
  const slug = derived.source?.tags?.find((t) => t.startsWith('blog:'))
  if (slug) {
    const path = slug.replace('blog:', '')
    return [`https://www.egitim.today/blog/${path}/opengraph-image`]
  }

  if (derived.contentType === 'SOCIAL_CAPTION') {
    try {
      const { publicUrl } = await generatePostImage(derivedContentId)
      return [publicUrl]
    } catch {
      /* fallback below */
    }
  }

  return [defaultPostImageUrl()]
}

export { readPostImageBuffer }

export function captionMetadataWithImage(
  metadata: Record<string, unknown> | undefined,
  imageUrl?: string,
): Record<string, unknown> {
  const base = metadata && typeof metadata === 'object' ? { ...metadata } : {}
  if (imageUrl?.trim()) base.imageUrl = imageUrl.trim()
  base.autoGenerateImage = true
  return base
}
