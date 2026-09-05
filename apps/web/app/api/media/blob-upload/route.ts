import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@content-studio/core/auth'
import { prisma } from '@/lib/prisma'
import { persistGeneratedVideo, isDurableMediaUrl } from '@/lib/video/videoStorage'
import { clearReviewFault } from '@/lib/review/fault'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Admin: upload an MP4 body → Vercel Blob `videos/{mediaId}.mp4` → update MediaFile.fileUrl.
 * Lets the operator push local ffmpeg output using prod's BLOB_READ_WRITE_TOKEN
 * (no local token required). Body size must fit the platform limit (~4.5MB on Hobby).
 *
 * POST /api/media/blob-upload?mediaId=...
 * Headers: x-admin-key, Content-Type: video/mp4
 * Body: raw bytes
 *
 * Or JSON: { mediaId, derivedContentId?, create?: true } is not used for bytes —
 * prefer raw body. Optional query create=1 + derivedContentId creates a new MediaFile first.
 */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
      return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN missing on server' }, { status: 500 })
    }

    const url = new URL(req.url)
    let mediaId = url.searchParams.get('mediaId') || ''
    const derivedContentId = url.searchParams.get('derivedContentId') || ''
    const create = url.searchParams.get('create') === '1'

    const buf = Buffer.from(await req.arrayBuffer())
    if (!buf.length) {
      return NextResponse.json({ error: 'Empty body' }, { status: 400 })
    }
    if (buf.length > 4_500_000) {
      return NextResponse.json(
        {
          error: `Body ${buf.length} bytes exceeds ~4.5MB Hobby limit — shrink MP4 or use local BLOB_READ_WRITE_TOKEN + upload-videos-to-blob.ts`,
        },
        { status: 413 },
      )
    }

    if (create) {
      if (!derivedContentId) {
        return NextResponse.json({ error: 'derivedContentId required with create=1' }, { status: 400 })
      }
      const derived = await prisma.derivedContent.findUnique({ where: { id: derivedContentId } })
      if (!derived) return NextResponse.json({ error: 'Derived not found' }, { status: 404 })
      const media = await prisma.mediaFile.create({
        data: {
          derivedContentId,
          mediaType: 'VIDEO',
          fileUrl: '',
          format: 'mp4',
          processingStatus: 'PROCESSING',
        },
      })
      mediaId = media.id
    }

    if (!mediaId) {
      return NextResponse.json({ error: 'mediaId required' }, { status: 400 })
    }

    const existing = await prisma.mediaFile.findUnique({ where: { id: mediaId } })
    if (!existing || existing.mediaType !== 'VIDEO') {
      return NextResponse.json({ error: 'VIDEO MediaFile not found' }, { status: 404 })
    }

    const fileUrl = await persistGeneratedVideo(mediaId, buf)
    const updated = await prisma.mediaFile.update({
      where: { id: mediaId },
      data: {
        fileUrl,
        fileSize: buf.length,
        format: 'mp4',
        processingStatus: 'COMPLETED',
      },
    })

    await clearReviewFault(existing.derivedContentId).catch(() => {})

    return NextResponse.json({
      ok: true,
      mediaId: updated.id,
      derivedContentId: existing.derivedContentId,
      fileUrl: updated.fileUrl,
      durable: isDurableMediaUrl(updated.fileUrl),
      bytes: buf.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
