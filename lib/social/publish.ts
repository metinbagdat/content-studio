import { linkedinUploadImageFromUrl, linkedinUploadImageFromBuffer } from './linkedinMedia'
import { linkedinAuthorUrn } from './config'
import { getValidAccessToken } from './tokenRefresh'
import { resolvePostMediaUrls, readPostImageBuffer } from './brandImage'
import { deletePlatformPost } from './platformDelete'
import {
  postContentFingerprint,
  readPublishMetrics,
  type PostPublishMetrics,
} from './publishFingerprint'
import { prisma } from '../prisma'

export type PublishOptions = {
  /** Delete existing platform post before publishing (update-in-place flow). */
  replace?: boolean
  /** Fail when image was expected but upload failed. */
  requireImage?: boolean
  /** Publish even if fingerprint unchanged. */
  force?: boolean
}

export type PublishResult = {
  success?: boolean
  skipped?: boolean
  platformPostId?: string | null
  replaced?: boolean
  imageAttached?: boolean
  imageError?: string
  reason?: string
  deleteError?: string
}

/**
 * Publish or update a social post.
 * Update = delete old platform post + publish new (same DB row, no duplicate).
 */
export async function publishPost(postId: string, options: PublishOptions = {}): Promise<PublishResult> {
  const post = await prisma.socialMediaPost.findUnique({
    where: { id: postId },
    include: { account: true },
  })
  if (!post) throw new Error('Post not found')
  if (post.status === 'PUBLISHING') {
    throw new Error('Yayın zaten devam ediyor — birkaç saniye bekleyin')
  }

  const mediaUrls =
    post.mediaUrls.length > 0 ? post.mediaUrls : await resolvePostMediaUrls(post.derivedContentId)
  const fingerprint = postContentFingerprint(post.postContent, mediaUrls)
  const prevMetrics = readPublishMetrics(post.metrics)

  const isPublished = post.status === 'PUBLISHED' && Boolean(post.platformPostId)
  const unchanged = isPublished && prevMetrics.publishHash === fingerprint

  if (isPublished && unchanged && !options.force) {
    return {
      skipped: true,
      platformPostId: post.platformPostId,
      reason: 'İçerik değişmedi — çift paylaşım engellendi',
      imageAttached: prevMetrics.imageAttached,
      imageError: prevMetrics.imageError,
    }
  }

  const shouldReplace = Boolean(
    (options.replace && isPublished) || (isPublished && !unchanged),
  )
  const requireImage = options.requireImage ?? true

  await prisma.socialMediaPost.update({
    where: { id: postId },
    data: { status: 'PUBLISHING', mediaUrls, error: null },
  })

  const accessToken = await getValidAccessToken(post.account)
  let deleteError: string | undefined
  let deletedFromPlatform = false
  const previousPlatformPostId = post.platformPostId

  if (shouldReplace && previousPlatformPostId) {
    const del = await deletePlatformPost(post.platform, previousPlatformPostId, accessToken)
    deletedFromPlatform = del.deleted
    if (!del.deleted && del.error) {
      deleteError = del.error
      if (requireImage || post.platform === 'LINKEDIN') {
        await prisma.socialMediaPost.update({
          where: { id: postId },
          data: {
            status: 'FAILED',
            error: `Eski paylaşım silinemedi: ${deleteError}`,
          },
        })
        throw new Error(`Eski paylaşım silinemedi: ${deleteError}`)
      }
    }
  }

  try {
    let platformPostId: string
    let imageAttached = false
    let imageError: string | undefined

    if (post.platform === 'TWITTER') {
      platformPostId = await publishTwitter(post.postContent, accessToken)
    } else if (post.platform === 'LINKEDIN') {
      const author = linkedinAuthorUrn(post.account.accountId, post.account.config)
      const li = await publishLinkedIn(
        post.postContent,
        accessToken,
        author,
        post.account,
        mediaUrls,
        post.derivedContentId,
        requireImage,
      )
      platformPostId = li.platformPostId
      imageAttached = li.imageAttached
      imageError = li.imageError
      if (imageError && requireImage) {
        throw new Error(imageError)
      }
    } else {
      throw new Error(`Platform not implemented in Faz 1: ${post.platform}`)
    }

    const metrics: PostPublishMetrics = {
      publishHash: fingerprint,
      imageAttached,
      imageError,
      replaced: shouldReplace,
      previousPlatformPostId: shouldReplace ? previousPlatformPostId || undefined : undefined,
      deletedFromPlatform,
      deleteError,
      updatedAt: new Date().toISOString(),
    }

    await prisma.socialMediaPost.update({
      where: { id: postId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        platformPostId,
        error: imageError || null,
        metrics,
      },
    })

    await prisma.derivedContent.update({
      where: { id: post.derivedContentId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    })

    try {
      const { syncPostAnalytics } = await import('./platformStats')
      await syncPostAnalytics(postId)
    } catch {
      /* stats optional */
    }

    return {
      success: true,
      platformPostId,
      replaced: shouldReplace,
      imageAttached,
      imageError,
      deleteError,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.socialMediaPost.update({
      where: { id: postId },
      data: {
        status: previousPlatformPostId && !deletedFromPlatform ? 'PUBLISHED' : 'FAILED',
        platformPostId: previousPlatformPostId && !deletedFromPlatform ? previousPlatformPostId : post.platformPostId,
        error: message,
      },
    })
    throw err
  }
}

async function publishTwitter(text: string, accessToken: string): Promise<string> {
  if (!accessToken || accessToken === 'dry-run' || !process.env.X_CLIENT_ID) {
    return `mock_x_${Date.now()}`
  }
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: text.slice(0, 280) }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`X API ${res.status}: ${body}`)
  }
  const data = (await res.json()) as { data?: { id?: string } }
  return data.data?.id || `x_${Date.now()}`
}

