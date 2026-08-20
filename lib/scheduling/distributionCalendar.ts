import type { SocialPlatform } from '@prisma/client'
import type { AtomizationPlan } from '../atomization/types'
import { maxPostsPerDay } from '../platforms/limits'
import { DEFAULT_PIPELINE_PLATFORMS } from '../platforms/targets'
import { isWeekendOffset, pickPostingSlot } from './postingTimes'
import { getAdaptiveSlotOrder } from './postingPerformance'

export type CalendarSlot = {
  platform: SocialPlatform
  dayOffset: number
  scheduledAt: Date
  contentKind: string
  slotIndex: number
}

export type DistributionCalendar = {
  sourceTitle: string
  distributionDays: number
  totalSlots: number
  slots: CalendarSlot[]
  createdAt: string
}

type BuildCalendarInput = {
  plan: AtomizationPlan
  sourceTitle: string
  platforms?: SocialPlatform[]
  startDate?: Date
}

/** Spread planned social pieces across distributionDays respecting daily limits.
 * Posting times per platform adapt to historical engagement once enough data exists (see
 * getAdaptiveSlotOrder) — falls back to the static OPTIMAL_POSTING_IST defaults otherwise. */
export async function buildDistributionCalendar(input: BuildCalendarInput): Promise<DistributionCalendar> {
  const { plan, sourceTitle, startDate = new Date() } = input
  const platforms: SocialPlatform[] = input.platforms?.length
    ? input.platforms
    : DEFAULT_PIPELINE_PLATFORMS

  // Precompute adaptive slot order per platform × weekday/weekend, once, before placing pieces
  const slotOrderCache = new Map<string, string[]>()
  for (const platform of platforms) {
    for (const weekend of [false, true]) {
      const key = `${platform}:${weekend}`
      slotOrderCache.set(key, await getAdaptiveSlotOrder(platform, weekend))
    }
  }

  const pieces = plan.contentPieces
  const queue: Array<{ platform: SocialPlatform; kind: string }> = []

  const push = (platform: SocialPlatform, kind: string, count: number) => {
    for (let i = 0; i < count; i++) queue.push({ platform, kind })
  }

  const pushPlatformPieces = (platform: SocialPlatform) => {
    switch (platform) {
      case 'TWITTER':
        push('TWITTER', 'twitter_post', pieces.twitterPosts)
        push('TWITTER', 'twitter_thread', pieces.twitterThreads)
        break
      case 'YOUTUBE':
        push('YOUTUBE', 'youtube_short', pieces.youtubeShorts)
        push('YOUTUBE', 'long_form_video', pieces.longFormVideo)
        break
      case 'LINKEDIN':
        push('LINKEDIN', 'linkedin_post', pieces.linkedinPosts)
        push('LINKEDIN', 'linkedin_carousel', pieces.linkedinCarousels)
        break
      case 'INSTAGRAM':
        push('INSTAGRAM', 'instagram_post', pieces.instagramPosts)
        push('INSTAGRAM', 'instagram_reel', pieces.instagramReels)
        break
      case 'TIKTOK':
        push('TIKTOK', 'tiktok_video', pieces.tiktokVideos)
        break
      case 'FACEBOOK':
        push('FACEBOOK', 'facebook_post', pieces.facebookPosts)
        break
      default:
        break
    }
  }

  // Follow segment / pipeline platform order (not a fixed TWITTER→… list)
  for (const platform of platforms) {
    pushPlatformPieces(platform)
  }

  const days = plan.distributionDays
  const slots: CalendarSlot[] = []
  const dailyCount: Record<string, number> = {}

  let day = 0
  let slotIdx = 0

  const canPlace = (item: { platform: SocialPlatform }, d: number): boolean => {
    const key = `${item.platform}:${d}`
    const used = dailyCount[key] || 0
    return used < maxPostsPerDay(item.platform, isWeekendOffset(d, startDate))
  }

  const place = (item: { platform: SocialPlatform; kind: string }, d: number) => {
    const key = `${item.platform}:${d}`
    dailyCount[key] = (dailyCount[key] || 0) + 1
    const weekend = isWeekendOffset(d, startDate)
    const slotOrder = slotOrderCache.get(`${item.platform}:${weekend}`)
    slots.push({
      platform: item.platform,
      dayOffset: d,
      scheduledAt: pickPostingSlot(item.platform, d, slotIdx, startDate, slotOrder),
      contentKind: item.kind,
      slotIndex: slotIdx,
    })
    slotIdx += 1
    day = d + 1
  }

  for (const item of queue) {
    if (!platforms.includes(item.platform)) continue

    let placed = false

    for (let attempt = 0; attempt < days && !placed; attempt++) {
      const d = (day + attempt) % days
      if (isWeekendOffset(d, startDate)) continue
      if (!canPlace(item, d)) continue
      place(item, d)
      placed = true
    }

    for (let attempt = 0; attempt < days && !placed; attempt++) {
      const d = (day + attempt) % days
      if (!canPlace(item, d)) continue
      place(item, d)
      placed = true
    }
  }

  return {
    sourceTitle,
    distributionDays: days,
    totalSlots: slots.length,
    slots,
    createdAt: new Date().toISOString(),
  }
}