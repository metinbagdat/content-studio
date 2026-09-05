import { prisma } from '../prisma'
import { createSocialDraftsForDerived, schedulePost } from '../pipeline'
import { pickPostingSlot } from '../scheduling/postingTimes'
import { canonicalArticleUrl } from '../content/canonicalUrl'
import { isDurableMediaUrl } from '../video/videoStorage'
import { ensureGeneratedVideo, buildYouTubePostContent, isShortFormVideo } from './publishVideo'
import { preparePostForPublish, isDryRunAccount } from './preparePublish'
import { publishPost } from './publish'
import { getValidAccessToken } from './tokenRefresh'
import { testYouTubeConnection } from './youtubeApi'

export type YouTubeBackfillResult = {
  scanned: number
  videosGenerated: number
  draftsCreated: number
  scheduled: number
  published: number
  skipped: number
  errors: string[]
  publishedIds: string[]
}

export type YouTubeSyncOptions = {
  /** Max scripts to scan (default 10). */
  limit?: number
  /** Cap actual uploads — SEO drain defaults to 1 (no Shorts burst). */
  maxPublish?: number
  /** Prefer VIDEO_SCRIPT / 16:9 over SHORT_VIDEO_SCRIPT. */
  preferLongForm?: boolean
  /** Only this ContentSource id. */
  sourceId?: string
  /** Only sources tagged wp-link:{url} (substring match). */
  wpLinkContains?: string
  /** Only this derivedContent id. */
  derivedId?: string
  /** ffmpeg generate — default false for SEO drain (use Blob/local MP4). */
  generateVideo?: boolean
  /** Require MediaFile.fileUrl on Blob CDN before publish (default true when publishNow). */
  requireDurableVideo?: boolean
  schedule?: boolean
  publishNow?: boolean
}

/**
 * Process approved YouTube-targeted scripts: optional generate → draft → schedule → publish.
 * CS-SM-SEO-03: prefer long-form, maxPublish=1, durable Blob URL, no 11-Shorts burst.
 */
