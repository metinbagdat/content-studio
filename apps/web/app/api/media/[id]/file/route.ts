import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { requireAdmin } from '@content-studio/core/auth'
import { getMediaFile } from '@/lib/media/mediaDb'
import { audioDiskPath, isDurableMediaUrl } from '@/lib/media/audioStorage'

export const dynamic = 'force-dynamic'

type RouteCtx = { params: Promise<{ id: string }> }

/**
 * Admin audio URL. Durable Blob URLs → 302 (no Vercel byte egress). Disk only for local dev.
 */
export async function GET(req: NextRequest, ctx: RouteCtx) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  const media = await getMediaFile(id)
  if (!media || media.mediaType !== 'AUDIO' || media.processingStatus !== 'COMPLETED') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (isDurableMediaUrl(media.fileUrl)) {
    return NextResponse.redirect(media.fileUrl, 302)
  }

  const diskPath = audioDiskPath(`${id}.mp3`)
  try {
    const data = await readFile(diskPath)
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(data.length),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File missing on disk' }, { status: 404 })
  }
}
