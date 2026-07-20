import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { createPipeline, processPipeline } from '@/lib/pipeline'
import { SocialPlatform } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const pipelines = await prisma.contentPipeline.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { source: { select: { id: true, title: true } } },
  })
  return NextResponse.json({ pipelines })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const sourceId = String(body.sourceId || '')
  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId required' }, { status: 400 })
  }

  const platforms = (Array.isArray(body.platforms) ? body.platforms : ['TWITTER', 'LINKEDIN'])
    .map((p: unknown) => String(p))
    .filter((p: string) =>
      Object.values(SocialPlatform).includes(p as SocialPlatform),
    ) as SocialPlatform[]

  const pipeline = await createPipeline(sourceId, {
    platforms,
    includeMarchSong: Boolean(body.includeMarchSong),
    autoPublish: false,
  })

  // Sync process for local MVP when Redis/worker may be down
  if (body.runSync !== false) {
    try {
      await processPipeline(pipeline.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ pipeline, error: message }, { status: 500 })
    }
  }

  const fresh = await prisma.contentPipeline.findUnique({ where: { id: pipeline.id } })
  return NextResponse.json({ pipeline: fresh }, { status: 201 })
}
