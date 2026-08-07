import { prisma } from '../prisma'
import { createSocialDraftsForDerived, schedulePost } from '../pipeline'
import { pickPostingSlot } from '../scheduling/postingTimes'
import { ensureGeneratedVideo, buildYouTubePostContent } from './publishVideo'
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
  errors: string[]
}

/** Process approved video scripts: generate MP4 → draft → schedule (optional publish). */
export async function syncYouTubeFromApprovedVideos(options: {
  limit?: number
  generateVideo?: boolean
  schedule?: boolean
  publishNow?: boolean
} = {}): Promise<YouTubeBackfillResult> {
  const limit = options.limit ?? 10
  const result: YouTubeBackfillResult = {
    scanned: 0,
    videosGenerated: 0,
    draftsCreated: 0,
    scheduled: 0,
    published: 0,
    errors: [],
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

  const scripts = await prisma.derivedContent.findMany({
    where: {
      contentType: { in: ['VIDEO_SCRIPT', 'SHORT_VIDEO_SCRIPT'] },
      status: { in: ['APPROVED', 'PUBLISHED'] },
    },
    orderBy: { approvedAt: 'asc' },
    take: limit,
  })

  for (const script of scripts) {
    result.scanned += 1
    try {
      if (options.generateVideo !== false) {
        await ensureGeneratedVideo(script.id)
        result.videosGenerated += 1
      }

      const postContent = buildYouTubePostContent({
        title: script.title,
        content: script.content,
        contentType: script.contentType,
        metadata: script.metadata,
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

        if (options.schedule !== false && post.status === 'DRAFT') {
          const when = pickPostingSlot('YOUTUBE', 0, hashSlot(post.id))
          const scheduleAt = when.getTime() <= Date.now() ? new Date(Date.now() + 10 * 60_000) : when
          await schedulePost(post.id, scheduleAt)
          result.scheduled += 1
        }

        if (options.publishNow && (post.status === 'DRAFT' || post.status === 'FAILED' || post.status === 'SCHEDULED')) {
          try {
            await preparePostForPublish(post.id)
            await publishPost(post.id, { requireVideo: true })
            result.published += 1
          } catch (err) {
            result.errors.push(`publish ${script.title.slice(0, 30)}: ${err instanceof Error ? err.message : String(err)}`)
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
