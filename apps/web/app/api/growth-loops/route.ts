import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@content-studio/core/auth'
import {
  LOOP_STRATEGY_PACK,
  LOOP_STRATEGY_CATEGORY,
  LOOP_STRATEGY_SLUG,
  buildLoopStrategySource,
  readLoopStrategyPack,
  renderLoopStrategyHtml,
  toLearnConLoopStrategyExport,
} from '@/lib/growth/loopContentStrategy'

export const dynamic = 'force-dynamic'

async function loadStored() {
  return prisma.contentSource.findFirst({
    where: {
      category: LOOP_STRATEGY_CATEGORY,
      tags: { has: `slug:${LOOP_STRATEGY_SLUG}` },
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
  let pack = LOOP_STRATEGY_PACK
  if (row) {
    try {
      pack = readLoopStrategyPack(row.content)
    } catch {
      pack = LOOP_STRATEGY_PACK
    }
  }
  if (format === 'html') {
    return new NextResponse(renderLoopStrategyHtml(pack), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  if (format === 'learncon') {
    return NextResponse.json(toLearnConLoopStrategyExport(pack))
  }
  return NextResponse.json({
    item: {
      id: row?.id ?? null,
      title: row?.title ?? buildLoopStrategySource(pack).title,
      pack,
      export: toLearnConLoopStrategyExport(pack),
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
  const draft = buildLoopStrategySource(LOOP_STRATEGY_PACK)
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
        pack: LOOP_STRATEGY_PACK,
        export: toLearnConLoopStrategyExport(LOOP_STRATEGY_PACK),
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
        pack: LOOP_STRATEGY_PACK,
        export: toLearnConLoopStrategyExport(LOOP_STRATEGY_PACK),
      },
      upserted: false,
    },
    { status: 201 },
  )
}
