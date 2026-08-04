import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { generatePodcastAudio } from '@/lib/media/generatePodcast'
import { generatePostImage } from '@/lib/media/generatePostImage'
import { generateAiImageVariations } from '@/lib/image/generateAiImage'  // YENİ
import { generateVideoVariants } from '@/lib/video/generateVideo'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const derivedContentId = String(body.derivedContentId || '')
    if (!derivedContentId) {
      return NextResponse.json({ error: 'derivedContentId required' }, { status: 400 })
    }
    const kind = String(body.kind || 'podcast').toLowerCase()

    if (kind === 'image' || kind === 'post-image') {
      const result = await generatePostImage(derivedContentId)
      return NextResponse.json(result, { status: result.reused ? 200 : 201 })
    }

    if (kind === 'ai-image') {  // YENİ blok
      const count = Number(body.count) || 2
      const variations = await generateAiImageVariations(derivedContentId, count)
      return NextResponse.json({ variations }, { status: variations.length ? 201 : 400 })
    }

	if (kind === 'video') {
      const aspects = Array.isArray(body.aspects) ? body.aspects : ['16:9', '9:16']
      const variants = await generateVideoVariants(derivedContentId, aspects)
      return NextResponse.json({ variants }, { status: variants.length ? 201 : 400 })
    }
	
    const result = await generatePodcastAudio(derivedContentId)
    return NextResponse.json(result, { status: result.reused ? 200 : 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}