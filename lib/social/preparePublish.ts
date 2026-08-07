import { prisma } from '../prisma'
import { ensureGeneratedPostImage } from './publishCaption'
import { readPostImageBuffer } from '../media/generatePostImage'
import { readPublishMetrics } from './publishFingerprint'
import { resolveVideoMediaUrls } from './publishVideo'

/** Ensure media exists before publish (images for LinkedIn/X, video for YouTube). */
export async function preparePostForPublish(postId: string): Promise<string[]> {
  const post = await prisma.socialMediaPost.findUnique({ where: { id: postId } })
  if (!post) throw new Error('Post not found')

  if (post.platform === 'YOUTUBE') {
    const mediaUrls = await resolveVideoMediaUrls(post.derivedContentId)
    if (mediaUrls.length) {
      await prisma.socialMediaPost.update({
        where: { id: postId },
        data: { mediaUrls },
      })
    }
    return mediaUrls
  }

  let mediaUrls =
    post.mediaUrls.filter((u) => u.startsWith('http')).length > 0
      ? post.mediaUrls
      : await ensureGeneratedPostImage(post.derivedContentId)

  if (!mediaUrls.length) {
    mediaUrls = await ensureGeneratedPostImage(post.derivedContentId)
  }

  if (post.platform === 'LINKEDIN') {
    const local = await readPostImageBuffer(post.derivedContentId)
    if (!local) {
      mediaUrls = await ensureGeneratedPostImage(post.derivedContentId)
    }
  }

  if (mediaUrls.length) {
    await prisma.socialMediaPost.update({
      where: { id: postId },
      data: { mediaUrls },
    })
  }

  return mediaUrls
}

/** Reset posts stuck in PUBLISHING (crash mid-flight). */
export async function recoverStuckPublishing(maxAgeMin = 5): Promise<number> {
  const cutoff = Date.now() - maxAgeMin * 60_000
  const stuck = await prisma.socialMediaPost.findMany({
    where: { status: 'PUBLISHING' },
    select: { id: true, scheduledAt: true, metrics: true },
  })

  let recovered = 0
  for (const p of stuck) {
    const meta = readPublishMetrics(p.metrics)
    const started = meta.publishingStartedAt
      ? new Date(meta.publishingStartedAt).getTime()
      : 0
    if (started && started > cutoff) continue

    await prisma.socialMediaPost.update({
      where: { id: p.id },
      data: {
        status: p.scheduledAt ? 'SCHEDULED' : 'FAILED',
        error: 'Yayın yarıda kesildi — otomatik kurtarma, tekrar denenecek',
      },
    })
    recovered += 1
  }
  return recovered
}

export function isDryRunAccount(account: {
  accountId: string
  config: unknown
}): boolean {
  if (account.accountId.startsWith('dryrun_')) return true
  const cfg =
    account.config && typeof account.config === 'object'
      ? (account.config as Record<string, unknown>)
      : {}
  return Boolean(cfg.dryRun)
}
