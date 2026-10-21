/** Pure helpers for CS-08 adaptive posting-time scoring — no DB import so they're
 * unit-testable without a live database (the DB-touching half lives in
 * `postingPerformance.ts`). */

export const MIN_SAMPLES_TO_ADAPT = 5 // below this, trust the static defaults instead

/** Prefer stored analytics.engagement; fall back to likes+comments+shares (ignore raw impression dumps). */
export function engagementScore(metrics: unknown): number {
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
export function nearestSlot(publishedAt: Date, candidates: string[]): string {
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

/** Reorder a static slot list by historical per-slot engagement average — best first.
 * Slots with no samples sort last (average treated as -1, below any real 0-engagement slot). */
export function rankSlotsByEngagement(
  defaults: string[],
  samples: Array<{ publishedAt: Date; metrics: unknown }>,
): string[] {
  const slotTotals: Record<string, { sum: number; count: number }> = {}
  for (const slot of defaults) slotTotals[slot] = { sum: 0, count: 0 }

  for (const post of samples) {
    const slot = nearestSlot(post.publishedAt, defaults)
    slotTotals[slot].sum += engagementScore(post.metrics)
    slotTotals[slot].count += 1
  }

  return [...defaults].sort((a, b) => {
    const avgA = slotTotals[a].count ? slotTotals[a].sum / slotTotals[a].count : -1
    const avgB = slotTotals[b].count ? slotTotals[b].sum / slotTotals[b].count : -1
    return avgB - avgA // highest average engagement first
  })
}
