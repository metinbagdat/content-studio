import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@content-studio/core/auth'
import {
  CROSS_ROLE_PACK,
  CROSS_ROLE_CATEGORY,
  CROSS_ROLE_SLUG,
  buildCrossRoleSource,
  readCrossRolePack,
  renderCrossRoleHtml,
  toLearnConCrossRoleExport,
} from '@/lib/growth/crossRoleTemplates'

export const dynamic = 'force-dynamic'

async function loadStored() {
  return prisma.contentSource.findFirst({
    where: {
      category: CROSS_ROLE_CATEGORY,
      tags: { has: `slug:${CROSS_ROLE_SLUG}` },
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
  let pack = CROSS_ROLE_PACK
  if (row) {
    try {
      pack = readCrossRolePack(row.content)
    } catch {
      pack = CROSS_ROLE_PACK
    }
  }
  if (format === 'html') {
    return new NextResponse(renderCrossRoleHtml(pack), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  if (format === 'learncon') {
    return NextResponse.json(toLearnConCrossRoleExport(pack))
  }
  return NextResponse.json({
    item: {
      id: row?.id ?? null,
      title: row?.title ?? buildCrossRoleSource(pack).title,
      pack,
      export: toLearnConCrossRoleExport(pack),
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
  const draft = buildCrossRoleSource(CROSS_ROLE_PACK)
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
        pack: CROSS_ROLE_PACK,
        export: toLearnConCrossRoleExport(CROSS_ROLE_PACK),
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
        pack: CROSS_ROLE_PACK,
        export: toLearnConCrossRoleExport(CROSS_ROLE_PACK),
      },
      upserted: false,
    },
    { status: 201 },
  )
}
