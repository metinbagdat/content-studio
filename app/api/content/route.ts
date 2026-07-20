import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { setDerivedStatus } from '@/lib/pipeline'

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
  const id = String(body.id || '')
  const action = String(body.action || '')
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'id and action=approve|reject required' }, { status: 400 })
  }
  const derived = await setDerivedStatus(id, action === 'approve' ? 'APPROVED' : 'REJECTED')
  return NextResponse.json({ derived })
}