type LinkedInPublishOutcome = {
  platformPostId: string
  imageAttached: boolean
  imageError?: string
}

async function publishLinkedIn(
  text: string,
  accessToken: string,
  authorUrn: string,
  account: { config: unknown; accountId: string } | undefined,
  mediaUrls: string[] = [],
  derivedContentId?: string,
  requireImage = true,
): Promise<LinkedInPublishOutcome> {
  if (!accessToken || accessToken === 'dry-run') {
    return { platformPostId: `mock_li_${Date.now()}`, imageAttached: false }
  }

  const cfg =
    account?.config && typeof account.config === 'object'
      ? (account.config as Record<string, unknown>)
      : {}
  const authorFromConfig = typeof cfg.linkedinAuthorUrn === 'string' ? cfg.linkedinAuthorUrn : authorUrn
  const author = authorFromConfig.startsWith('urn:')
    ? authorFromConfig
    : `urn:li:person:${authorFromConfig}`

  const imageUrl = mediaUrls.find((u) => u.startsWith('http'))
  const localBuffer = derivedContentId ? await readPostImageBuffer(derivedContentId) : null
  const wantsImage = Boolean(localBuffer || imageUrl)

  let shareContent: Record<string, unknown>
  let imageAttached = false
  let imageError: string | undefined

  if (wantsImage) {
    try {
      let asset: string
      if (localBuffer) {
        asset = await linkedinUploadImageFromBuffer(accessToken, author, localBuffer, 'image/png')
      } else if (imageUrl) {
        asset = await linkedinUploadImageFromUrl(accessToken, author, imageUrl)
      } else {
        throw new Error('Görsel bulunamadı')
      }
      imageAttached = true
      shareContent = {
        shareCommentary: { text },
        shareMediaCategory: 'IMAGE',
        media: [
          {
            status: 'READY',
            description: { text: 'egitim.today' },
            media: asset,
            title: { text: 'egitim.today' },
          },
        ],
      }
    } catch (err) {
      imageError = `Görsel yüklenemedi: ${err instanceof Error ? err.message : String(err)}`
      if (requireImage) throw new Error(imageError)
      shareContent = {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      }
    }
  } else {
    shareContent = {
      shareCommentary: { text },
      shareMediaCategory: 'NONE',
    }
  }

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': shareContent,
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LinkedIn API ${res.status}: ${body}`)
  }

  return {
    platformPostId: res.headers.get('x-restli-id') || `li_${Date.now()}`,
    imageAttached,
    imageError,
  }
}

/** Process due SCHEDULED posts (DB poll fallback). */
export async function drainDuePosts(limit = 10) {
  const due = await prisma.socialMediaPost.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: new Date() },
    },
    take: limit,
    orderBy: { scheduledAt: 'asc' },
  })
  for (const p of due) {
    try {
      await publishPost(p.id, { requireImage: true })
    } catch (err) {
      console.error('[drainDuePosts]', p.id, err)
    }
  }
  return due.length
}
