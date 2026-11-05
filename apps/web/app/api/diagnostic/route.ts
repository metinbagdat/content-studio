import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@content-studio/core/auth'
import {
  DIAGNOSTIC_CATEGORY,
  buildDiagnosticSource,
  readDiagnosticQuestion,
  toLearnConExport,
  type DiagnosticQuestionInput,
} from '@/lib/diagnostic/questionBank'
import { DIAGNOSTIC_SEED_QUESTIONS } from '@/lib/diagnostic/seedBank'

export const dynamic = 'force-dynamic'

function parseSource(row: { id: string; title: string; content: string; tags: string[]; updatedAt: Date }) {
  try {
    const question = readDiagnosticQuestion(row.content)
    return {
      id: row.id,
      title: row.title,
      tags: row.tags,
      updatedAt: row.updatedAt,
      question,
      export: toLearnConExport(question),
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

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const format = req.nextUrl.searchParams.get('format')
  const rows = await prisma.contentSource.findMany({
    where: { category: DIAGNOSTIC_CATEGORY },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
  const items = rows.map(parseSource)
  if (format === 'learncon') {
    const questions = []
    for (const item of items) {
      if ('export' in item && item.export) questions.push(item.export)
    }
    return NextResponse.json({
      contract: 'LEARNCON-STU-02',
      count: questions.length,
      questions,
    })
  }
  return NextResponse.json({ count: items.length, items })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const action = String(body.action || 'upsert')

  if (action === 'seed') {
    const created: string[] = []
    const skipped: string[] = []
    for (const input of DIAGNOSTIC_SEED_QUESTIONS) {
      const draft = buildDiagnosticSource(input)
      const existing = await prisma.contentSource.findFirst({
        where: {
          category: DIAGNOSTIC_CATEGORY,
          tags: { has: `slug:${input.slug}` },
        },
      })
      if (existing) {
        skipped.push(input.slug)
        continue
      }
      const row = await prisma.contentSource.create({
        data: {
          title: draft.title,
          content: draft.content,
          category: draft.category,
          tags: draft.tags,
        },
      })
      created.push(row.id)
    }
    return NextResponse.json(
      { created: created.length, skipped: skipped.length, skippedSlugs: skipped },
      { status: 201 },
    )
  }

  if (action === 'upsert') {
    const input = body.question as DiagnosticQuestionInput
    if (!input || typeof input !== 'object') {
      return NextResponse.json({ error: 'question gerekli' }, { status: 400 })
    }
    let draft
    try {
      draft = buildDiagnosticSource(input)
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 400 },
      )
    }
    const id = typeof body.id === 'string' ? body.id : null
    if (id) {
      const row = await prisma.contentSource.update({
        where: { id },
        data: {
          title: draft.title,
          content: draft.content,
          category: draft.category,
          tags: draft.tags,
        },
      })
      return NextResponse.json({ item: parseSource(row) })
    }
    const existing = await prisma.contentSource.findFirst({
      where: {
        category: DIAGNOSTIC_CATEGORY,
        tags: { has: `slug:${input.slug}` },
      },
    })
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
      return NextResponse.json({ item: parseSource(row) })
    }
    const row = await prisma.contentSource.create({
      data: {
        title: draft.title,
        content: draft.content,
        category: draft.category,
        tags: draft.tags,
      },
    })
    return NextResponse.json({ item: parseSource(row) }, { status: 201 })
  }

  return NextResponse.json({ error: 'action geçersiz' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id gerekli' }, { status: 400 })
  }
  const row = await prisma.contentSource.findUnique({ where: { id } })
  if (!row || row.category !== DIAGNOSTIC_CATEGORY) {
    return NextResponse.json({ error: 'bulunamadı' }, { status: 404 })
  }
  await prisma.contentSource.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
