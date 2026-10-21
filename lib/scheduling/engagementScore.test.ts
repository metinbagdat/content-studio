import { describe, expect, it } from 'vitest'
import { engagementScore, nearestSlot, rankSlotsByEngagement } from './engagementScore'

describe('engagementScore', () => {
  it('returns 0 for missing/non-object metrics', () => {
    expect(engagementScore(null)).toBe(0)
    expect(engagementScore(undefined)).toBe(0)
    expect(engagementScore('not-an-object')).toBe(0)
    expect(engagementScore(42)).toBe(0)
  })

  it('prefers a positive top-level analytics.engagement value', () => {
    expect(engagementScore({ analytics: { engagement: 123, likes: 999 } })).toBe(123)
  })

  it('falls back to likes+comments+shares+clicks when engagement is missing/zero', () => {
    expect(engagementScore({ analytics: { engagement: 0, likes: 10, comments: 2, shares: 1 } })).toBe(13)
    expect(engagementScore({ likes: 5, comments: 5 } as unknown)).toBe(10)
  })

  it('treats a negative or non-finite engagement as absent and falls back', () => {
    expect(engagementScore({ analytics: { engagement: -5, likes: 4 } })).toBe(4)
    expect(engagementScore({ analytics: { engagement: NaN, clicks: 7 } })).toBe(7)
  })

  it('returns 0 when nothing usable is present', () => {
    expect(engagementScore({ impressions: 10_000 })).toBe(0)
    expect(engagementScore({})).toBe(0)
  })
})

describe('nearestSlot', () => {
  it('picks the exact match when a candidate equals the publish time', () => {
    // 09:00 IST == 06:00 UTC
    expect(nearestSlot(new Date('2026-09-14T06:00:00.000Z'), ['09:00', '12:00', '18:00'])).toBe('09:00')
  })

  it('picks the closest candidate when there is no exact match', () => {
    // 09:50 IST == 06:50 UTC -> closer to 09:00 than 12:00
    expect(nearestSlot(new Date('2026-09-14T06:50:00.000Z'), ['09:00', '12:00', '18:00'])).toBe('09:00')
  })

  it('wraps correctly across midnight IST', () => {
    // 23:50 IST == 20:50 UTC -> closest declared slot is 23:00
    expect(nearestSlot(new Date('2026-09-14T20:50:00.000Z'), ['19:00', '21:00', '23:00'])).toBe('23:00')
  })
})

describe('rankSlotsByEngagement', () => {
  const defaults = ['09:00', '12:00', '18:00']

  it('ranks slots by average engagement, highest first', () => {
    const samples = [
      { publishedAt: new Date('2026-09-14T06:00:00.000Z'), metrics: { analytics: { engagement: 10 } } }, // 09:00
      { publishedAt: new Date('2026-09-14T09:00:00.000Z'), metrics: { analytics: { engagement: 100 } } }, // 12:00
      { publishedAt: new Date('2026-09-14T15:00:00.000Z'), metrics: { analytics: { engagement: 5 } } }, // 18:00
    ]
    expect(rankSlotsByEngagement(defaults, samples)).toEqual(['12:00', '09:00', '18:00'])
  })

  it('sorts slots with zero samples after any slot with real (even 0) engagement', () => {
    const samples = [
      { publishedAt: new Date('2026-09-14T06:00:00.000Z'), metrics: { analytics: { engagement: 0, likes: 0 } } }, // 09:00, real 0
    ]
    const ranked = rankSlotsByEngagement(defaults, samples)
    expect(ranked[0]).toBe('09:00')
    expect(ranked.slice(1).sort()).toEqual(['12:00', '18:00'])
  })

  it('returns the defaults order when there are no samples at all', () => {
    expect(rankSlotsByEngagement(defaults, [])).toEqual(defaults)
  })
})
