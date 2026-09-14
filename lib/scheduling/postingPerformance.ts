import { Prisma, type SocialPlatform } from '@prisma/client'
import { prisma } from '../prisma'
import { OPTIMAL_POSTING_IST, OPTIMAL_POSTING_WEEKEND_IST, istDayOfWeek } from './postingTimes'
import { MIN_SAMPLES_TO_ADAPT, rankSlotsByEngagement } from './engagementScore'

export { MIN_SAMPLES_TO_ADAPT }

/** Reorder a platform's posting slots by historical engagement — best-performing slot first.
 * Falls back to the static default order when there isn't enough published-post history yet. */
export async function getAdaptiveSlotOrder(
  platform: SocialPlatform,
  weekend: boolean,
): Promise<string[]> {
  const defaults = weekend ? OPTIMAL_POSTING_WEEKEND_IST[platform] : OPTIMAL_POSTING_IST[platform]

  const posts = await prisma.socialMediaPost.findMany({
    where: { platform, status: 'PUBLISHED', publishedAt: { not: null }, metrics: { not: Prisma.DbNull } },
    select: { publishedAt: true, metrics: true },
    take: 200,
    orderBy: { publishedAt: 'desc' },
  })

  const relevant = posts.filter((p) => {
    const isWeekendPost = istDayOfWeek(0, p.publishedAt!) === 0 || istDayOfWeek(0, p.publishedAt!) === 6
    return isWeekendPost === weekend
  })

  if (relevant.length < MIN_SAMPLES_TO_ADAPT) return defaults

  return rankSlotsByEngagement(
    defaults,
    relevant.map((p) => ({ publishedAt: p.publishedAt!, metrics: p.metrics })),
  )
}

export type AdaptiveSlotRow = {
  platform: SocialPlatform
  weekend: boolean
  samples: number
  minSamples: number
  adaptive: boolean
  slots: string[]
}

/** Admin/calendar: how close each platform is to using learned posting times. */
export async function getAdaptiveSlotReport(): Promise<AdaptiveSlotRow[]> {
  const platforms: SocialPlatform[] = ['TWITTER', 'LINKEDIN', 'YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK']
  const rows: AdaptiveSlotRow[] = []
  for (const platform of platforms) {
    for (const weekend of [false, true]) {
      const slots = await getAdaptiveSlotOrder(platform, weekend)
      const posts = await prisma.socialMediaPost.findMany({
        where: { platform, status: 'PUBLISHED', publishedAt: { not: null }, metrics: { not: Prisma.DbNull } },
        select: { publishedAt: true },
        take: 200,
        orderBy: { publishedAt: 'desc' },
      })
      const samples = posts.filter((p) => {
        const isWeekendPost = istDayOfWeek(0, p.publishedAt!) === 0 || istDayOfWeek(0, p.publishedAt!) === 6
        return isWeekendPost === weekend
      }).length
      rows.push({
        platform,
        weekend,
        samples,
        minSamples: MIN_SAMPLES_TO_ADAPT,
        adaptive: samples >= MIN_SAMPLES_TO_ADAPT,
        slots,
      })
    }
  }
  return rows
}