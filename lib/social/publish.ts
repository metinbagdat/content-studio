import { linkedinUploadImageFromUrl, linkedinUploadImageFromBuffer } from './linkedinMedia'
import { linkedinAuthorUrn } from './config'
import { getValidAccessToken } from './tokenRefresh'
import { resolvePostMediaUrls, readPostImageBuffer } from './brandImage'
import { deletePlatformPost } from './platformDelete'
import { preparePostForPublish, isDryRunAccount, recoverStuckPublishing } from './preparePublish'
import {
  postContentFingerprint,
  readPublishMetrics,
  type PostPublishMetrics,
} from './publishFingerprint'
import { ensureGeneratedVideo, buildYouTubeMetadata } from './publishVideo'
import { canonicalArticleUrl } from '../content/canonicalUrl'
import { uploadYouTubeVideo, setYouTubeThumbnail } from './youtubeApi'
import { publishFacebookPost, publishInstagramPost, publishInstagramReel, publishFacebookVideoPost } from './publishMeta'
import { uploadTikTokVideo } from './tiktokApi'
import { pinterestConfigured } from './pinterestApi'
import { prisma } from '../prisma'

export type PublishOptions = {
  /** Delete existing platform post before publishing (update-in-place flow). */
  replace?: boolean
  /** Fail when image was expected but upload failed. */
  requireImage?: boolean
  /** Fail when video was expected but upload failed. */
  requireVideo?: boolean
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
  videoAttached?: boolean
  videoError?: string
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
  const requireVideo = options.requireVideo ?? false

  await prisma.socialMediaPost.update({
    where: { id: postId },
    data: {
      status: 'PUBLISHING',
      mediaUrls,
      error: null,
      metrics: {
        ...prevMetrics,
        publishingStartedAt: new Date().toISOString(),
      },
    },
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
      // Don't block new publish if old post can't be deleted (permissions / already removed)
      console.warn('[publishPost] delete old platform post failed, continuing', deleteError)
    }
  }

  try {
    let platformPostId: string
    let imageAttached = false
    let imageError: string | undefined
    let videoAttached = false
    let videoError: string | undefined

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
    } else if (post.platform === 'YOUTUBE') {
      const yt = await publishYouTube(
        post,
        accessToken,
        requireVideo,
      )
      platformPostId = yt.platformPostId
      videoAttached = yt.videoAttached
      videoError = yt.videoError
    } else if (post.platform === 'FACEBOOK') {
      const fb = await publishFacebook(post, accessToken, requireImage, mediaUrls)
      platformPostId = fb.platformPostId
      imageAttached = fb.imageAttached ?? false
      imageError = fb.imageError
      videoAttached = fb.videoAttached ?? false
      videoError = fb.videoError
    } else if (post.platform === 'INSTAGRAM') {
      const ig = await publishInstagram(post, accessToken, mediaUrls, requireImage)
      platformPostId = ig.platformPostId
      imageAttached = ig.imageAttached ?? false
      imageError = ig.imageError
      videoAttached = ig.videoAttached ?? false
      videoError = ig.videoError
	} else if (post.platform === 'TIKTOK') {
      const tt = await publishTikTok(post, accessToken, requireVideo)
      platformPostId = tt.platformPostId
      videoAttached = tt.videoAttached
      videoError = tt.videoError
    } else if (post.platform === 'PINTEREST') {
      const pin = await publishPinterest(post, accessToken, requireImage, mediaUrls)
      platformPostId = pin.platformPostId
      imageAttached = pin.imageAttached ?? false
      imageError = pin.imageError
    } else {
      throw new Error(
        `${post.platform} için gerçek yayın API'si Faz 2'de eklenecek — altyapı (hesap, taslak, otomasyon) hazır, ` +
          'sadece OAuth entegrasyonu bekleniyor. Şimdilik dry-run ile test edilebilir.',
      )
    }

    const metrics: PostPublishMetrics = {
      publishHash: fingerprint,
      imageAttached,
      imageError,
      videoAttached,
      videoError,
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
        error: imageError || videoError || null,
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
      videoAttached,
      videoError,
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
  const { parseXApiError } = await import('./xApi')
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
    throw new Error(parseXApiError(res.status, body))
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
  const localImage = derivedContentId ? await readPostImageBuffer(derivedContentId) : null
  const wantsImage = Boolean(localImage || imageUrl)

  let shareContent: Record<string, unknown>
  let imageAttached = false
  let imageError: string | undefined

  if (wantsImage) {
    try {
      let asset: string
      if (localImage) {
        asset = await linkedinUploadImageFromBuffer(
          accessToken,
          author,
          localImage.buffer,
          localImage.contentType,
        )
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
      console.warn('[publishLinkedIn] image upload failed, posting text-only', imageError)
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

type YouTubePublishOutcome = {
  platformPostId: string
  videoAttached: boolean
  videoError?: string
}

async function publishYouTube(
  post: {
    derivedContentId: string
    postContent: string
    account: { config: unknown }
  },
  accessToken: string,
  requireVideo = true,
): Promise<YouTubePublishOutcome> {
  if (!accessToken || accessToken === 'dry-run' || !process.env.YOUTUBE_CLIENT_ID) {
    return { platformPostId: `mock_yt_${Date.now()}`, videoAttached: false }
  }

  const derived = await prisma.derivedContent.findUnique({
    where: { id: post.derivedContentId },
    include: { source: true },
  })
  if (!derived) throw new Error('Derived content not found')

  let videoAttached = false
  let videoError: string | undefined

  try {
    const video = await ensureGeneratedVideo(post.derivedContentId)
    const ytMeta = buildYouTubeMetadata({
      title: derived.title,
      content: derived.content,
      contentType: derived.contentType,
      metadata: derived.metadata,
      sourceTitle: derived.source.title,
      articleUrl: canonicalArticleUrl(derived.source.tags),
    })

    const privacy =
      (process.env.YOUTUBE_PRIVACY as 'public' | 'unlisted' | 'private' | undefined) || 'public'

    const { videoId } = await uploadYouTubeVideo({
      accessToken,
      videoPath: video.diskPath,
      title: ytMeta.title,
      description: ytMeta.description,
      tags: ytMeta.tags,
      privacyStatus: privacy,
      isShort: ytMeta.isShort,
    })
    videoAttached = true

    try {
      const thumb = await readPostImageBuffer(post.derivedContentId)
      if (thumb) {
        await setYouTubeThumbnail(accessToken, videoId, thumb.buffer, thumb.contentType)
      }
    } catch (err) {
      console.warn('[publishYouTube] thumbnail upload failed (non-fatal)', err)
    }

    return { platformPostId: videoId, videoAttached }
  } catch (err) {
    videoError = err instanceof Error ? err.message : String(err)
    if (requireVideo) throw new Error(videoError)
    console.warn('[publishYouTube] video upload failed', videoError)
    return { platformPostId: `mock_yt_${Date.now()}`, videoAttached: false, videoError }
  }
}

type MetaFlowOutcome = {
  platformPostId: string
  imageAttached?: boolean
  imageError?: string
  videoAttached?: boolean
  videoError?: string
}

function readAccountConfig(config: unknown): Record<string, unknown> {
  return config && typeof config === 'object' ? (config as Record<string, unknown>) : {}
}

async function publishFacebook(
  post: { postContent: string; derivedContentId: string; account: { config: unknown } },
  pageAccessToken: string,
  requireImage: boolean,
  mediaUrls: string[] = [],
): Promise<MetaFlowOutcome> {
  if (!pageAccessToken || pageAccessToken === 'dry-run') {
    return { platformPostId: `mock_fb_${Date.now()}`, imageAttached: false }
  }
  const cfg = readAccountConfig(post.account.config)
  const pageId = String(cfg.pageId || '')
  if (!pageId) throw new Error('Facebook pageId eksik — hesabı yeniden bağlayın')

  const { readPostClipBuffer } = await import('../media/generatePostClip')
  const clip = await readPostClipBuffer(post.derivedContentId)
  if (clip) {
    try {
      const out = await publishFacebookVideoPost(
        pageId,
        pageAccessToken,
        post.postContent,
        clip.buffer,
      )
      return { platformPostId: out.platformPostId, videoAttached: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[publishFacebook] animated clip failed, falling back to image', message)
      if (requireImage && !mediaUrls.some((u) => u.includes('/image'))) {
        return {
          platformPostId: `mock_fb_${Date.now()}`,
          videoAttached: false,
          videoError: message,
        }
      }
    }
  }

  const local = await readPostImageBuffer(post.derivedContentId)
  try {
    const out = await publishFacebookPost(pageId, pageAccessToken, post.postContent, local?.buffer)
    return { platformPostId: out.platformPostId, imageAttached: out.imageAttached, imageError: out.imageError }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (requireImage) throw err
    console.warn('[publishFacebook] failed, retrying text-only', message)
    return { ...(await publishFacebookPost(pageId, pageAccessToken, post.postContent)), imageError: message }
  }
}

async function publishInstagram(
  post: { postContent: string; derivedContentId: string; account: { config: unknown } },
  pageAccessToken: string,
  mediaUrls: string[],
  requireImage: boolean,
): Promise<MetaFlowOutcome> {
  if (!pageAccessToken || pageAccessToken === 'dry-run') {
    return { platformPostId: `mock_ig_${Date.now()}`, imageAttached: false }
  }
  const cfg = readAccountConfig(post.account.config)
  const igUserId = String(cfg.igUserId || '')
  if (!igUserId) throw new Error('Instagram igUserId eksik — hesabı yeniden bağlayın')

  const clipUrl = mediaUrls.find((u) => u.startsWith('https://') && u.includes('/video'))
  if (clipUrl) {
    try {
      const reel = await publishInstagramReel(
        igUserId,
        pageAccessToken,
        post.postContent,
        clipUrl,
      )
      return { platformPostId: reel.platformPostId, videoAttached: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[publishInstagram] reel failed, falling back to image', message)
    }
  }

  const imageUrl = mediaUrls.find(
    (u) => u.startsWith('http') && (u.includes('/image') || !u.includes('/video')),
  )
  if (!imageUrl) {
    const message = 'Instagram görsel veya klip gerektirir — herkese açık bir URL bulunamadı'
    if (requireImage) throw new Error(message)
    return { platformPostId: `mock_ig_${Date.now()}`, imageAttached: false, imageError: message }
  }

  try {
    const out = await publishInstagramPost(igUserId, pageAccessToken, post.postContent, imageUrl)
    return { platformPostId: out.platformPostId, imageAttached: out.imageAttached, imageError: out.imageError }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (requireImage) throw err
    return { platformPostId: `mock_ig_${Date.now()}`, imageAttached: false, imageError: message }
  }
}

async function publishTikTok(
  post: { derivedContentId: string; postContent: string },
  accessToken: string,
  requireVideo: boolean,
): Promise<YouTubePublishOutcome> {
  if (!accessToken || accessToken === 'dry-run' || !process.env.TIKTOK_CLIENT_KEY) {
    return { platformPostId: `mock_tt_${Date.now()}`, videoAttached: false }
  }
  try {
    const video = await ensureGeneratedVideo(post.derivedContentId)
    const { readFile } = await import('fs/promises')
    const buffer = await readFile(video.diskPath)
    const result = await uploadTikTokVideo(accessToken, buffer, post.postContent)
    const suffix = result.isDraft ? ' (taslak — TikTok uygulamasından onaylanmalı)' : ''
    return { platformPostId: `${result.publishId}${suffix}`, videoAttached: true }
  } catch (err) {
    const videoError = err instanceof Error ? err.message : String(err)
    if (requireVideo) throw new Error(videoError)
    console.warn('[publishTikTok] failed', videoError)
    return { platformPostId: `mock_tt_${Date.now()}`, videoAttached: false, videoError }
  }
}

/** Pinterest Pins require a board and a publicly reachable image URL — no video yet. */
async function publishPinterest(
  post: { postContent: string; derivedContentId: string; account: { config: unknown } },
  accessToken: string,
  requireImage: boolean,
  mediaUrls: string[],
): Promise<MetaFlowOutcome> {
  if (!accessToken || accessToken === 'dry-run' || !pinterestConfigured()) {
    return { platformPostId: `mock_pin_${Date.now()}`, imageAttached: false }
  }
  const cfg = readAccountConfig(post.account.config)
  const boardId = String(cfg.boardId || process.env.PINTEREST_BOARD_ID || '')
  if (!boardId) throw new Error('Pinterest boardId eksik — hesabı yeniden bağlayın')

  const imageUrl = mediaUrls.find(
    (u) => u.startsWith('http') && (u.includes('/image') || !u.includes('/video')),
  )
  if (!imageUrl) {
    const message = 'Pinterest görsel gerektirir — herkese açık bir URL bulunamadı'
    if (requireImage) throw new Error(message)
    return { platformPostId: `mock_pin_${Date.now()}`, imageAttached: false, imageError: message }
  }

  const { publishPinterestPin } = await import('./pinterestApi')
  const { canonicalArticleUrl } = await import('../content/canonicalUrl')
  const derived = await prisma.derivedContent.findUnique({
    where: { id: post.derivedContentId },
    include: { source: { select: { tags: true, title: true } } },
  })
  const link =
    (derived?.metadata &&
      typeof derived.metadata === 'object' &&
      typeof (derived.metadata as Record<string, unknown>).articleUrl === 'string' &&
      String((derived.metadata as Record<string, unknown>).articleUrl)) ||
    (derived ? canonicalArticleUrl(derived.source.tags) : undefined) ||
    undefined

  try {
    const out = await publishPinterestPin(accessToken, boardId, {
      title: (derived?.title || post.postContent).slice(0, 100),
      description: post.postContent,
      link,
      imageUrl,
    })
    return { platformPostId: out.platformPostId, imageAttached: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (requireImage) throw err
    console.warn('[publishPinterest] failed', message)
    return { platformPostId: `mock_pin_${Date.now()}`, imageAttached: false, imageError: message }
  }
}

/** Process due SCHEDULED posts (DB poll fallback). */
export async function drainDuePosts(limit = 10) {
  await recoverStuckPublishing()

  const due = await prisma.socialMediaPost.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: new Date() },
    },
    take: limit,
    orderBy: { scheduledAt: 'asc' },
    include: { account: true },
  })

  let processed = 0
  for (const p of due) {
    if (!p.account.isActive || isDryRunAccount(p.account)) {
      console.warn('[drainDuePosts] skip inactive/dry-run', p.id, p.platform)
      continue
    }
    try {
      await preparePostForPublish(p.id)
      await publishPost(p.id, {
        requireImage:
          p.platform === 'LINKEDIN' || p.platform === 'INSTAGRAM' || p.platform === 'PINTEREST',
        requireVideo: p.platform === 'YOUTUBE',
      })
      processed += 1
    } catch (err) {
      console.error('[drainDuePosts]', p.id, err)
    }
  }
  return processed
}