export async function syncYouTubeFromApprovedVideos(
  options: YouTubeSyncOptions = {},
): Promise<YouTubeBackfillResult> {
  const limit = options.limit ?? 10
  const maxPublish = options.maxPublish ?? (options.publishNow ? 1 : 0)
  const preferLongForm = options.preferLongForm !== false
  const generateVideo = options.generateVideo === true
  const requireDurable =
    options.requireDurableVideo !== undefined
      ? options.requireDurableVideo
      : Boolean(options.publishNow)
  const result: YouTubeBackfillResult = {
    scanned: 0,
    videosGenerated: 0,
    draftsCreated: 0,
    scheduled: 0,
    published: 0,
    skipped: 0,
    errors: [],
    publishedIds: [],
  }

  const ytAccount = await prisma.socialMediaAccount.findFirst({
    where: {
      platform: 'YOUTUBE',
      isActive: true,
      accountId: { not: { startsWith: 'dryrun_' } },
    },
  })
  if (!ytAccount) {
    result.errors.push('YouTube OAuth hesabı bağlı değil')
    return result
  }

  try {
    const token = await getValidAccessToken(ytAccount)
    const test = await testYouTubeConnection(token)
    if (!test.ok) {
      result.errors.push(`YouTube OAuth: ${test.error}`)
      return result
    }
  } catch (err) {
    result.errors.push(`YouTube token: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }

  const typeOrder = preferLongForm
    ? (['VIDEO_SCRIPT', 'PODCAST_SCRIPT', 'SHORT_VIDEO_SCRIPT'] as const)
    : (['SHORT_VIDEO_SCRIPT', 'VIDEO_SCRIPT', 'PODCAST_SCRIPT'] as const)

  const scripts = await prisma.derivedContent.findMany({
    where: {
      ...(options.derivedId ? { id: options.derivedId } : {}),
      ...(options.sourceId ? { sourceId: options.sourceId } : {}),
      contentType: { in: [...typeOrder] },
      status: { in: ['APPROVED', 'PUBLISHED'] },
      metadata: { path: ['platform'], equals: 'YOUTUBE' },
    },
    include: { source: { select: { id: true, title: true, tags: true } } },
    orderBy: { approvedAt: 'asc' },
    take: Math.max(limit * 3, 30),
  })

  let filtered = scripts
  if (options.wpLinkContains) {
    const needle = options.wpLinkContains.toLowerCase()
    filtered = scripts.filter((s) =>
      (s.source.tags || []).some(
        (t) => t.toLowerCase().includes('wp-link:') && t.toLowerCase().includes(needle),
      ),
    )
  }

  filtered = [...filtered].sort((a, b) => {
    const ai = typeOrder.indexOf(a.contentType as (typeof typeOrder)[number])
    const bi = typeOrder.indexOf(b.contentType as (typeof typeOrder)[number])
    const aRank = ai === -1 ? 99 : ai
    const bRank = bi === -1 ? 99 : bi
    if (aRank !== bRank) return aRank - bRank
    return (a.approvedAt?.getTime() || 0) - (b.approvedAt?.getTime() || 0)
  })

  filtered = filtered.slice(0, limit)

  for (const script of filtered) {
    if (options.publishNow && result.published >= maxPublish) {
      result.skipped += 1
      continue
    }

    result.scanned += 1
    try {
      if (generateVideo) {
        await ensureGeneratedVideo(script.id)
        result.videosGenerated += 1
      }

      if (requireDurable || options.publishNow) {
        const media = await prisma.mediaFile.findFirst({
          where: {
            derivedContentId: script.id,
            mediaType: 'VIDEO',
            processingStatus: 'COMPLETED',
          },
          orderBy: { createdAt: 'desc' },
        })
        if (!media || !isDurableMediaUrl(media.fileUrl)) {
          result.skipped += 1
          result.errors.push(
            `${script.title.slice(0, 40)}: Blob URL yok — yerelde üret + upload-videos-to-blob`,
          )
          continue
        }
      }

      const articleUrl = canonicalArticleUrl(script.source.tags)
      const postContent = buildYouTubePostContent({
        title: script.title,
        content: script.content,
        contentType: script.contentType,
        metadata: script.metadata,
        sourceTitle: script.source.title,
        articleUrl,
      })

      const before = await prisma.socialMediaPost.count({ where: { derivedContentId: script.id } })
      await createSocialDraftsForDerived(script.id, postContent, { skipImages: true })
      const after = await prisma.socialMediaPost.count({ where: { derivedContentId: script.id } })
      result.draftsCreated += Math.max(0, after - before)

      const posts = await prisma.socialMediaPost.findMany({
        where: { derivedContentId: script.id, platform: 'YOUTUBE' },
        include: { account: true },
      })

      for (const post of posts) {
        if (!post.account.isActive || isDryRunAccount(post.account)) continue

        // Refresh description with canonical if still draft
        if (post.status === 'DRAFT' || post.status === 'FAILED') {
          await prisma.socialMediaPost.update({
            where: { id: post.id },
            data: { postContent },
          })
        }

        if (options.schedule !== false && post.status === 'DRAFT') {
          const when = pickPostingSlot('YOUTUBE', 0, hashSlot(post.id))
          const scheduleAt = when.getTime() <= Date.now() ? new Date(Date.now() + 10 * 60_000) : when
          await schedulePost(post.id, scheduleAt)
          result.scheduled += 1
        }

        if (
          options.publishNow &&
          result.published < maxPublish &&
          (post.status === 'DRAFT' || post.status === 'FAILED' || post.status === 'SCHEDULED')
        ) {
          if (isShortFormVideo(script.contentType, script.metadata) && preferLongForm && maxPublish <= 1) {
            // Skip Shorts when SEO drain wants a single long-form upload
            const hasLonger = filtered.some(
              (s) =>
                s.id !== script.id &&
                (s.contentType === 'VIDEO_SCRIPT' || s.contentType === 'PODCAST_SCRIPT'),
            )
            if (hasLonger) {
              result.skipped += 1
              continue
            }
          }
          try {
            await preparePostForPublish(post.id)
            const pub = await publishPost(post.id, { requireVideo: true, force: true })
            result.published += 1
            if (pub.platformPostId) result.publishedIds.push(pub.platformPostId)
          } catch (err) {
            result.errors.push(
              `publish ${script.title.slice(0, 30)}: ${err instanceof Error ? err.message : String(err)}`,
            )
          }
        }
      }
    } catch (err) {
      result.errors.push(`${script.title.slice(0, 40)}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return result
}

function hashSlot(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h) % 3
}
