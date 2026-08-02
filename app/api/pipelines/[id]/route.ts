import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  const pipeline = await prisma.contentPipeline.findUnique({
    where: { id },
    include: {
      source: {
        include: { derivedContents: { orderBy: { createdAt: 'asc' } } },
      },
    },
  })
  if (!pipeline) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ pipeline })
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    await prisma.contentPipeline.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  if (body.action !== 'process-now') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
  try {
    const { processPipeline } = await import('@/lib/pipeline')
    const result = await processPipeline(id)
    return NextResponse.json({ result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
