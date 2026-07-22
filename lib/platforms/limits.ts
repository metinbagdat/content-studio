import type { SocialPlatform } from '@prisma/client'

export type PlatformRateLimit = {
  daily: number
  perRequest: number
  window: '15min' | 'hour' | 'day'
}

/** Documented platform posting limits for distribution planning. */
export const PLATFORM_LIMITS: Record<SocialPlatform, PlatformRateLimit> = {
  TWITTER: { daily: 50, perRequest: 300, window: '15min' },
  LINKEDIN: { daily: 20, perRequest: 500, window: 'day' },
  INSTAGRAM: { daily: 30, perRequest: 200, window: 'day' },
  TIKTOK: { daily: 15, perRequest: 100, window: 'hour' },
  YOUTUBE: { daily: 5, perRequest: 1000, window: 'day' },
  FACEBOOK: { daily: 10, perRequest: 200, window: 'hour' },
}

export const PINTEREST_LIMITS: PlatformRateLimit = {
  daily: 50,
  perRequest: 1000,
  window: 'day',
}

/** Max posts per platform per calendar day (conservative). */
export function maxPostsPerDay(platform: SocialPlatform): number {
  return PLATFORM_LIMITS[platform].daily
}

/** Remaining quota for a day given already scheduled count. */
export function remainingDailyQuota(platform: SocialPlatform, scheduledToday: number): number {
  return Math.max(0, maxPostsPerDay(platform) - scheduledToday)
}
