import type { SocialPlatform } from '@prisma/client'
import type { AtomizationPlan } from '../atomization/types'
import { maxPostsPerDay } from '../platforms/limits'
import { DEFAULT_PIPELINE_PLATFORMS } from '../platforms/targets'
import { pickPostingSlot } from './postingTimes'

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

/** Spread planned social pieces across distributionDays respecting daily limits. */
export function buildDistributionCalendar(input: BuildCalendarInput): DistributionCalendar {
  const { plan, sourceTitle, startDate = new Date() } = input
  const platforms: SocialPlatform[] = input.platforms?.length
    ? input.platforms
    : DEFAULT_PIPELINE_PLATFORMS

  const pieces = plan.contentPieces
  const queue: Array<{ platform: SocialPlatform; kind: string }> = []

  const push = (platform: SocialPlatform, kind: string, count: number) => {
    for (let i = 0; i < count; i++) queue.push({ platform, kind })
  }

  // Featured first in queue: X then YouTube
  push('TWITTER', 'twitter_post', pieces.twitterPosts)
  push('TWITTER', 'twitter_thread', pieces.twitterThreads)
  push('YOUTUBE', 'youtube_short', pieces.youtubeShorts)
  push('YOUTUBE', 'long_form_video', pieces.longFormVideo)
  push('LINKEDIN', 'linkedin_post', pieces.linkedinPosts)
  push('LINKEDIN', 'linkedin_carousel', pieces.linkedinCarousels)
  push('INSTAGRAM', 'instagram_post', pieces.instagramPosts)
  push('INSTAGRAM', 'instagram_reel', pieces.instagramReels)
  push('TIKTOK', 'tiktok_video', pieces.tiktokVideos)
  push('FACEBOOK', 'facebook_post', pieces.facebookPosts)

  const days = plan.distributionDays
  const slots: CalendarSlot[] = []
  const dailyCount: Record<string, number> = {}

  let day = 0
  let slotIdx = 0

  for (const item of queue) {
    if (!platforms.includes(item.platform)) continue

    let placed = false
    for (let attempt = 0; attempt < days && !placed; attempt++) {
      const d = (day + attempt) % days
      const key = `${item.platform}:${d}`
      const used = dailyCount[key] || 0
      if (used >= maxPostsPerDay(item.platform)) continue

      dailyCount[key] = used + 1
      slots.push({
        platform: item.platform,
        dayOffset: d,
        scheduledAt: pickPostingSlot(item.platform, d, slotIdx, startDate),
        contentKind: item.kind,
        slotIndex: slotIdx,
      })
      slotIdx += 1
      day = d + 1
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
