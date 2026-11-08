import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@content-studio/core/auth'
import {
  CLASS_REPORT_CATEGORY,
  CLASS_REPORT_SLUG,
  buildClassReportSource,
  buildSampleClassReport,
  readSampleClassReport,
  renderClassReportHtml,
  toLearnConClassReportExport,
} from '@/lib/teacher/sampleClassReport'

export const dynamic = 'force-dynamic'

function parseRow(row: {
  id: string
  title: string
  content: string
  tags: string[]
  updatedAt: Date
}) {
  try {
    const report = readSampleClassReport(row.content)
    return {
      id: row.id,
      title: row.title,
      tags: row.tags,
      updatedAt: row.updatedAt,
      report,
      export: toLearnConClassReportExport(report),
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
      category: CLASS_REPORT_CATEGORY,
      tags: { has: `slug:${CLASS_REPORT_SLUG}` },
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
  let report = buildSampleClassReport()
  if (row) {
    try {
      report = readSampleClassReport(row.content)
    } catch {
      report = buildSampleClassReport()
    }
  }

  if (format === 'learncon') {
    return NextResponse.json(toLearnConClassReportExport(report))
  }
  if (format === 'html' || format === 'pdf') {
    return new NextResponse(renderClassReportHtml(report), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  return NextResponse.json({
    item: row
      ? parseRow(row)
      : {
          id: null,
          title: buildClassReportSource(report).title,
          report,
          export: toLearnConClassReportExport(report),
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
  const draft = buildClassReportSource(buildSampleClassReport())
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
