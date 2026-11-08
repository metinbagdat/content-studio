import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@content-studio/core/auth'
import {
  PARENT_TEMPLATES_CATEGORY,
  PARENT_TEMPLATES_PACK,
  PARENT_TEMPLATES_SLUG,
  buildParentTemplatesSource,
  readParentTemplatesPack,
  toLearnConParentTemplatesExport,
} from '@/lib/parent/parentTemplates'

export const dynamic = 'force-dynamic'

function parseRow(row: {
  id: string
  title: string
  content: string
  tags: string[]
  updatedAt: Date
}) {
  try {
    const pack = readParentTemplatesPack(row.content)
    return {
      id: row.id,
      title: row.title,
      tags: row.tags,
      updatedAt: row.updatedAt,
      pack,
      export: toLearnConParentTemplatesExport(pack),
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
      category: PARENT_TEMPLATES_CATEGORY,
      tags: { has: `slug:${PARENT_TEMPLATES_SLUG}` },
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
  let pack = PARENT_TEMPLATES_PACK
  if (row) {
    try {
      pack = readParentTemplatesPack(row.content)
    } catch {
      pack = PARENT_TEMPLATES_PACK
    }
  }

  if (format === 'learncon') {
    return NextResponse.json(toLearnConParentTemplatesExport(pack))
  }

  if (format === 'email') {
    const id = req.nextUrl.searchParams.get('id') || 'V-E1'
    const email = pack.emails.find((e) => e.id === id)
    if (!email) return NextResponse.json({ error: 'e-posta yok' }, { status: 404 })
    return new NextResponse(email.html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  return NextResponse.json({
    item: row
      ? parseRow(row)
      : {
          id: null,
          title: buildParentTemplatesSource(pack).title,
          pack,
          export: toLearnConParentTemplatesExport(pack),
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

  const draft = buildParentTemplatesSource(PARENT_TEMPLATES_PACK)
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
