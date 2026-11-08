import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@content-studio/core/auth'
import {
  INSTITUTION_REPORT_CATEGORY,
  INSTITUTION_REPORT_SLUG,
  buildInstitutionReportSource,
  buildSampleInstitutionReport,
  readSampleInstitutionReport,
  renderInstitutionReportHtml,
  toLearnConInstitutionReportExport,
} from '@/lib/institution/sampleInstitutionReport'

export const dynamic = 'force-dynamic'

async function loadStored() {
  return prisma.contentSource.findFirst({
    where: {
      category: INSTITUTION_REPORT_CATEGORY,
      tags: { has: `slug:${INSTITUTION_REPORT_SLUG}` },
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
  let report = buildSampleInstitutionReport()
  if (row) {
    try {
      report = readSampleInstitutionReport(row.content)
    } catch {
      report = buildSampleInstitutionReport()
    }
  }
  if (format === 'html' || format === 'pdf') {
    return new NextResponse(renderInstitutionReportHtml(report), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  if (format === 'learncon') {
    return NextResponse.json(toLearnConInstitutionReportExport(report))
  }
  return NextResponse.json({
    item: row
      ? {
          id: row.id,
          title: row.title,
          report,
          export: toLearnConInstitutionReportExport(report),
        }
      : {
          id: null,
          title: buildInstitutionReportSource(report).title,
          report,
          export: toLearnConInstitutionReportExport(report),
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
  const draft = buildInstitutionReportSource(buildSampleInstitutionReport())
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
    const report = readSampleInstitutionReport(row.content)
    return NextResponse.json({
      item: {
        id: row.id,
        title: row.title,
        report,
        export: toLearnConInstitutionReportExport(report),
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
  const report = readSampleInstitutionReport(row.content)
  return NextResponse.json(
    {
      item: {
        id: row.id,
        title: row.title,
        report,
        export: toLearnConInstitutionReportExport(report),
      },
      upserted: false,
    },
    { status: 201 },
  )
}
