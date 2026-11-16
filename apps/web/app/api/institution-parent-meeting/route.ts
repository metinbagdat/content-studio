import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@content-studio/core/auth'
import {
  PARENT_MEETING_CATEGORY,
  PARENT_MEETING_SLUG,
  buildParentMeetingPack,
  buildParentMeetingSource,
  readParentMeetingPack,
  renderParentMeetingHtml,
  toLearnConParentMeetingExport,
} from '@/lib/institution/parentMeetingTemplate'

export const dynamic = 'force-dynamic'

async function loadStored() {
  return prisma.contentSource.findFirst({
    where: {
      category: PARENT_MEETING_CATEGORY,
      tags: { has: `slug:${PARENT_MEETING_SLUG}` },
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
  let pack = buildParentMeetingPack()
  if (row) {
    try {
      pack = readParentMeetingPack(row.content)
    } catch {
      pack = buildParentMeetingPack()
    }
  }
  if (format === 'html' || format === 'pdf') {
    return new NextResponse(renderParentMeetingHtml(pack), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  if (format === 'learncon') {
    return NextResponse.json(toLearnConParentMeetingExport(pack))
  }
  return NextResponse.json({
    item: {
      id: row?.id ?? null,
      title: row?.title ?? buildParentMeetingSource(pack).title,
      pack,
      export: toLearnConParentMeetingExport(pack),
      seeded: Boolean(row),
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
  const pack = buildParentMeetingPack()
  const draft = buildParentMeetingSource(pack)
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
        pack,
        export: toLearnConParentMeetingExport(pack),
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
        pack,
        export: toLearnConParentMeetingExport(pack),
      },
      upserted: false,
    },
    { status: 201 },
  )
}
