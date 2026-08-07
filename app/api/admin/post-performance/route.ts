import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

function engagementScore(metrics: unknown): number {
  if (!metrics || typeof metrics !== 'object') return 0
  let total = 0
  for (const value of Object.values(metrics as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) total += value
  }
  return total
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const posts = await prisma.socialMediaPost.findMany({
    where: { status: 'PUBLISHED', metrics: { not: null } },
    select: { id: true, platform: true, postContent: true, publishedAt: true, metrics: true },
    orderBy: { publishedAt: 'desc' },
    take: 300,
  })

  const scored = posts.map((p) => ({
    id: p.id,
    platform: p.platform,
    postContent: p.postContent,
    publishedAt: p.publishedAt?.toISOString() || null,
    score: engagementScore(p.metrics),
    metrics: p.metrics as Record<string, number> | null,
  }))

  const topPosts = [...scored].sort((a, b) => b.score - a.score).slice(0, 10)

  const byPlatform = new Map<string, { total: number; count: number }>()
  for (const p of scored) {
    const cur = byPlatform.get(p.platform) || { total: 0, count: 0 }
    cur.total += p.score
    cur.count += 1
    byPlatform.set(p.platform, cur)
  }
  const platformSummary = Array.from(byPlatform.entries()).map(([platform, { total, count }]) => ({
    platform,
    postCount: count,
    avgScore: count ? total / count : 0,
  }))

  return NextResponse.json({ topPosts, platformSummary })
}