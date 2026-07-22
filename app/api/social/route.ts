import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { schedulePost, syncSocialDraftsFromApprovedCaptions } from '@/lib/pipeline'
import { publishPost } from '@/lib/social/publish'
import { publishCaptionWithImages, ensureGeneratedPostImage, syncPostImagesFromCaptions, updatePostOnPlatform } from '@/lib/social/publishCaption'
import { toImagePreviewPath } from '@/lib/social/imagePreview'
import { readPublishMetrics } from '@/lib/social/publishFingerprint'
import { getAuthUrl, upsertDryRunAccount, deactivateAccount } from '@/lib/social/oauth'
import { oauthPlatformStatus } from '@/lib/social/config'
import { generatePkce, pkceCookieName } from '@/lib/social/pkce'

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
      include: {
        account: {
          select: { accountName: true, platform: true, isActive: true, accountId: true, config: true },
        },
      },
    }),
  ])
  return NextResponse.json({
    oauth: oauthPlatformStatus(),
    accounts: accounts.map((a) => {
      const cfg = a.config && typeof a.config === 'object' ? (a.config as Record<string, unknown>) : {}
      return {
        id: a.id,
        platform: a.platform,
        accountName: a.accountName,
        accountId: a.accountId,
        isActive: a.isActive,
        lastSyncAt: a.lastSyncAt,
        dryRun: Boolean(cfg.dryRun) || a.accountId.startsWith('dryrun_'),
        oauth: Boolean(cfg.oauth),
        tokenExpiry: a.tokenExpiry,
      }
    }),
    posts: posts.map((p) => {
      const m = readPublishMetrics(p.metrics)
      const cfg =
        p.account.config && typeof p.account.config === 'object'
          ? (p.account.config as Record<string, unknown>)
          : {}
      const isDryRun = Boolean(cfg.dryRun) || p.account.accountId.startsWith('dryrun_')
      const isMockPost = Boolean(p.platformPostId?.startsWith('mock_'))
      return {
        ...p,
        account: {
          accountName: p.account.accountName,
          platform: p.account.platform,
          isActive: p.account.isActive,
        },
        isDryRun,
        isMockPost,
        imagePreviewUrl: toImagePreviewPath(p.mediaUrls?.[0]),
        imageAttached: m.imageAttached ?? null,
        imageError: m.imageError || (p.status === 'FAILED' ? p.error : null),
      }
    }),
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
    const platformKey = platform === 'TWITTER' ? 'twitter' : 'linkedin'
    let url: string
    let pkceVerifier: string | undefined
    if (platform === 'TWITTER' && process.env.X_CLIENT_ID) {
      const pkce = generatePkce()
      pkceVerifier = pkce.verifier
      url = getAuthUrl(platform as 'TWITTER' | 'LINKEDIN', state, pkce.challenge)
    } else {
      url = getAuthUrl(platform as 'TWITTER' | 'LINKEDIN', state)
    }
    const response = NextResponse.json({ url, state })
    if (pkceVerifier) {
      response.cookies.set(pkceCookieName(platformKey), pkceVerifier, {
        httpOnly: true,
        sameSite: 'lax',
        path: `/api/social/callback/${platformKey}`,
        maxAge: 600,
      })
    }
    return response
  }

  if (action === 'disconnect') {
    const accountId = String(body.accountId || '')
    if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 })
    const account = await deactivateAccount(accountId)
    return NextResponse.json({ account })
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
    const images = await syncPostImagesFromCaptions()
    return NextResponse.json({ ...sync, ...images })
  }

  if (action === 'sync-images') {
    const result = await syncPostImagesFromCaptions()
    return NextResponse.json(result)
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
    try {
      const post = await prisma.socialMediaPost.findUnique({ where: { id: postId } })
      if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

      const mediaUrls = await ensureGeneratedPostImage(post.derivedContentId)
      await prisma.socialMediaPost.update({
        where: { id: postId },
        data: { mediaUrls },
      })

      const replace = post.status === 'PUBLISHED' || body.replace === true
      const result = await publishPost(postId, {
        replace,
        requireImage: true,
        force: body.force === true,
      })
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[publish-now]', postId, message)
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  if (action === 'publish-caption') {
    const derivedContentId = String(body.derivedContentId || '')
    if (!derivedContentId) {
      return NextResponse.json({ error: 'derivedContentId required' }, { status: 400 })
    }
    try {
      const result = await publishCaptionWithImages(derivedContentId)
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  if (action === 'generate-image') {
    const derivedContentId = String(body.derivedContentId || '')
    if (!derivedContentId) {
      return NextResponse.json({ error: 'derivedContentId required' }, { status: 400 })
    }
    try {
      const mediaUrls = await ensureGeneratedPostImage(derivedContentId)
      await prisma.socialMediaPost.updateMany({
        where: { derivedContentId },
        data: { mediaUrls },
      })
      return NextResponse.json({
        mediaUrls,
        imagePreviewUrl: toImagePreviewPath(mediaUrls[0]),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  if (action === 'update-on-platform') {
    const postId = String(body.postId || '')
    if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 })
    try {
      const result = await updatePostOnPlatform(postId)
      return NextResponse.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
