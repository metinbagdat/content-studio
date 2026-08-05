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

  // Branded card renders per-platform — skip blog og-image probe (often 404, noisy logs)
  try {
    const result = await generatePostImage(derivedContentId)
    const url = result?.publicUrl
    if (typeof url === 'string' && url.startsWith('http')) {
      return [url]
    }
  } catch (err) {
    console.warn('[ensureGeneratedPostImage]', derivedContentId, err)
  }

  return [defaultPostImageUrl()]
}

async function syncPostRowsFromCaption(derivedContentId: string, postContent: string, mediaUrls: string[]) {
  await prisma.socialMediaPost.updateMany({
    where: { derivedContentId },
    data: { postContent, mediaUrls },
  })
}

/** Push caption + image to all social rows; publish or replace-on-platform. */
export async function syncCaptionToSocial(
  derivedContentId: string,
  opts: { publish?: boolean } = {},
) {
  const caption = await prisma.derivedContent.findUnique({ where: { id: derivedContentId } })
  if (!caption || caption.contentType !== 'SOCIAL_CAPTION') {
    throw new Error('SOCIAL_CAPTION bulunamadı')
  }

  const mediaUrls = await ensureGeneratedPostImage(derivedContentId)
  await syncPostRowsFromCaption(derivedContentId, caption.content, mediaUrls)

  if (!opts.publish) {
    return { mediaUrls, published: 0, results: [] as Array<{ postId: string; ok: boolean }> }
  }

  const posts = await prisma.socialMediaPost.findMany({
    where: { derivedContentId },
    include: { account: true },
  })

  const results: Array<{
    postId: string
    ok: boolean
    platformPostId?: string
    error?: string
    skipped?: boolean
    replaced?: boolean
    imageError?: string
  }> = []
  const { publishPost } = await import('./publish')

  for (const post of posts) {
    if (!post.account.isActive) {
      results.push({ postId: post.id, ok: false, error: 'Hesap pasif' })
      continue
    }
    if (post.status === 'PUBLISHING') {
      results.push({ postId: post.id, ok: false, error: 'Yayın devam ediyor' })
      continue
    }

    const replace = post.status === 'PUBLISHED'
    const canPublish = ['DRAFT', 'FAILED', 'SCHEDULED', 'PUBLISHED'].includes(post.status)
    if (!canPublish) {
      results.push({ postId: post.id, ok: false, error: `Status ${post.status} yayınlanamaz` })
      continue
    }

    try {
      const out = await publishPost(post.id, {
        replace,
        requireImage: post.platform === 'LINKEDIN',
        force: false,
      })
      if (out.skipped) {
        results.push({
          postId: post.id,
          ok: true,
          skipped: true,
          platformPostId: out.platformPostId || undefined,
          imageError: out.imageError,
        })
      } else {
        results.push({
          postId: post.id,
          ok: true,
          platformPostId: out.platformPostId || undefined,
          replaced: out.replaced,
          imageError: out.imageError,
        })
      }
    } catch (err) {
      results.push({
        postId: post.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    mediaUrls,
    published: results.filter((r) => r.ok && !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    results,
  }
}

/** Generate images + publish/update all posts for a caption. */
export async function publishCaptionWithImages(derivedContentId: string) {
  return syncCaptionToSocial(derivedContentId, { publish: true })
}

/** When caption text changes — update platform posts (delete old + publish new). */
export async function updatePublishedSocialPosts(derivedContentId: string, postContent: string) {
  const mediaUrls = await ensureGeneratedPostImage(derivedContentId)
  await syncPostRowsFromCaption(derivedContentId, postContent, mediaUrls)

  const posts = await prisma.socialMediaPost.findMany({
    where: { derivedContentId, status: 'PUBLISHED' },
    include: { account: true },
  })

  const { publishPost } = await import('./publish')
  for (const post of posts) {
    if (!post.account.isActive || post.account.accountId.startsWith('dryrun_')) continue
    await publishPost(post.id, { replace: true, requireImage: post.platform === 'LINKEDIN', force: true })
  }
}

/** Generate images for all approved captions and attach to every post row. */
export async function syncPostImagesFromCaptions() {
  const captions = await prisma.derivedContent.findMany({
    where: { contentType: 'SOCIAL_CAPTION', status: { in: ['APPROVED', 'PUBLISHED'] } },
  })
  let postsUpdated = 0
  const images: Array<{ derivedContentId: string; mediaUrls: string[] }> = []

  for (const caption of captions) {
    const mediaUrls = await ensureGeneratedPostImage(caption.id)
    images.push({ derivedContentId: caption.id, mediaUrls })
    const result = await prisma.socialMediaPost.updateMany({
      where: { derivedContentId: caption.id },
      data: { mediaUrls },
    })
    postsUpdated += result.count
  }

  return { captions: captions.length, postsUpdated, images }
}

/** Replace platform post (delete old + publish new) — same DB row. */
export async function updatePostOnPlatform(postId: string) {
  const post = await prisma.socialMediaPost.findUnique({
    where: { id: postId },
    include: { account: true },
  })
  if (!post) throw new Error('Post not found')
  if (!post.account.isActive) throw new Error('Hesap pasif')

  const mediaUrls = await ensureGeneratedPostImage(post.derivedContentId)
  await prisma.socialMediaPost.update({
    where: { id: postId },
    data: { mediaUrls },
  })

  const { publishPost } = await import('./publish')
  return publishPost(postId, { replace: true, requireImage: post.platform === 'LINKEDIN', force: true })
}
