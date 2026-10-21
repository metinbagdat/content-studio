import { describe, expect, it } from 'vitest'
import { PLATFORM_LIMITS, maxPostsPerDay, remainingDailyQuota } from './limits'

describe('maxPostsPerDay', () => {
  it('returns the full daily limit on weekdays', () => {
    expect(maxPostsPerDay('TWITTER', false)).toBe(PLATFORM_LIMITS.TWITTER.daily)
  })

  it('halves (rounded, min 1) the daily limit on weekends', () => {
    expect(maxPostsPerDay('TWITTER', true)).toBe(25) // 50 / 2
    expect(maxPostsPerDay('YOUTUBE', true)).toBe(3) // round(5/2) = round(2.5) = 3 (banker's-free round)
  })

  it('never drops below 1, even for the smallest daily quota', () => {
    for (const platform of Object.keys(PLATFORM_LIMITS) as (keyof typeof PLATFORM_LIMITS)[]) {
      expect(maxPostsPerDay(platform, true)).toBeGreaterThanOrEqual(1)
    }
  })

  it('defaults to weekday behavior when isWeekend is omitted', () => {
    expect(maxPostsPerDay('LINKEDIN')).toBe(PLATFORM_LIMITS.LINKEDIN.daily)
  })
})

describe('remainingDailyQuota', () => {
  it('subtracts already-scheduled posts from the weekday max', () => {
    expect(remainingDailyQuota('FACEBOOK', 3)).toBe(PLATFORM_LIMITS.FACEBOOK.daily - 3)
  })

  it('never returns a negative number', () => {
    expect(remainingDailyQuota('YOUTUBE', 999)).toBe(0)
  })
})
