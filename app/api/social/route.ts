import { NextRequest, NextResponse } from 'next/server'
import { Prisma, type SocialPlatform } from '@prisma/client'
import { prisma, withPrismaRetry } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { schedulePost, syncSocialDraftsFromApprovedCaptions, bulkPublishDraftPosts } from '@/lib/pipeline'
import { getDraftDiagnostics } from '@/lib/social/draftDiagnostics'
import { publishPost } from '@/lib/social/publish'
import { publishCaptionWithImages, ensureGeneratedPostImage, syncPostImagesFromCaptions, updatePostOnPlatform } from '@/lib/social/publishCaption'
import { preparePostForPublish } from '@/lib/social/preparePublish'
import { toImagePreviewPath } from '@/lib/social/imagePreview'
import { readPublishMetrics } from '@/lib/social/publishFingerprint'
import { auditSocialAccounts, repairMissingSocialAccounts } from '@/lib/social/accountAudit'
import { getAuthUrl, upsertDryRunAccount, deactivateAccount } from '@/lib/social/oauth'
import { oauthEnvCheck, oauthPlatformStatus } from '@/lib/social/config'
import {
  getTopPerformingPosts,
  pickPreferredAccount,
  syncAccountStats,
  syncAllAccountStats,
  syncAllPublishedPostAnalytics,
} from '@/lib/social/platformStats'
import { loadAccountPublicRows } from '@/lib/social/accountPublic'
import { getValidAccessToken } from '@/lib/social/tokenRefresh'
import { testYouTubeConnection } from '@/lib/social/youtubeApi'
import { syncYouTubeFromApprovedVideos } from '@/lib/social/youtubeBackfill'
import { generatePkce, generateTikTokPkce, pkceCookieName } from '@/lib/social/pkce'
import {
  tiktokConfigured,
  validateTikTokOAuthRedirect,
  tiktokCallbackUrl,
  tiktokLocalhostSetupHint,
} from '@/lib/social/tiktokApi'

export const dynamic = 'force-dynamic'
/** Bulk publish can take minutes (Meta gap + uploads). Local/dev: long; Vercel Hobby still caps ~60s. */
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return await handleGet()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/social]', message)
    return NextResponse.json({ error: `Sunucu hatası: ${message}` }, { status: 500 })
  }
}

