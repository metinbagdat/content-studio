import { NextRequest } from 'next/server'
import { POST as publishedPost } from '../../webhooks/wordpress-published/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Alias of /api/webhooks/wordpress-published for WP CS_WEBHOOK_URL. */
export async function POST(req: NextRequest) {
  return publishedPost(req)
}
