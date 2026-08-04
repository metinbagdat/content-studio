import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { getMediaFile } from '@/lib/media/mediaDb'
import { videoDiskPath } from '@/lib/video/videoStorage'

export const dynamic = 'force-dynamic'
type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params
  const media = await getMediaFile(id)
  if (!media || media.mediaType !== 'VIDEO' || media.processingStatus !== 'COMPLETED') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  try {
    const data = await readFile(videoDiskPath(`${id}.mp4`))
    return new NextResponse(data, {
      headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(data.length), 'Cache-Control': 'public, max-age=86400' },
    })
  } catch {
    return NextResponse.json({ error: 'File missing on disk' }, { status: 404 })
  }
}