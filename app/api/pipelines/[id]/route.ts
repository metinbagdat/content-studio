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
