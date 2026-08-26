import type { SocialPlatform } from '@prisma/client'

/**
 * Best posting windows in Europe/Istanbul (hour:minute) — weekday defaults.
 * Hafta içi sabah (08-10) ve öğle (12-13) yoğun saatler önceliklidir.
 */
export const OPTIMAL_POSTING_IST: Record<SocialPlatform, string[]> = {
  TWITTER: ['09:00', '12:00', '18:00'],
  LINKEDIN: ['08:00', '12:00', '17:00'],
  INSTAGRAM: ['11:00', '14:00', '20:00'],
  TIKTOK: ['19:00', '21:00', '23:00'],
  YOUTUBE: ['14:00', '18:00'],
  FACEBOOK: ['13:00', '15:00'],
  PINTEREST: ['20:00', '21:00', '23:00'],
}

/** Weekend windows — fewer slots, later start (matches "hafta sonu daha az paylaşım"). */
export const OPTIMAL_POSTING_WEEKEND_IST: Record<SocialPlatform, string[]> = {
  TWITTER: ['11:00', '19:00'],
  LINKEDIN: ['10:00'],
  INSTAGRAM: ['12:00', '20:00'],
  TIKTOK: ['20:00', '22:00'],
  YOUTUBE: ['15:00'],
  FACEBOOK: ['14:00'],
  PINTEREST: ['21:00'],
}

/** @deprecated use OPTIMAL_POSTING_IST.PINTEREST */
export const PINTEREST_POSTING_IST = OPTIMAL_POSTING_IST.PINTEREST
/** @deprecated use OPTIMAL_POSTING_WEEKEND_IST.PINTEREST */
export const PINTEREST_POSTING_WEEKEND_IST = OPTIMAL_POSTING_WEEKEND_IST.PINTEREST

/** IST (UTC+3) day-of-week (0=Sun..6=Sat) for base date + dayOffset, without mutating `from`. */
export function istDayOfWeek(dayOffset: number, from = new Date()): number {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + dayOffset)
  d.setUTCHours(d.getUTCHours() + 3) // shift to IST wall-clock for weekday check
  return d.getUTCDay()
}

export function isWeekendOffset(dayOffset: number, from = new Date()): boolean {
  const dow = istDayOfWeek(dayOffset, from)
  return dow === 0 || dow === 6
}

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
  slotOrder?: string[], // YENİ — verilirse statik listenin yerine bunu kullanır
): Date {
  const weekend = isWeekendOffset(dayOffset, from)
  const slots = slotOrder || (weekend ? OPTIMAL_POSTING_WEEKEND_IST[platform] : OPTIMAL_POSTING_IST[platform])
  const time = slots[slotIndex % slots.length]
  return scheduleAtIst(dayOffset, time, from)
}
