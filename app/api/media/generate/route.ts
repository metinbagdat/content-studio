import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { generatePodcastAudio } from '@/lib/media/generatePodcast'
import { generatePostClip } from '@/lib/media/generatePostClip'
import { generateAiImageVariations } from '@/lib/image/generateAiImage'
import { generateVideoVariants } from '@/lib/video/generateVideo'
import { generateSongAudio } from '@/lib/media/generateSong'
import { batchExportFromMasterMedia } from '@/lib/image/batchExportFromMaster'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const derivedContentId = String(body.derivedContentId || '')
    const kind = String(body.kind || 'podcast').toLowerCase()

    if (kind === 'image' || kind === 'post-image') {
      if (!derivedContentId) {
        return NextResponse.json({ error: 'derivedContentId required' }, { status: 400 })
      }
      const { generatePostImage } = await import('@/lib/media/generatePostImage')
      const result = await generatePostImage(derivedContentId)
      return NextResponse.json(result, { status: result.reused ? 200 : 201 })
    }

    if (kind === 'post-clip' || kind === 'clip') {
      if (!derivedContentId) {
        return NextResponse.json({ error: 'derivedContentId required' }, { status: 400 })
      }
      const result = await generatePostClip(derivedContentId)
      return NextResponse.json(result, { status: result.reused ? 200 : 201 })
    }

    if (kind === 'ai-image') {
      if (!derivedContentId) {
        return NextResponse.json({ error: 'derivedContentId required' }, { status: 400 })
      }
      const count = Number(body.count) || 2
      const variations = await generateAiImageVariations(derivedContentId, count)
      return NextResponse.json({ variations }, { status: variations.length ? 201 : 400 })
    }

    if (kind === 'video') {
      if (!derivedContentId) {
        return NextResponse.json({ error: 'derivedContentId required' }, { status: 400 })
      }
      const aspects = Array.isArray(body.aspects) ? body.aspects : ['16:9', '9:16']
      const variants = await generateVideoVariants(derivedContentId, aspects)
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
      return NextResponse.json(result, { status: result.reused ? 200 : 201 })
    }

    if (!derivedContentId) {
      return NextResponse.json({ error: 'derivedContentId required' }, { status: 400 })
    }
    const result = await generatePodcastAudio(derivedContentId, { force: body.force === true })
    return NextResponse.json(result, { status: result.reused ? 200 : 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
