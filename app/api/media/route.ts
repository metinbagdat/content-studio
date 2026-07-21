import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { listMedia } from '@/lib/media/generatePodcast'
import { ttsModeLabel } from '@/lib/media/tts'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const derivedContentId = req.nextUrl.searchParams.get('derivedContentId') || undefined
  const items = await listMedia(derivedContentId)
  return NextResponse.json({ items, ttsMode: ttsModeLabel() })
}
