import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@content-studio/core/auth'
import { generatePodcastAudio } from '@/lib/media/generatePodcast'
import { generatePostClip } from '@/lib/media/generatePostClip'
import { generateAiImageVariations } from '@/lib/image/generateAiImage'
import { generateVideoVariants } from '@/lib/video/generateVideo'
import { generateSongAudio } from '@/lib/media/generateSong'
import { batchExportFromMasterMedia } from '@/lib/image/batchExportFromMaster'
import { clearReviewFault } from '@/lib/review/fault'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const derivedContentId = String(body.derivedContentId || '')
    const kind = String(body.kind || 'podcast').toLowerCase()

    if (kind === 'image' || kind === 'post-image' || kind === 'infographic') {
      if (!derivedContentId) {
        return NextResponse.json({ error: 'derivedContentId required' }, { status: 400 })
      }
      const { prisma } = await import('@/lib/prisma')
      const derived = await prisma.derivedContent.findUnique({
        where: { id: derivedContentId },
        select: { contentType: true },
      })
      if (derived?.contentType === 'INFOGRAPHIC_TEXT' || kind === 'infographic') {
        const { generateInfographicImage } = await import('@/lib/media/generateInfographicImage')
        const result = await generateInfographicImage(derivedContentId)
        await clearReviewFault(derivedContentId).catch(() => {})
        return NextResponse.json(result, { status: result.reused ? 200 : 201 })
      }
      const { generatePostImage } = await import('@/lib/media/generatePostImage')
      const result = await generatePostImage(derivedContentId)
      await clearReviewFault(derivedContentId).catch(() => {})
      return NextResponse.json(result, { status: result.reused ? 200 : 201 })
    }

    if (kind === 'post-clip' || kind === 'clip') {
      if (!derivedContentId) {
        return NextResponse.json({ error: 'derivedContentId required' }, { status: 400 })
      }
      const result = await generatePostClip(derivedContentId)
      await clearReviewFault(derivedContentId).catch(() => {})
      return NextResponse.json(result, { status: result.reused ? 200 : 201 })
    }

    if (kind === 'ai-image') {
      if (!derivedContentId) {
        return NextResponse.json({ error: 'derivedContentId required' }, { status: 400 })
      }
      const count = Number(body.count) || 2
      const variations = await generateAiImageVariations(derivedContentId, count)
      if (variations.length) await clearReviewFault(derivedContentId).catch(() => {})
      return NextResponse.json({ variations }, { status: variations.length ? 201 : 400 })
    }

    if (kind === 'video') {
      if (!derivedContentId) {
        return NextResponse.json({ error: 'derivedContentId required' }, { status: 400 })
      }
      const aspects = Array.isArray(body.aspects) ? body.aspects : ['16:9', '9:16']
      const variants = await generateVideoVariants(derivedContentId, aspects)
      if (variants.length) await clearReviewFault(derivedContentId).catch(() => {})
      return NextResponse.json({ variants }, { status: variants.length ? 201 : 400 })
    }

    if (kind === 'resize-batch') {
      const masterMediaId = String(body.masterMediaId || '')
      if (!masterMediaId) {
        return NextResponse.json({ error: 'masterMediaId required' }, { status: 400 })
      }
      const result = await batchExportFromMasterMedia(masterMediaId, {
        format: body.format === 'png' ? 'png' : 'jpeg',
        quality: body.quality ? Number(body.quality) : 85,
      })
      return NextResponse.json(result, { status: 201 })
    }

    if (kind === 'song' || kind === 'march') {
      if (!derivedContentId) {
        return NextResponse.json({ error: 'derivedContentId required' }, { status: 400 })
      }
      const result = await generateSongAudio(derivedContentId)
      await clearReviewFault(derivedContentId).catch(() => {})
      return NextResponse.json(result, { status: result.reused ? 200 : 201 })
    }

    if (!derivedContentId) {
      return NextResponse.json({ error: 'derivedContentId required' }, { status: 400 })
    }
    const result = await generatePodcastAudio(derivedContentId, { force: body.force === true })
    await clearReviewFault(derivedContentId).catch(() => {})
    return NextResponse.json(result, { status: result.reused ? 200 : 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}