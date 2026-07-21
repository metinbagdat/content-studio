import { NextRequest, NextResponse } from 'next/server'
import { ContentType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { createDerivedContent, setDerivedStatus } from '@/lib/content-crud'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const status = req.nextUrl.searchParams.get('status')
  const items = await prisma.derivedContent.findMany({
    where: status ? { status: status as 'IN_REVIEW' | 'APPROVED' | 'DRAFT' } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { source: { select: { id: true, title: true } } },
  })
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const action = String(body.action || '')

  if (action === 'create') {
    try {
      const contentType = String(body.contentType || '') as ContentType
      if (!Object.values(ContentType).includes(contentType)) {
        return NextResponse.json({ error: 'valid contentType required' }, { status: 400 })
      }
      const item = await createDerivedContent({
        sourceId: String(body.sourceId || ''),
        contentType,
        title: String(body.title || ''),
        content: String(body.content || ''),
        metadata: body.metadata,
        status: body.status === 'DRAFT' ? 'DRAFT' : 'IN_REVIEW',
      })
      return NextResponse.json({ item }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  const id = String(body.id || '')
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'id and action=approve|reject|create required' }, { status: 400 })
  }
  const derived = await setDerivedStatus(id, action === 'approve' ? 'APPROVED' : 'REJECTED')
  return NextResponse.json({ derived })
}
