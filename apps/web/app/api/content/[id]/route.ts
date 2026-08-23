import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@content-studio/core/auth'
import { deleteDerivedContent, getDerivedContent, updateDerivedContent } from '@/lib/content-crud'

export const dynamic = 'force-dynamic'

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  const item = await getDerivedContent(id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ item })
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const body = await req.json()
    const item = await updateDerivedContent(id, {
      title: body.title,
      content: body.content,
      metadata: body.metadata,
      reviewNote: body.reviewNote ? String(body.reviewNote) : undefined,
      status: body.status,
      reopen: body.reopen === true,
    })
    return NextResponse.json({ item })
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
    const result = await deleteDerivedContent(id)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message.includes('not found') ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  // Alias: reopen via POST { action: 'reopen' }
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  if (body.action !== 'reopen') {
    return NextResponse.json({ error: 'Use PATCH or action=reopen' }, { status: 400 })
  }
  try {
    const item = await updateDerivedContent(id, { reopen: true, reviewNote: 'Tekrar incelemeye alındı' })
    return NextResponse.json({ item })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
