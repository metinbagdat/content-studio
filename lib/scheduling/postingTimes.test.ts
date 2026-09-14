import { describe, expect, it } from 'vitest'
import {
  isWeekendOffset,
  istDayOfWeek,
  pickPostingSlot,
  scheduleAtIst,
  OPTIMAL_POSTING_IST,
  OPTIMAL_POSTING_WEEKEND_IST,
} from './postingTimes'

// Monday 2026-09-14 00:00 UTC == Monday 03:00 IST (UTC+3).
const MONDAY = new Date('2026-09-14T00:00:00.000Z')

describe('istDayOfWeek / isWeekendOffset', () => {
  it('identifies the base day correctly', () => {
    expect(istDayOfWeek(0, MONDAY)).toBe(1) // Monday
    expect(isWeekendOffset(0, MONDAY)).toBe(false)
  })

  it('rolls forward to Saturday/Sunday correctly', () => {
    expect(istDayOfWeek(5, MONDAY)).toBe(6) // Saturday
    expect(isWeekendOffset(5, MONDAY)).toBe(true)
    expect(istDayOfWeek(6, MONDAY)).toBe(0) // Sunday
    expect(isWeekendOffset(6, MONDAY)).toBe(true)
  })

  it('does not mutate the `from` date', () => {
    const before = MONDAY.getTime()
    istDayOfWeek(3, MONDAY)
    expect(MONDAY.getTime()).toBe(before)
  })
})

describe('scheduleAtIst', () => {
  it('converts an IST wall-clock time to the correct UTC instant', () => {
    const d = scheduleAtIst(0, '09:00', MONDAY)
    expect(d.toISOString()).toBe('2026-09-14T06:00:00.000Z') // 09:00 IST == 06:00 UTC
  })

  it('applies the day offset before the time', () => {
    const d = scheduleAtIst(2, '18:00', MONDAY)
    expect(d.toISOString()).toBe('2026-09-16T15:00:00.000Z')
  })
})

describe('pickPostingSlot', () => {
  it('uses the weekday slot list on a weekday', () => {
    const d = pickPostingSlot('TWITTER', 0, 0, MONDAY)
    const expected = scheduleAtIst(0, OPTIMAL_POSTING_IST.TWITTER[0], MONDAY)
    expect(d.toISOString()).toBe(expected.toISOString())
  })

  it('uses the weekend slot list on a weekend offset', () => {
    const d = pickPostingSlot('TWITTER', 5, 0, MONDAY) // +5 days == Saturday
    const expected = scheduleAtIst(5, OPTIMAL_POSTING_WEEKEND_IST.TWITTER[0], MONDAY)
    expect(d.toISOString()).toBe(expected.toISOString())
  })

  it('wraps the slot index around the list length', () => {
    const slots = OPTIMAL_POSTING_IST.LINKEDIN
    const d = pickPostingSlot('LINKEDIN', 0, slots.length, MONDAY)
    const expected = scheduleAtIst(0, slots[0], MONDAY)
    expect(d.toISOString()).toBe(expected.toISOString())
  })

  it('prefers an explicit slotOrder over the static defaults', () => {
    const d = pickPostingSlot('LINKEDIN', 0, 0, MONDAY, ['22:00'])
    expect(d.toISOString()).toBe(scheduleAtIst(0, '22:00', MONDAY).toISOString())
  })
})
