import { Prisma, type SocialPlatform } from '@prisma/client'
import { prisma } from '../prisma'
import { OPTIMAL_POSTING_IST, OPTIMAL_POSTING_WEEKEND_IST, istDayOfWeek } from './postingTimes'

const MIN_SAMPLES_TO_ADAPT = 5 // below this, trust the static defaults instead

/** Sum all numeric leaves in a metrics JSON blob as a rough engagement score —
 * schema-agnostic since exact field names (likes/comments/impressions/etc.) vary by platform. */
function engagementScore(metrics: unknown): number {
  if (!metrics || typeof metrics !== 'object') return 0
  let total = 0
  for (const value of Object.values(metrics as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) total += value
  }
  return total
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