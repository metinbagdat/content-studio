import { NextRequest, NextResponse } from 'next/server'
import { runContentDiscovery } from '@/lib/discovery/contentDiscovery'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const days = Number(req.nextUrl.searchParams.get('days') || 7)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const sources = await prisma.contentSource.findMany({
    where: {
      category: 'blog',
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      title: true,
      tags: true,
      createdAt: true,
    },
  })

  const recent = sources.map((s) => ({
    ...s,
    slug: s.tags.find((t) => t.startsWith('blog:'))?.replace('blog:', '') || null,
  }))

  return NextResponse.json({
    cronEnabled: process.env.DISCOVERY_CRON_ENABLED !== 'false',
    dailyLimit: Number(process.env.DISCOVERY_DAILY_LIMIT || 3),
    recent,
  })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const limit = Number(body.limit ?? process.env.DISCOVERY_DAILY_LIMIT ?? 2)
  const triggerPipeline = body.triggerPipeline !== false

  const result = await runContentDiscovery({ limit, triggerPipeline })
  return NextResponse.json({ result })
}
