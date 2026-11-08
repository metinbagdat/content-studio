import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@content-studio/core/auth'
import {
  TEACHER_ROSTER_CATEGORY,
  TEACHER_ROSTER_SLUG,
  buildRosterTemplatePack,
  buildRosterTemplateSource,
  readRosterTemplatePack,
  toLearnConRosterExport,
  type ExamVariant,
} from '@/lib/teacher/rosterTemplate'
import { renderRosterGuideHtml } from '@/lib/teacher/rosterGuideHtml'

export const dynamic = 'force-dynamic'

function parseRow(row: {
  id: string
  title: string
  content: string
  tags: string[]
  updatedAt: Date
}) {
  try {
    const pack = readRosterTemplatePack(row.content)
    return {
      id: row.id,
      title: row.title,
      tags: row.tags,
      updatedAt: row.updatedAt,
      pack,
      export: toLearnConRosterExport(pack),
    }
  } catch (err) {
    return {
      id: row.id,
      title: row.title,
      tags: row.tags,
      updatedAt: row.updatedAt,
      parseError: err instanceof Error ? err.message : String(err),
    }
  }
}

async function loadStored() {
  return prisma.contentSource.findFirst({
    where: {
      category: TEACHER_ROSTER_CATEGORY,
      tags: { has: `slug:${TEACHER_ROSTER_SLUG}` },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

async function resolvePack() {
  const row = await loadStored()
  if (!row) return { row: null, pack: buildRosterTemplatePack() }
  try {
    return { row, pack: readRosterTemplatePack(row.content) }
  } catch {
    return { row, pack: buildRosterTemplatePack() }
  }
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const format = req.nextUrl.searchParams.get('format')
  const exam = (req.nextUrl.searchParams.get('exam') || 'TYT').toUpperCase() as ExamVariant
  const { row, pack } = await resolvePack()

  if (format === 'learncon') {
    return NextResponse.json(toLearnConRosterExport(pack))
  }
  if (format === 'guide') {
    return new NextResponse(renderRosterGuideHtml(pack), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  if (format === 'csv') {
    const kind = req.nextUrl.searchParams.get('kind') || 'sample'
    const validExam = (['TYT', 'AYT', 'LGS'] as ExamVariant[]).includes(exam) ? exam : 'TYT'
    const csv =
      kind === 'blank' ? pack.blankCsvByExam[validExam] : pack.sampleCsvByExam[validExam]
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="roster-${validExam}-${kind}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  return NextResponse.json({
    item: row
      ? parseRow(row)
      : {
          id: null,
          title: buildRosterTemplateSource(pack).title,
          pack,
          export: toLearnConRosterExport(pack),
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
  const draft = buildRosterTemplateSource(buildRosterTemplatePack())
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
    return NextResponse.json({ item: parseRow(row), upserted: true })
  }
  const row = await prisma.contentSource.create({
    data: {
      title: draft.title,
      content: draft.content,
      category: draft.category,
      tags: draft.tags,
    },
  })
  return NextResponse.json({ item: parseRow(row), upserted: false }, { status: 201 })
}
