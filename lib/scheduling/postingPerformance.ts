import { Prisma, type SocialPlatform } from '@prisma/client'
import { prisma } from '../prisma'
import { OPTIMAL_POSTING_IST, OPTIMAL_POSTING_WEEKEND_IST, istDayOfWeek } from './postingTimes'

const MIN_SAMPLES_TO_ADAPT = 5 // below this, trust the static defaults instead

/** Prefer stored analytics.engagement; fall back to likes+comments+shares (ignore raw impression dumps). */
function engagementScore(metrics: unknown): number {
  if (!metrics || typeof metrics !== 'object') return 0
  const root = metrics as Record<string, unknown>
  const analytics =
    root.analytics && typeof root.analytics === 'object'
      ? (root.analytics as Record<string, unknown>)
      : root
  const engagement = Number(analytics.engagement)
  if (Number.isFinite(engagement) && engagement > 0) return engagement
  const likes = Number(analytics.likes) || 0
  const comments = Number(analytics.comments) || 0
  const shares = Number(analytics.shares) || 0
  const clicks = Number(analytics.clicks) || 0
  const sum = likes + comments + shares + clicks
  return sum > 0 ? sum : 0
}

/** Which static slot (HH:MM) a published post's actual publish time falls closest to. */
function nearestSlot(publishedAt: Date, candidates: string[]): string {
  const istHour = (publishedAt.getUTCHours() + 3) % 24
  const istMinute = publishedAt.getUTCMinutes()
  const postMinutes = istHour * 60 + istMinute

  let best = candidates[0]
  let bestDiff = Infinity
  for (const slot of candidates) {
    const [h, m] = slot.split(':').map(Number)
    const diff = Math.abs(h * 60 + m - postMinutes)
    if (diff < bestDiff) {
      bestDiff = diff
      best = slot
    }
  }
  return best
}

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

  const slotTotals: Record<string, { sum: number; count: number }> = {}
  for (const slot of defaults) slotTotals[slot] = { sum: 0, count: 0 }

  for (const post of relevant) {
    const slot = nearestSlot(post.publishedAt!, defaults)
    slotTotals[slot].sum += engagementScore(post.metrics)
    slotTotals[slot].count += 1
  }

  return [...defaults].sort((a, b) => {
    const avgA = slotTotals[a].count ? slotTotals[a].sum / slotTotals[a].count : -1
    const avgB = slotTotals[b].count ? slotTotals[b].sum / slotTotals[b].count : -1
    return avgB - avgA // highest average engagement first
  })
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