import { prisma } from '../prisma'
import { pickPostingSlot } from '../scheduling/postingTimes'
import { schedulePost, syncSocialDraftsFromApprovedCaptions } from '../pipeline'
import { repairMissingSocialAccounts } from './accountAudit'
import { preparePostForPublish, isDryRunAccount } from './preparePublish'
import { publishPost } from './publish'
import { ensureGeneratedPostImage } from './publishCaption'
import { ensureGeneratedVideo } from './publishVideo'
import { readPublishMetrics } from './publishFingerprint'

export type AutopilotResult = {
  draftsSynced: number
  imagesEnsured: number
  videosEnsured: number
  scheduled: number
  published: number
  retried: number
  errors: string[]
}

/** Hands-off SM pipeline — on by default; set SOCIAL_AUTOPILOT=false to disable. */
export function isAutopilotEnabled(): boolean {
  return process.env.SOCIAL_AUTOPILOT !== 'false'
}

/** After video script approve: generate MP4 → schedule → optional publish. */
export async function afterVideoApproved(derivedContentId: string): Promise<void> {
  if (!isAutopilotEnabled()) return

  try {
    await ensureGeneratedVideo(derivedContentId)
  } catch (err) {
    console.warn('[autopilot] video ensure failed', derivedContentId, err)
  }

  const posts = await prisma.socialMediaPost.findMany({
    where: { derivedContentId, platform: 'YOUTUBE' },
    include: { account: true },
  })

  for (const post of posts) {
    if (!post.account.isActive || isDryRunAccount(post.account)) continue

    if (post.status === 'DRAFT') {
      const when = pickPostingSlot('YOUTUBE', 0, hashSlot(post.id), new Date())
      const scheduleAt = when.getTime() <= Date.now() ? new Date(Date.now() + 10 * 60_000) : when
      await schedulePost(post.id, scheduleAt)
    }

    if (process.env.SOCIAL_AUTO_PUBLISH === 'true' && (post.status === 'DRAFT' || post.status === 'FAILED')) {
      try {
        await preparePostForPublish(post.id)
        await publishPost(post.id, { requireVideo: true })
      } catch (err) {
        console.warn('[autopilot] YouTube publish failed', post.id, err)
      }
    }
  }
}

/** After caption approve: image → schedule → optional immediate publish. */
export async function afterCaptionApproved(derivedContentId: string): Promise<void> {
  if (!isAutopilotEnabled()) return

  try {
    await ensureGeneratedPostImage(derivedContentId)
  } catch (err) {
    console.warn('[autopilot] image ensure failed', derivedContentId, err)
  }

  const posts = await prisma.socialMediaPost.findMany({
    where: { derivedContentId },
    include: { account: true },
  })

  for (const post of posts) {
    if (!post.account.isActive || isDryRunAccount(post.account)) continue

    if (post.status === 'DRAFT') {
      const when = pickPostingSlot(post.platform, 0, hashSlot(post.id), new Date())
      const scheduleAt = when.getTime() <= Date.now() ? new Date(Date.now() + 5 * 60_000) : when
      await schedulePost(post.id, scheduleAt)
    }

    if (process.env.SOCIAL_AUTO_PUBLISH === 'true' && (post.status === 'DRAFT' || post.status === 'FAILED')) {
      try {
        await preparePostForPublish(post.id)
        await publishPost(post.id, {
          requireImage: post.platform === 'LINKEDIN',
          requireVideo: post.platform === 'YOUTUBE',
        })
      } catch (err) {
        console.warn('[autopilot] immediate publish failed', post.id, err)
      }
    }
  }
}

function hashSlot(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h) % 3
}

/** Worker tick: sync drafts, schedule, retry failed, publish due (via drainDuePosts separately). */
export async function runSocialAutopilot(limit = 8): Promise<AutopilotResult> {
  const result: AutopilotResult = {
    draftsSynced: 0,
    imagesEnsured: 0,
    videosEnsured: 0,
    scheduled: 0,
    published: 0,
    retried: 0,
    errors: [],
  }

  if (!isAutopilotEnabled()) return result

  try {
    await repairMissingSocialAccounts()
    const sync = await syncSocialDraftsFromApprovedCaptions()
    result.draftsSynced = sync.draftsCreated
  } catch (err) {
    result.errors.push(`sync: ${err instanceof Error ? err.message : String(err)}`)
  }

  const captions = await prisma.derivedContent.findMany({
    where: { contentType: 'SOCIAL_CAPTION', status: { in: ['APPROVED', 'PUBLISHED'] } },
    select: { id: true },
    take: limit,
    orderBy: { approvedAt: 'desc' },
  })

  for (const cap of captions.slice(0, 3)) {
    try {
      await ensureGeneratedPostImage(cap.id)
      result.imagesEnsured += 1
    } catch {
      /* fallback URL used inside ensure */
    }
  }

  const videoScripts = await prisma.derivedContent.findMany({
    where: {
      contentType: { in: ['VIDEO_SCRIPT', 'SHORT_VIDEO_SCRIPT'] },
      status: { in: ['APPROVED', 'PUBLISHED'] },
    },
    select: { id: true },
    take: 2,
    orderBy: { approvedAt: 'desc' },
  })

  for (const script of videoScripts) {
    try {
      await ensureGeneratedVideo(script.id)
      result.videosEnsured += 1
    } catch (err) {
      result.errors.push(`video ${script.id.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const drafts = await prisma.socialMediaPost.findMany({
    where: { status: 'DRAFT' },
    include: { account: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  for (const post of drafts) {
    if (!post.account.isActive || isDryRunAccount(post.account)) continue
    try {
      const when = pickPostingSlot(post.platform, 0, hashSlot(post.id))
      const scheduleAt = when.getTime() <= Date.now() ? new Date(Date.now() + 5 * 60_000) : when
      await schedulePost(post.id, scheduleAt)
      result.scheduled += 1
    } catch (err) {
      result.errors.push(`schedule ${post.id.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const failed = await prisma.socialMediaPost.findMany({
    where: { status: 'FAILED' },
    include: { account: true },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 5),
  })

  for (const post of failed) {
    if (!post.account.isActive || isDryRunAccount(post.account)) continue
    const meta = readPublishMetrics(post.metrics)
    const retries = meta.autopilotRetries ?? 0
    if (retries >= 3) continue
    const last = meta.lastAutopilotRetry ? new Date(meta.lastAutopilotRetry).getTime() : 0
    if (Date.now() - last < 30 * 60_000) continue

    try {
      await preparePostForPublish(post.id)
      await publishPost(post.id, {
        requireImage: post.platform === 'LINKEDIN',
        requireVideo: post.platform === 'YOUTUBE',
      })
      result.retried += 1
    } catch (err) {
      await prisma.socialMediaPost.update({
        where: { id: post.id },
        data: {
          metrics: {
            ...meta,
            autopilotRetries: retries + 1,
            lastAutopilotRetry: new Date().toISOString(),
          },
        },
      })
      result.errors.push(`retry ${post.platform}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return result
}
