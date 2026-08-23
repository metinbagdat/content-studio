import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { listMedia } from '@/lib/media/mediaDb'
import { ttsModeLabel } from '@/lib/media/tts'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const AUDIO_CONTENT_TYPES = ['PODCAST_SCRIPT', 'MARCH_LYRICS', 'SONG_LYRICS'] as const

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const derivedContentId = req.nextUrl.searchParams.get('derivedContentId') || undefined
  const needsAudio = req.nextUrl.searchParams.get('needsAudio') === '1'

  if (needsAudio) {
    const rows = await prisma.derivedContent.findMany({
      where: {
        contentType: { in: [...AUDIO_CONTENT_TYPES] },
        status: { in: ['APPROVED', 'IN_REVIEW', 'PUBLISHED'] },
      },
      select: {
        id: true,
        title: true,
        contentType: true,
        status: true,
        createdAt: true,
        mediaFiles: {
          where: { mediaType: 'AUDIO' },
          select: { id: true, processingStatus: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    const pending = rows
      .filter((r) => !r.mediaFiles.some((m) => m.processingStatus === 'COMPLETED'))
      .map(({ mediaFiles: _m, ...rest }) => rest)
    return NextResponse.json({
      pending,
      ttsMode: ttsModeLabel(),
    })
  }

  const items = await listMedia(derivedContentId)
  return NextResponse.json({ items, ttsMode: ttsModeLabel() })
}
