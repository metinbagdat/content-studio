import type { SocialPlatform } from '@prisma/client'

/** Best posting windows in Europe/Istanbul (hour:minute). */
export const OPTIMAL_POSTING_IST: Record<SocialPlatform, string[]> = {
  TWITTER: ['09:00', '12:00', '18:00'],
  LINKEDIN: ['08:00', '12:00', '17:00'],
  INSTAGRAM: ['11:00', '14:00', '20:00'],
  TIKTOK: ['19:00', '21:00', '23:00'],
  YOUTUBE: ['14:00', '18:00'],
  FACEBOOK: ['13:00', '15:00'],
}

export const PINTEREST_POSTING_IST = ['20:00', '21:00', '23:00']

/** Next scheduled Date in IST from base day offset and time slot. */
export function scheduleAtIst(dayOffset: number, time: string, from = new Date()): Date {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + dayOffset)
  // IST = UTC+3
  d.setUTCHours(h - 3, m, 0, 0)
  return d
}

export function pickPostingSlot(
  platform: SocialPlatform,
  dayOffset: number,
  slotIndex: number,
  from = new Date(),
): Date {
  const slots = OPTIMAL_POSTING_IST[platform]
  const time = slots[slotIndex % slots.length]
  return scheduleAtIst(dayOffset, time, from)
}
