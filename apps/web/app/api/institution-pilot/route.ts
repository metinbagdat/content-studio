import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@content-studio/core/auth'
import {
  PILOT_GUIDE_CATEGORY,
  PILOT_GUIDE_PACK,
  PILOT_GUIDE_SLUG,
  buildPilotGuideSource,
  readPilotGuidePack,
  renderPilotGuideHtml,
  toLearnConPilotGuideExport,
} from '@/lib/institution/pilotGuideHtml'

export const dynamic = 'force-dynamic'

async function loadStored() {
  return prisma.contentSource.findFirst({
    where: {
      category: PILOT_GUIDE_CATEGORY,
      tags: { has: `slug:${PILOT_GUIDE_SLUG}` },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const format = req.nextUrl.searchParams.get('format')
  const row = await loadStored()
  let pack = PILOT_GUIDE_PACK
  if (row) {
    try {
      pack = readPilotGuidePack(row.content)
    } catch {
      pack = PILOT_GUIDE_PACK
    }
  }
  if (format === 'html' || format === 'pdf') {
    return new NextResponse(renderPilotGuideHtml(pack), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  if (format === 'learncon') {
    return NextResponse.json(toLearnConPilotGuideExport(pack))
  }
  return NextResponse.json({
    item: row
      ? {
          id: row.id,
          title: row.title,
          pack,
          export: toLearnConPilotGuideExport(pack),
        }
      : {
          id: null,
          title: buildPilotGuideSource(pack).title,
          pack,
          export: toLearnConPilotGuideExport(pack),
          seeded: false,
        },
  })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  if (String(body.action || 'seed') !== 'seed') {
    return NextResponse.json({ error: 'action geçersiz' }, { status: 400 })
  }
  const draft = buildPilotGuideSource(PILOT_GUIDE_PACK)
  const existing = await loadStored()
  if (existing) {
    const row = await prisma.contentSource.update({
      where: { id: existing.id },
      data: {
        title: draft.title,
        content: draft.content,
        category: draft.category,
        tags: draft.tags,
      },
    })
    return NextResponse.json({
      item: {
        id: row.id,
        title: row.title,
        pack: PILOT_GUIDE_PACK,
        export: toLearnConPilotGuideExport(PILOT_GUIDE_PACK),
      },
      upserted: true,
    })
  }
  const row = await prisma.contentSource.create({
    data: {
      title: draft.title,
      content: draft.content,
      category: draft.category,
      tags: draft.tags,
    },
  })
  return NextResponse.json(
    {
      item: {
        id: row.id,
        title: row.title,
        pack: PILOT_GUIDE_PACK,
        export: toLearnConPilotGuideExport(PILOT_GUIDE_PACK),
      },
      upserted: false,
    },
    { status: 201 },
  )
}
