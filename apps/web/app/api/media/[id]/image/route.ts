import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { getMediaFile } from '@/lib/media/mediaDb'
import { imageDiskPath } from '@/lib/media/imageStorage'

export const dynamic = 'force-dynamic'

type RouteCtx = { params: Promise<{ id: string }> }

function isAbsoluteHttps(url: string): boolean {
  return /^https:\/\//i.test(url)
}

/** Public image serve — LinkedIn fetch + admin preview. */
export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params
  const media = await getMediaFile(id)
  if (!media || media.mediaType !== 'IMAGE' || media.processingStatus !== 'COMPLETED') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Blob (or any durable CDN) — redirect so /api/media/{id}/image works after /tmp is gone.
  if (media.fileUrl && isAbsoluteHttps(media.fileUrl) && !media.fileUrl.includes('/api/media/')) {
    return NextResponse.redirect(media.fileUrl, 302)
  }

  const ext = media.format === 'jpeg' ? 'jpg' : 'png'
  const contentType = media.format === 'jpeg' ? 'image/jpeg' : 'image/png'
  const diskPath = imageDiskPath(`${id}.${ext}`)
  try {
    const data = await readFile(diskPath)
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(data.length),
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    // Legacy PNG-only rows
    try {
      const data = await readFile(imageDiskPath(`${id}.png`))
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
}
