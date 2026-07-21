import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { deleteSource, getSource, updateSource } from '@/lib/source-crud'

export const dynamic = 'force-dynamic'

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  const source = await getSource(id)
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ source })
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const body = await req.json()
    const source = await updateSource(id, {
      title: body.title,
      content: body.content,
      category: body.category,
      tags: body.tags,
    })
    return NextResponse.json({ source })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message.includes('not found') ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const result = await deleteSource(id)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message.includes('not found') ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
