import type { SocialMediaAccount, SocialPlatform } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { linkedinAuthorUrn } from './config'
import { getValidAccessToken } from './tokenRefresh'
import { readPublishMetrics, type PostPublishMetrics } from './publishFingerprint'

export type PlatformAccountStats = {
  username: string | null
  displayName: string | null
  profileUrl: string | null
  followers: number | null
  following: number | null
  postsCount: number | null
  impressions: number | null
  engagement: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  clicks: number | null
  fetchedAt: string | null
  error?: string
}

export type PostAnalytics = {
  impressions: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  clicks: number | null
  engagement: number | null
  fetchedAt: string
}

function cfgOf(config: unknown): Record<string, unknown> {
  return config && typeof config === 'object' ? (config as Record<string, unknown>) : {}
}

function xApiErrorMessage(status: number): string {
  if (status === 402) {
    return 'X API bu uç nokta için ücretli plan istiyor (Basic ~$200/ay) — takipçi/gösterim burada görünmez. Paylaşım (tweet.write) etkilenmez.'
  }
  if (status === 429) {
    return 'X API rate limit — birkaç dakika sonra "İstatistikleri yenile" ile tekrar deneyin.'
  }
  if (status === 401 || status === 403) {
    return 'X yetkilendirme hatası — OAuth ile X bağla işlemini tekrarlayın.'
  }
  return `X API ${status}`
}

function isDryRun(account: SocialMediaAccount): boolean {
  const cfg = cfgOf(account.config)
  return account.accountId.startsWith('dryrun_') || Boolean(cfg.dryRun)
}

function readStoredStats(config: unknown): PlatformAccountStats | null {
  const stats = cfgOf(config).stats
  if (!stats || typeof stats !== 'object') return null
  return stats as PlatformAccountStats
}

async function fetchTwitterAccountStats(
  account: SocialMediaAccount,
  accessToken: string,
): Promise<PlatformAccountStats> {
  if (accessToken === 'dry-run' || isDryRun(account)) {
    return {
      username: cfgOf(account.config).username as string | null ?? 'dry-run',
      displayName: account.accountName,
      profileUrl: null,
      followers: null,
      following: null,
      postsCount: null,
      impressions: null,
      engagement: null,
      likes: null,
      comments: null,
      shares: null,
      clicks: null,
      fetchedAt: new Date().toISOString(),
      error: 'Dry-run — gerçek istatistik yok',
    }
  }

  const res = await fetch(
    `https://api.twitter.com/2/users/${account.accountId}?user.fields=public_metrics,username,name`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) {
    const username = cfgOf(account.config).username as string | null | undefined
    return {
      username: username ? `@${username}` : null,
      displayName: account.accountName,
      profileUrl: username ? `https://twitter.com/${username}` : null,
      followers: null,
      following: null,
      postsCount: null,
      impressions: null,
      engagement: null,
      likes: null,
      comments: null,
      shares: null,
      clicks: null,
      fetchedAt: new Date().toISOString(),
      error: xApiErrorMessage(res.status),
    }
  }

  const body = (await res.json()) as {
    data?: {
      username?: string
      name?: string
      public_metrics?: {
        followers_count?: number
        following_count?: number
        tweet_count?: number
        like_count?: number
      }
    }
  }
  const m = body.data?.public_metrics
  const username = body.data?.username

  const published = await prisma.socialMediaPost.findMany({
    where: { accountId: account.id, status: 'PUBLISHED', platform: 'TWITTER' },
    select: { metrics: true },
    take: 100,
  })
  let impressions = 0
  let likes = 0
  let comments = 0
  let shares = 0
  for (const p of published) {
    const a = readPostAnalytics(p.metrics)
    if (a) {
      impressions += a.impressions ?? 0
      likes += a.likes ?? 0
      comments += a.comments ?? 0
      shares += a.shares ?? 0
    }
  }

  return {
    username: username ? `@${username}` : account.accountName,
    displayName: body.data?.name ?? account.accountName,
    profileUrl: username ? `https://twitter.com/${username}` : null,
    followers: m?.followers_count ?? null,
    following: m?.following_count ?? null,
    postsCount: m?.tweet_count ?? null,
    impressions: published.length ? impressions : null,
    engagement: likes + comments + shares || null,
    likes: likes || null,
    comments: comments || null,
    shares: shares || null,
    clicks: null,
    fetchedAt: new Date().toISOString(),
  }
}

