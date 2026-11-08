import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@content-studio/core/auth'
import {
  PREREQ_CATEGORY,
  PREREQ_GRAPH_SLUG,
  buildPrereqForest,
  buildPrereqSource,
  readPrereqGraph,
  toLearnConPrereqExport,
} from '@/lib/diagnostic/prereqGraph'
import { TYT_MATH_PREREQ_GRAPH } from '@/lib/diagnostic/tytMathPrereqSeed'

export const dynamic = 'force-dynamic'

function parseGraph(row: {
  id: string
  title: string
  content: string
  tags: string[]
  updatedAt: Date
}) {
  try {
    const graph = readPrereqGraph(row.content)
    return {
      id: row.id,
      title: row.title,
      tags: row.tags,
      updatedAt: row.updatedAt,
      graph,
      export: toLearnConPrereqExport(graph),
      forest: buildPrereqForest(graph.nodes),
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
  const slug = req.nextUrl.searchParams.get('slug') || PREREQ_GRAPH_SLUG
  const rows = await prisma.contentSource.findMany({
    where: {
      category: PREREQ_CATEGORY,
      tags: { has: `slug:${slug}` },
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  })
  const items = rows.map(parseGraph)
  if (format === 'learncon') {
    const first = items.find((i) => 'export' in i && i.export)
    if (!first || !('export' in first) || !first.export) {
      return NextResponse.json({ error: 'graf yok — seed yükleyin' }, { status: 404 })
    }
    return NextResponse.json(first.export)
  }
  return NextResponse.json({ count: items.length, items })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const action = String(body.action || 'seed')

  if (action === 'seed') {
    const draft = buildPrereqSource(TYT_MATH_PREREQ_GRAPH)
    const existing = await prisma.contentSource.findFirst({
      where: {
        category: PREREQ_CATEGORY,
        tags: { has: `slug:${PREREQ_GRAPH_SLUG}` },
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
      return NextResponse.json({ item: parseGraph(row), upserted: true })
    }
    const row = await prisma.contentSource.create({
      data: {
        title: draft.title,
        content: draft.content,
        category: draft.category,
        tags: draft.tags,
      },
    })
    return NextResponse.json({ item: parseGraph(row), upserted: false }, { status: 201 })
  }

  if (action === 'upsert') {
    const graphInput = body.graph
    if (!graphInput || typeof graphInput !== 'object') {
      return NextResponse.json({ error: 'graph gerekli' }, { status: 400 })
    }
    let draft
    try {
      draft = buildPrereqSource({
        slug: String(graphInput.slug || PREREQ_GRAPH_SLUG),
        title: String(graphInput.title || ''),
        nodes: Array.isArray(graphInput.nodes) ? graphInput.nodes : [],
      })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 400 },
      )
    }
    const slugTag = draft.tags.find((t) => t.startsWith('slug:')) || `slug:${PREREQ_GRAPH_SLUG}`
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
      return NextResponse.json({ item: parseGraph(row) })
    }
    const existing = await prisma.contentSource.findFirst({
      where: { category: PREREQ_CATEGORY, tags: { has: slugTag } },
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
      return NextResponse.json({ item: parseGraph(row) })
    }
    const row = await prisma.contentSource.create({
      data: {
        title: draft.title,
        content: draft.content,
        category: draft.category,
        tags: draft.tags,
      },
    })
    return NextResponse.json({ item: parseGraph(row) }, { status: 201 })
  }

  return NextResponse.json({ error: 'action geçersiz' }, { status: 400 })
}
