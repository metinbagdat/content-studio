import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@content-studio/core/auth'
import {
  METRICS_DICTIONARY_PACK,
  METRICS_DICT_CATEGORY,
  METRICS_DICT_SLUG,
  buildMetricsDictionarySource,
  readMetricsDictionary,
  renderMetricsDictionaryHtml,
  toLearnConMetricsDictionaryExport,
} from '@/lib/growth/metricsDictionary'

export const dynamic = 'force-dynamic'

async function loadStored() {
  return prisma.contentSource.findFirst({
    where: {
      category: METRICS_DICT_CATEGORY,
      tags: { has: `slug:${METRICS_DICT_SLUG}` },
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
  let pack = METRICS_DICTIONARY_PACK
  if (row) {
    try {
      pack = readMetricsDictionary(row.content)
    } catch {
      pack = METRICS_DICTIONARY_PACK
    }
  }
  if (format === 'html') {
    return new NextResponse(renderMetricsDictionaryHtml(pack), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  if (format === 'learncon') {
    return NextResponse.json(toLearnConMetricsDictionaryExport(pack))
  }
  return NextResponse.json({
    item: {
      id: row?.id ?? null,
      title: row?.title ?? buildMetricsDictionarySource(pack).title,
      pack,
      export: toLearnConMetricsDictionaryExport(pack),
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
  const draft = buildMetricsDictionarySource(METRICS_DICTIONARY_PACK)
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
        pack: METRICS_DICTIONARY_PACK,
        export: toLearnConMetricsDictionaryExport(METRICS_DICTIONARY_PACK),
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
        pack: METRICS_DICTIONARY_PACK,
        export: toLearnConMetricsDictionaryExport(METRICS_DICTIONARY_PACK),
      },
      upserted: false,
    },
    { status: 201 },
  )
}
