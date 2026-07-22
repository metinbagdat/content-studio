import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { getMediaFile } from '@/lib/media/mediaDb'
import { imageDiskPath } from '@/lib/media/imageStorage'

export const dynamic = 'force-dynamic'

type RouteCtx = { params: Promise<{ id: string }> }

/** Public image serve — LinkedIn fetch + admin preview. */
export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params
  const media = await getMediaFile(id)
  if (!media || media.mediaType !== 'IMAGE' || media.processingStatus !== 'COMPLETED') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const diskPath = imageDiskPath(`${id}.png`)
  try {
    const data = await readFile(diskPath)
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(data.length),
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File missing on disk' }, { status: 404 })
  }
}
