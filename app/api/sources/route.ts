import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const sources = await prisma.contentSource.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ sources })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const title = String(body.title || '').trim()
  const content = String(body.content || '').trim()
  if (!title || !content) {
    return NextResponse.json({ error: 'title and content required' }, { status: 400 })
  }
  const source = await prisma.contentSource.create({
    data: {
      title,
      content,
      category: String(body.category || 'general'),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    },
  })
  return NextResponse.json({ source }, { status: 201 })
}