async function handleGet() {
  const [accounts, posts, accountHealth, diagnostics, topPerformers] = await Promise.all([
    loadAccountPublicRows(),
    prisma.socialMediaPost.findMany({
      orderBy: { createdAt: 'desc' },
      take: 80,
      select: {
        id: true,
        platform: true,
        status: true,
        createdAt: true,
        publishedAt: true,
        scheduledAt: true,
        platformPostId: true,
        derivedContentId: true,
        error: true,
        mediaUrls: true,
        metrics: true,
        account: {
          select: { accountName: true, platform: true, isActive: true, accountId: true },
        },
        derivedContent: { select: { metadata: true } },
      },
    }),
    auditSocialAccounts(),
    getDraftDiagnostics(),
    getTopPerformingPosts(5),
  ])
  const previewRows =
    posts.length === 0
      ? []
      : await prisma.$queryRaw<Array<{ id: string; preview: string | null }>>`
          SELECT id, LEFT("postContent", 160) AS preview
          FROM "SocialMediaPost"
          WHERE id IN (${Prisma.join(posts.map((p) => Prisma.sql`${p.id}`))})
        `
  const previewById = new Map(previewRows.map((r) => [r.id, r.preview || '']))
  return NextResponse.json({
    oauth: oauthPlatformStatus(),
    envCheck: oauthEnvCheck(),
    accountHealth,
    diagnostics,
    topPerformers,
    accounts: accounts.map((a) => {
      const username =
        (typeof a.username === 'string' ? `@${a.username.replace(/^@/, '')}` : null) ||
        a.stats?.username ||
        (a.accountName.startsWith('@') ? a.accountName : null)
      return {
        id: a.id,
        platform: a.platform,
        accountName: a.accountName,
        username,
        accountId: a.accountId,
        isActive: a.isActive,
        lastSyncAt: a.lastSyncAt,
        dryRun: a.dryRun,
        oauth: a.oauth,
        tokenExpiry: a.tokenExpiry,
        stats: a.stats,
        organizationId: a.organizationId,
        linkedinAuthorUrn: a.linkedinAuthorUrn,
      }
    }),
    posts: posts.map((p) => {
      const m = readPublishMetrics(p.metrics)
      const analytics = (m as { analytics?: Record<string, unknown> }).analytics
      const isDryRun = p.account.accountId.startsWith('dryrun_')
      const isMockPost = Boolean(p.platformPostId?.startsWith('mock_'))
      const derivedMeta =
        p.derivedContent?.metadata && typeof p.derivedContent.metadata === 'object'
          ? (p.derivedContent.metadata as Record<string, unknown>)
          : {}
      return {
        id: p.id,
        platform: p.platform,
        status: p.status,
        createdAt: p.createdAt,
        publishedAt: p.publishedAt,
        scheduledAt: p.scheduledAt,
        platformPostId: p.platformPostId,
        derivedContentId: p.derivedContentId,
        error: p.error,
        mediaUrls: p.mediaUrls,
        metrics: p.metrics,
        postContent: previewById.get(p.id) || '',
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
        analytics: analytics || null,
        segment: typeof derivedMeta.segment === 'string' ? derivedMeta.segment : null,
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

  try {
    return await handleAction(action, body)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[POST /api/social] action=${action}`, message)
    return NextResponse.json({ error: `Sunucu hatası (${action}): ${message}` }, { status: 500 })
  }
}

async function handleAction(action: string, body: Record<string, unknown>) {
  if (action === 'sync-stats') {
    const accounts = await syncAllAccountStats()
    const posts = await syncAllPublishedPostAnalytics(40)
    const accountHealth = await auditSocialAccounts()
    return NextResponse.json({ accounts, posts, accountHealth })
  }

  // Read-only: comments + engagement for content changes — never replies/DMs.
  if (action === 'engagement-digest') {
    const { buildEngagementDigest } = await import('@/lib/social/engagementDigest')
    const digest = await buildEngagementDigest({
      limit: typeof body.limit === 'number' ? body.limit : 20,
      syncFirst: body.syncFirst !== false,
      fetchCommentText: body.fetchCommentText !== false,
    })
    return NextResponse.json({ digest })
  }

  if (action === 'repair-accounts') {
    const accountHealth = await repairMissingSocialAccounts()
    const sync = await syncSocialDraftsFromApprovedCaptions()
    return NextResponse.json({ accountHealth, sync })
  }

  if (action === 'bootstrap-faz2') {
    const { bootstrapFaz2DryRunAccounts } = await import('@/lib/social/accountAudit')
    const created = await bootstrapFaz2DryRunAccounts()
    const sync = await syncSocialDraftsFromApprovedCaptions()
    const diagnostics = await getDraftDiagnostics()
    return NextResponse.json({ created, sync, diagnostics })
  }

  if (action === 'youtube-test') {
    const account = await prisma.socialMediaAccount.findFirst({
      where: { platform: 'YOUTUBE', isActive: true, accountId: { not: { startsWith: 'dryrun_' } } },
      orderBy: { updatedAt: 'desc' },
    })
    if (!account) {
      return NextResponse.json({ error: 'YouTube hesabı bağlı değil — OAuth bağla' }, { status: 400 })
    }
    const token = await getValidAccessToken(account)
    const result = await testYouTubeConnection(token)
    return NextResponse.json({ result, accountId: account.id, accountName: account.accountName })
  }

  if (action === 'meta-test') {
    const platform = String(body.platform || 'FACEBOOK').toUpperCase()
    if (platform !== 'FACEBOOK' && platform !== 'INSTAGRAM') {
      return NextResponse.json({ error: 'platform FACEBOOK|INSTAGRAM' }, { status: 400 })
    }
    const account = await prisma.socialMediaAccount.findFirst({
      where: {
        platform: platform as SocialPlatform,
        isActive: true,
        accountId: { not: { startsWith: 'dryrun_' } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    if (!account) {
      return NextResponse.json({ error: `${platform} OAuth hesabı yok — OAuth bağla` }, { status: 400 })
    }
    const token = await getValidAccessToken(account)
    const { testMetaConnection } = await import('@/lib/social/metaApi')
    const result = await testMetaConnection(platform as SocialPlatform, token, account.config)
    return NextResponse.json({ result, accountId: account.id, accountName: account.accountName })
  }

  if (action === 'youtube-sync') {
    const limit = Number(body.limit) || 5
    const publishNow = Boolean(body.publishNow)
    const result = await syncYouTubeFromApprovedVideos({
      limit,
      generateVideo: true,
      schedule: true,
      publishNow,
    })
    const diagnostics = await getDraftDiagnostics()
    return NextResponse.json({ result, diagnostics })
  }

  if (action === 'connect-url') {
    const platform = String(body.platform || '').toUpperCase()
    const OAUTH_PLATFORMS = ['TWITTER', 'LINKEDIN', 'YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK'] as const
    if (!OAUTH_PLATFORMS.includes(platform as (typeof OAUTH_PLATFORMS)[number])) {
      return NextResponse.json(
        { error: 'platform TWITTER|LINKEDIN|YOUTUBE|FACEBOOK|INSTAGRAM|TIKTOK' },
        { status: 400 },
      )
    }
    const state = crypto.randomUUID()
    const platformKey =
      platform === 'TWITTER'
        ? 'twitter'
        : platform === 'LINKEDIN'
          ? 'linkedin'
          : platform === 'YOUTUBE'
            ? 'youtube'
            : platform === 'FACEBOOK'
              ? 'facebook'
              : platform === 'INSTAGRAM'
                ? 'instagram'
                : 'tiktok'
    let url: string
    let pkceVerifier: string | undefined
    if (platform === 'TWITTER' && process.env.X_CLIENT_ID) {
      const pkce = generatePkce()
      pkceVerifier = pkce.verifier
      url = getAuthUrl('TWITTER', state, pkce.challenge)
    } else if (platform === 'TIKTOK' && tiktokConfigured()) {
      const redirectError = validateTikTokOAuthRedirect(tiktokCallbackUrl())
      if (redirectError) {
        return NextResponse.json({ error: redirectError, redirectUri: tiktokCallbackUrl() }, { status: 400 })
      }
      const pkce = generateTikTokPkce()
      pkceVerifier = pkce.verifier
      url = getAuthUrl('TIKTOK', state, pkce.challenge)
    } else {
      url = getAuthUrl(
        platform as 'TWITTER' | 'LINKEDIN' | 'YOUTUBE' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK',
        state,
      )
    }
    const response = NextResponse.json({
      url,
      state,
      ...(platform === 'TIKTOK' ? { localhostHint: tiktokLocalhostSetupHint(tiktokCallbackUrl()) } : {}),
    })
    if (
      pkceVerifier &&
      (platformKey === 'twitter' || platformKey === 'linkedin' || platformKey === 'tiktok')
    ) {
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
    const ALL_PLATFORMS = ['TWITTER', 'LINKEDIN', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK']
    if (!ALL_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: `platform ${ALL_PLATFORMS.join('|')}` }, { status: 400 })
    }
    const account = await upsertDryRunAccount(platform as SocialPlatform, `Dry-run ${platform}`)
    const sync = await syncSocialDraftsFromApprovedCaptions()
    const diagnostics = await getDraftDiagnostics()
    return NextResponse.json({ account, sync, diagnostics })
  }

  if (action === 'sync-drafts') {
    const sync = await syncSocialDraftsFromApprovedCaptions()
    const images = await syncPostImagesFromCaptions()
    const diagnostics = await getDraftDiagnostics()
    return NextResponse.json({ ...sync, ...images, diagnostics })
  }

  if (action === 'sync-images') {
    const result = await syncPostImagesFromCaptions()
    return NextResponse.json(result)
  }

  if (action === 'bulk-publish') {
    const includeDryRun = Boolean(body.includeDryRun)
    const platformRaw = body.platform ? String(body.platform).toUpperCase() : undefined
    const platform = platformRaw as SocialPlatform | undefined
    const limit = body.limit != null ? Number(body.limit) : undefined
    const result = await bulkPublishDraftPosts({
      includeDryRun,
      platform,
      limit: limit && Number.isFinite(limit) ? limit : undefined,
    })
    if (platform) {
      const platformAccounts = await prisma.socialMediaAccount.findMany({
        where: { platform, isActive: true },
      })
      const preferred = pickPreferredAccount(platformAccounts)
      if (preferred && !preferred.accountId.startsWith('dryrun_')) {
        try {
          await syncAccountStats(preferred.id)
        } catch (err) {
          console.warn('[bulk-publish sync-stats]', platform, err)
        }
      }
    }
    await syncAllPublishedPostAnalytics(30).catch(() => {})
    let diagnostics = null
    try {
      diagnostics = await withPrismaRetry(() => getDraftDiagnostics())
    } catch (err) {
      console.warn('[bulk-publish diagnostics]', err)
    }
    return NextResponse.json({ result, diagnostics })
  }

  if (action === 'schedule') {
    const postId = String(body.postId || '')
    const when = body.scheduledAt ? new Date(body.scheduledAt as string | number) : new Date(Date.now() + 60_000)
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

      const mediaUrls = await preparePostForPublish(postId)
      await prisma.socialMediaPost.update({
        where: { id: postId },
        data: { mediaUrls },
      })

      const replace = post.status === 'PUBLISHED' || body.replace === true
      const result = await publishPost(postId, {
        replace,
        requireImage: post.platform === 'LINKEDIN',
        requireVideo: post.platform === 'YOUTUBE',
        force: body.force === true,
      })
      let accountStats = null
      try {
        accountStats = await syncAccountStats(post.accountId)
      } catch (err) {
        console.warn('[publish-now sync-stats]', post.accountId, err)
      }
      const updated = await prisma.socialMediaPost.findUnique({ where: { id: postId } })
      return NextResponse.json({ ...result, accountStats, post: updated })
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