async function fetchLinkedInAccountStats(
  account: SocialMediaAccount,
  accessToken: string,
): Promise<PlatformAccountStats> {
  if (accessToken === 'dry-run' || isDryRun(account)) {
    return {
      username: 'dry-run',
      displayName: account.accountName,
      profileUrl: null,
      followers: null,
      following: null,
      postsCount: null,
      impressions: null,
      engagement: null,
      likes: null,
      comments: null,
      shares: null,
      clicks: null,
      fetchedAt: new Date().toISOString(),
      error: 'Dry-run — gerçek istatistik yok',
    }
  }

  const cfg = cfgOf(account.config)
  const orgId = process.env.LINKEDIN_ORGANIZATION_ID
  const useOrg = process.env.LINKEDIN_ORG_POST === 'true' && orgId
  let followers: number | null = null
  let profileUrl: string | null = null
  let username: string | null = account.accountName

  if (useOrg && orgId) {
    profileUrl = `https://www.linkedin.com/company/${orgId}`
    username = `org:${orgId}`
    try {
      const urn = encodeURIComponent(`urn:li:organization:${orgId}`)
      const netRes = await fetch(
        `https://api.linkedin.com/v2/networkSizes/${urn}?edgeType=CompanyFollowedByMember`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      if (netRes.ok) {
        const net = (await netRes.json()) as { firstDegreeSize?: number }
        followers = net.firstDegreeSize ?? null
      }
    } catch {
      /* optional */
    }
  } else {
    const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (meRes.ok) {
      const me = (await meRes.json()) as { name?: string; sub?: string }
      username = me.name ?? account.accountName
    }
  }

  const published = await prisma.socialMediaPost.findMany({
    where: { accountId: account.id, status: 'PUBLISHED', platform: 'LINKEDIN' },
    select: { metrics: true },
    take: 100,
  })
  let impressions = 0
  let likes = 0
  let comments = 0
  let shares = 0
  let clicks = 0
  for (const p of published) {
    const a = readPostAnalytics(p.metrics)
    if (a) {
      impressions += a.impressions ?? 0
      likes += a.likes ?? 0
      comments += a.comments ?? 0
      shares += a.shares ?? 0
      clicks += a.clicks ?? 0
    }
  }

  return {
    username,
    displayName: account.accountName,
    profileUrl,
    followers,
    following: null,
    postsCount: published.length || null,
    impressions: impressions || null,
    engagement: likes + comments + shares + clicks || null,
    likes: likes || null,
    comments: comments || null,
    shares: shares || null,
    clicks: clicks || null,
    fetchedAt: new Date().toISOString(),
  }
}

export async function fetchAccountStats(account: SocialMediaAccount): Promise<PlatformAccountStats> {
  const token = await getValidAccessToken(account)
  if (account.platform === 'TWITTER') return fetchTwitterAccountStats(account, token)
  if (account.platform === 'LINKEDIN') return fetchLinkedInAccountStats(account, token)
  return {
    username: null,
    displayName: account.accountName,
    profileUrl: null,
    followers: null,
    following: null,
    postsCount: null,
    impressions: null,
    engagement: null,
    likes: null,
    comments: null,
    shares: null,
    clicks: null,
    fetchedAt: new Date().toISOString(),
    error: 'Platform stats not implemented',
  }
}

export async function syncAccountStats(accountId: string): Promise<PlatformAccountStats> {
  const account = await prisma.socialMediaAccount.findUnique({ where: { id: accountId } })
  if (!account) throw new Error('Account not found')
  const stats = await fetchAccountStats(account)
  const cfg = cfgOf(account.config)
  await prisma.socialMediaAccount.update({
    where: { id: accountId },
    data: {
      lastSyncAt: new Date(),
      config: { ...cfg, stats } as Prisma.InputJsonValue,
    },
  })
  return stats
}

export async function syncAllAccountStats(): Promise<{ synced: number; errors: string[] }> {
  const accounts = await prisma.socialMediaAccount.findMany({
    where: { isActive: true, platform: { in: ['TWITTER', 'LINKEDIN'] } },
  })
  let synced = 0
  const errors: string[] = []
  for (const account of accounts) {
    try {
      await syncAccountStats(account.id)
      synced += 1
    } catch (err) {
      errors.push(`${account.platform}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return { synced, errors }
}

export function readPostAnalytics(metrics: unknown): PostAnalytics | null {
  const m = readPublishMetrics(metrics)
  const analytics = (m as PostPublishMetrics & { analytics?: PostAnalytics }).analytics
  if (!analytics || typeof analytics !== 'object') return null
  return analytics
}

async function fetchTwitterPostAnalytics(
  platformPostId: string,
  accessToken: string,
): Promise<PostAnalytics | null> {
  if (!platformPostId || platformPostId.startsWith('mock_') || accessToken === 'dry-run') return null
  const res = await fetch(
    `https://api.twitter.com/2/tweets/${platformPostId}?tweet.fields=public_metrics`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) return null
  const body = (await res.json()) as {
    data?: { public_metrics?: { impression_count?: number; like_count?: number; reply_count?: number; retweet_count?: number; quote_count?: number } }
  }
  const pm = body.data?.public_metrics
  if (!pm) return null
  const likes = pm.like_count ?? 0
  const comments = pm.reply_count ?? 0
  const shares = (pm.retweet_count ?? 0) + (pm.quote_count ?? 0)
  return {
    impressions: pm.impression_count ?? null,
    likes,
    comments,
    shares,
    clicks: null,
    engagement: likes + comments + shares,
    fetchedAt: new Date().toISOString(),
  }
}

async function fetchLinkedInPostAnalytics(
  platformPostId: string,
  accessToken: string,
  account: SocialMediaAccount,
): Promise<PostAnalytics | null> {
  if (!platformPostId || platformPostId.startsWith('mock_') || accessToken === 'dry-run') return null

  const author = linkedinAuthorUrn(account.accountId, account.config)
  const shareUrn = platformPostId.startsWith('urn:')
    ? platformPostId
    : `urn:li:share:${platformPostId}`

  const orgId = process.env.LINKEDIN_ORGANIZATION_ID
  if (process.env.LINKEDIN_ORG_POST === 'true' && orgId) {
    const params = new URLSearchParams({
      q: 'organizationalEntity',
      organizationalEntity: `urn:li:organization:${orgId}`,
    })
    const res = await fetch(
      `https://api.linkedin.com/v2/organizationalEntityShareStatistics?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (res.ok) {
      const body = (await res.json()) as {
        elements?: Array<{
          totalShareStatistics?: {
            impressionCount?: number
            likeCount?: number
            commentCount?: number
            shareCount?: number
            clickCount?: number
            engagement?: number
          }
          share?: string
        }>
      }
      const el = body.elements?.find((e) => e.share === shareUrn) ?? body.elements?.[0]
      const t = el?.totalShareStatistics
      if (t) {
        return {
          impressions: t.impressionCount ?? null,
          likes: t.likeCount ?? null,
          comments: t.commentCount ?? null,
          shares: t.shareCount ?? null,
          clicks: t.clickCount ?? null,
          engagement: t.engagement ?? null,
          fetchedAt: new Date().toISOString(),
        }
      }
    }
  }

  // Member share statistics fallback
  const params = new URLSearchParams({
    q: 'owners',
    owners: author,
  })
  const res = await fetch(
    `https://api.linkedin.com/v2/organizationalEntityShareStatistics?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) return null
  const body = (await res.json()) as {
    elements?: Array<{
      totalShareStatistics?: {
        impressionCount?: number
        likeCount?: number
        commentCount?: number
        shareCount?: number
        clickCount?: number
        engagement?: number
      }
    }>
  }
  const t = body.elements?.[0]?.totalShareStatistics
  if (!t) return null
  return {
    impressions: t.impressionCount ?? null,
    likes: t.likeCount ?? null,
    comments: t.commentCount ?? null,
    shares: t.shareCount ?? null,
    clicks: t.clickCount ?? null,
    engagement: t.engagement ?? null,
    fetchedAt: new Date().toISOString(),
  }
}

export async function syncPostAnalytics(postId: string): Promise<PostAnalytics | null> {
  const post = await prisma.socialMediaPost.findUnique({
    where: { id: postId },
    include: { account: true },
  })
  if (!post || post.status !== 'PUBLISHED' || !post.platformPostId) return null

  const token = await getValidAccessToken(post.account)
  let analytics: PostAnalytics | null = null

  if (post.platform === 'TWITTER') {
    analytics = await fetchTwitterPostAnalytics(post.platformPostId, token)
  } else if (post.platform === 'LINKEDIN') {
    analytics = await fetchLinkedInPostAnalytics(post.platformPostId, token, post.account)
  }

  if (!analytics) return null

  const prev = readPublishMetrics(post.metrics)
  const metrics: PostPublishMetrics & { analytics: PostAnalytics } = {
    ...prev,
    analytics,
  }
  await prisma.socialMediaPost.update({
    where: { id: postId },
    data: { metrics },
  })
  return analytics
}

export async function syncAllPublishedPostAnalytics(limit = 30): Promise<{ synced: number; errors: string[] }> {
  const posts = await prisma.socialMediaPost.findMany({
    where: { status: 'PUBLISHED', platform: { in: ['TWITTER', 'LINKEDIN'] } },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: { id: true, platform: true },
  })
  let synced = 0
  const errors: string[] = []
  for (const p of posts) {
    try {
      const a = await syncPostAnalytics(p.id)
      if (a) synced += 1
    } catch (err) {
      errors.push(`${p.platform} ${p.id.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return { synced, errors }
}

export function getAccountStatsFromConfig(config: unknown): PlatformAccountStats | null {
  return readStoredStats(config)
}
