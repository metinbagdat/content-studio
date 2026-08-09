import type { SocialPlatform } from '@prisma/client'
import { prisma } from '../prisma'
import { bulkPublishDraftPosts, syncSocialDraftsFromApprovedCaptions } from '../pipeline'
import { syncPostImagesFromCaptions, syncPostClipsFromCaptions } from '../social/publishCaption'
import { syncAllAccountStats, syncAllPublishedPostAnalytics } from '../social/platformStats'
import { runWorkerTick } from '../worker/runWorkerTick'
import { getWorkflowSnapshot, type WorkflowSnapshot } from './status'

/** Platforms with working OAuth publish in prod (Instagram needs public image URL). */
const AUTO_PUBLISH_PLATFORMS: SocialPlatform[] = ['LINKEDIN', 'FACEBOOK', 'TWITTER', 'YOUTUBE']

export type ContinueStepResult = {
  action: string
  summary: string
  manual?: string
  href?: string
  snapshot: WorkflowSnapshot
  details?: Record<string, unknown>
}

async function countPublishable(platform: SocialPlatform): Promise<number> {
  return prisma.socialMediaPost.count({
    where: {
      platform,
      status: { in: ['DRAFT', 'FAILED'] },
      account: {
        isActive: true,
        NOT: { accountId: { startsWith: 'dryrun_' } },
      },
    },
  })
}

/** Skip platforms with known API blocks (X 403 until developer portal tier fixed). */
const SKIP_AUTO_PUBLISH = new Set<SocialPlatform>(['TWITTER'])

async function pickBestPublishPlatform(): Promise<SocialPlatform | null> {
  let best: SocialPlatform | null = null
  let bestCount = 0
  for (const platform of AUTO_PUBLISH_PLATFORMS) {
    if (SKIP_AUTO_PUBLISH.has(platform)) continue
    const n = await countPublishable(platform)
    if (n > bestCount) {
      bestCount = n
      best = platform
    }
  }
  return bestCount > 0 ? best : null
}

/** Run the next safe automated step in Discovery → Publish flow. */
export async function runWorkflowContinueStep(): Promise<ContinueStepResult> {
  const before = await getWorkflowSnapshot()
  const { counts, accountHealth } = before

  if (counts.reviewPending > 0) {
    return {
      action: 'review',
      summary: `${counts.reviewPending} onay bekliyor — otomatik onay yapılmadı`,
      manual: 'Onay ekranında inceleyip toplu onayla',
      href: '/admin/review',
      snapshot: before,
    }
  }

  if (counts.podcastScripts > counts.podcastMedia) {
    return {
      action: 'media',
      summary: `${counts.podcastScripts - counts.podcastMedia} podcast sesi eksik`,
      manual: 'Medya ekranında ses üret veya toplu onayda otomatik medya açık olsun',
      href: '/admin/media',
      snapshot: before,
    }
  }

  const dueScheduled = await prisma.socialMediaPost.count({
    where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
  })
  if (dueScheduled > 0) {
    const tick = await runWorkerTick({ profile: 'quick' })
    const snapshot = await getWorkflowSnapshot()
    return {
      action: 'publish-scheduled',
      summary: `Zamanı gelen ${dueScheduled} post işlendi · yayınlanan: ${tick.duePostsPublished}`,
      snapshot,
      details: { tick: { duePostsPublished: tick.duePostsPublished, errors: tick.errors } },
    }
  }

  const sync = await syncSocialDraftsFromApprovedCaptions({ skipImages: true })
  await syncPostImagesFromCaptions().catch(() => null)
  const clipSync = await syncPostClipsFromCaptions(5).catch(() => ({ processed: 0, clips: [] }))

  const platform = await pickBestPublishPlatform()
  if (platform) {
    const limit = 10
    const result = await bulkPublishDraftPosts({ platform, limit, includeDryRun: false })
    await syncAllAccountStats().catch(() => null)
    await syncAllPublishedPostAnalytics(20).catch(() => null)
    const snapshot = await getWorkflowSnapshot()
    return {
      action: 'bulk-publish',
      summary: `${platform}: ${result.published} yayınlandı · ${result.failed} hata · ${result.skipped} atlandı (max ${limit}/adım)`,
      manual:
        result.published > 0
          ? 'Devam için tekrar «Sıradaki adım» veya SM kartında «Toplu yayınla»'
          : undefined,
      href: '/admin/social',
      snapshot,
      details: { platform, result, draftsSynced: sync.draftsCreated, clipsSynced: clipSync.processed },
    }
  }

  if (counts.failedPosts > 0 && accountHealth.brokenCount > 0) {
    const snapshot = await getWorkflowSnapshot()
    return {
      action: 'failed-check',
      summary: `${counts.failedPosts} başarısız post — çoğu Instagram/TikTok olabilir`,
      manual: 'Sosyal ekranda platform kartından OAuth ile X/LinkedIn/Facebook yayınla',
      href: '/admin/social',
      snapshot,
    }
  }

  if (counts.scheduledPosts > 0) {
    const tick = await runWorkerTick({ profile: 'daily' })
    const snapshot = await getWorkflowSnapshot()
    return {
      action: 'daily-maintenance',
      summary: `Günlük bakım · ${counts.scheduledPosts} zamanlanmış bekliyor · taslak sync: ${sync.draftsCreated}`,
      manual: 'Zamanlanmış post tarihini Takvim\'de kontrol et',
      href: '/admin/calendar',
      snapshot,
      details: { tick: { profile: tick.profile, duePostsPublished: tick.duePostsPublished } },
    }
  }

  const tick = await runWorkerTick({ profile: 'daily' })
  const snapshot = await getWorkflowSnapshot()
  return {
    action: 'daily-maintenance',
    summary: `Günlük bakım tamamlandı · taslak sync: ${sync.draftsCreated}`,
    snapshot,
    details: {
      tick: {
        duePostsPublished: tick.duePostsPublished,
        draftsSynced: tick.draftsSynced,
        analytics: tick.analytics?.accountsSynced,
      },
    },
  }
}
