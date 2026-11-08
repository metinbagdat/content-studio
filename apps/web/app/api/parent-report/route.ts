import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@content-studio/core/auth'
import {
  ALI_SAMPLE_PARENT_REPORT,
  PARENT_REPORT_CATEGORY,
  PARENT_REPORT_SLUG,
  buildParentReportSource,
  readParentReport,
  toLearnConParentReportExport,
} from '@/lib/parent/sampleParentReport'
import { renderSampleParentReportHtml } from '@/lib/parent/sampleParentReportHtml'

export const dynamic = 'force-dynamic'

function parseRow(row: {
  id: string
  title: string
  content: string
  tags: string[]
  updatedAt: Date
}) {
  try {
    const report = readParentReport(row.content)
    return {
      id: row.id,
      title: row.title,
      tags: row.tags,
      updatedAt: row.updatedAt,
      report,
      export: toLearnConParentReportExport(report),
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
      category: PARENT_REPORT_CATEGORY,
      tags: { has: `slug:${PARENT_REPORT_SLUG}` },
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
  let report = ALI_SAMPLE_PARENT_REPORT
  if (row) {
    try {
      report = readParentReport(row.content)
    } catch {
      report = ALI_SAMPLE_PARENT_REPORT
    }
  }

  if (format === 'html') {
    return new NextResponse(renderSampleParentReportHtml(report), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  if (format === 'learncon') {
    return NextResponse.json(toLearnConParentReportExport(report))
  }

  return NextResponse.json({
    item: row
      ? parseRow(row)
      : {
          id: null,
          title: buildParentReportSource(report).title,
          report,
          export: toLearnConParentReportExport(report),
          seeded: false,
        },
  })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const action = String(body.action || 'seed')
  if (action !== 'seed') {
    return NextResponse.json({ error: 'action geçersiz' }, { status: 400 })
  }

  const draft = buildParentReportSource(ALI_SAMPLE_PARENT_REPORT)
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
