import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { generatePodcastAudio } from '@/lib/media/generatePodcast'

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
    const result = await generatePodcastAudio(derivedContentId)
    return NextResponse.json(result, { status: result.reused ? 200 : 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
