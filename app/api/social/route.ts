import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { schedulePost, syncSocialDraftsFromApprovedCaptions } from '@/lib/pipeline'
import { publishPost } from '@/lib/social/publish'
import { getAuthUrl, upsertDryRunAccount } from '@/lib/social/oauth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const [accounts, posts] = await Promise.all([
    prisma.socialMediaAccount.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.socialMediaPost.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { account: { select: { accountName: true, platform: true } } },
    }),
  ])
  return NextResponse.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      accountName: a.accountName,
      accountId: a.accountId,
      isActive: a.isActive,
      lastSyncAt: a.lastSyncAt,
    })),
    posts,
  })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  const action = String(body.action || '')

  if (action === 'connect-url') {
    const platform = String(body.platform || '').toUpperCase()
    if (platform !== 'TWITTER' && platform !== 'LINKEDIN') {
      return NextResponse.json({ error: 'platform TWITTER|LINKEDIN' }, { status: 400 })
    }
    const state = crypto.randomUUID()
    return NextResponse.json({ url: getAuthUrl(platform, state), state })
  }

  if (action === 'dry-run-connect') {
    const platform = String(body.platform || '').toUpperCase()
    if (platform !== 'TWITTER' && platform !== 'LINKEDIN') {
      return NextResponse.json({ error: 'platform TWITTER|LINKEDIN' }, { status: 400 })
    }
    const account = await upsertDryRunAccount(
      platform as 'TWITTER' | 'LINKEDIN',
      `Dry-run ${platform}`,
    )
    const sync = await syncSocialDraftsFromApprovedCaptions()
    return NextResponse.json({ account, sync })
  }

  if (action === 'sync-drafts') {
    const sync = await syncSocialDraftsFromApprovedCaptions()
    return NextResponse.json(sync)
  }

  if (action === 'schedule') {
    const postId = String(body.postId || '')
    const when = body.scheduledAt ? new Date(body.scheduledAt) : new Date(Date.now() + 60_000)
    if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 })
    const post = await schedulePost(postId, when)
    return NextResponse.json({ post })
  }

  if (action === 'publish-now') {
    const postId = String(body.postId || '')
    if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 })
    const result = await publishPost(postId)
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
