import { Prisma, type SocialMediaAccount, type SocialPlatform } from '@prisma/client'
import { prisma } from '../prisma'
import { linkedinAuthorUrn } from './config'
import { getValidAccessToken } from './tokenRefresh'
import { readPublishMetrics, type PostPublishMetrics } from './publishFingerprint'
import { metaGraphVersion } from './metaApi'

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

type DbPublishedAggregate = {
  postsCount: number
  impressions: number
  likes: number
  comments: number
  shares: number
  clicks: number
}

async function aggregateDbPublishedMetrics(
  accountId: string,
  platform: SocialPlatform,
): Promise<DbPublishedAggregate> {
  const published = await prisma.socialMediaPost.findMany({
    where: { accountId, status: 'PUBLISHED', platform },
    select: { metrics: true },
    take: 500,
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
    postsCount: published.length,
    impressions,
    likes,
    comments,
    shares,
    clicks,
  }
}

function dryRunStats(account: SocialMediaAccount, error = 'Dry-run — gerçek istatistik yok'): PlatformAccountStats {
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
    error,
  }
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
    return dryRunStats(account)
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
    return dryRunStats(account)
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

  const db = await aggregateDbPublishedMetrics(account.id, 'LINKEDIN')

  return {
    username,
    displayName: account.accountName,
    profileUrl,
    followers,
    following: null,
    postsCount: db.postsCount || null,
    impressions: db.impressions || null,
    engagement: db.likes + db.comments + db.shares + db.clicks || null,
    likes: db.likes || null,
    comments: db.comments || null,
    shares: db.shares || null,
    clicks: db.clicks || null,
    fetchedAt: new Date().toISOString(),
  }
}

async function fetchYouTubeAccountStats(
  account: SocialMediaAccount,
  accessToken: string,
): Promise<PlatformAccountStats> {
  if (accessToken === 'dry-run' || isDryRun(account)) {
    return dryRunStats(account)
  }

  const cfg = cfgOf(account.config)
  const channelId = String(cfg.channelId || account.accountId)
  const db = await aggregateDbPublishedMetrics(account.id, 'YOUTUBE')

  let followers: number | null = null
  let impressions: number | null = db.impressions || null
  let profileUrl: string | null = null
  let username: string | null = account.accountName
  let displayName = account.accountName
  let apiPostsCount: number | null = null
  let error: string | undefined

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(channelId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!res.ok) {
      error = `YouTube API ${res.status}`
    } else {
      const json = (await res.json()) as {
        items?: Array<{
          snippet?: { title?: string; customUrl?: string }
          statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string }
        }>
      }
      const item = json.items?.[0]
      const stats = item?.statistics
      followers = stats?.subscriberCount ? Number(stats.subscriberCount) : null
      impressions = stats?.viewCount ? Number(stats.viewCount) : impressions
      apiPostsCount = stats?.videoCount ? Number(stats.videoCount) : null
      displayName = item?.snippet?.title || displayName
      const customUrl = item?.snippet?.customUrl
      username = customUrl || `@${displayName}`
      profileUrl = customUrl
        ? `https://www.youtube.com/${customUrl.replace(/^@/, '')}`
        : `https://www.youtube.com/channel/${channelId}`
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }

  return {
    username,
    displayName,
    profileUrl,
    followers,
    following: null,
    postsCount: db.postsCount || apiPostsCount,
    impressions,
    engagement: db.likes + db.comments + db.shares || null,
    likes: db.likes || null,
    comments: db.comments || null,
    shares: db.shares || null,
    clicks: db.clicks || null,
    fetchedAt: new Date().toISOString(),
    error,
  }
}

async function fetchMetaPageStats(
  account: SocialMediaAccount,
  accessToken: string,
  platform: 'FACEBOOK' | 'INSTAGRAM',
): Promise<PlatformAccountStats> {
  if (accessToken === 'dry-run' || isDryRun(account)) {
    return dryRunStats(account)
  }

  const cfg = cfgOf(account.config)
  const db = await aggregateDbPublishedMetrics(account.id, platform)
  const graphVersion = process.env.META_GRAPH_VERSION?.trim() || 'v21.0'

  let followers: number | null = null
  let apiPostsCount: number | null = null
  let username: string | null = account.accountName
  let displayName = account.accountName
  let profileUrl: string | null = null
  let error: string | undefined

  try {
    const entityId =
      platform === 'FACEBOOK'
        ? String(cfg.pageId || account.accountId)
        : String(cfg.igUserId || account.accountId)
    const fields =
      platform === 'FACEBOOK'
        ? 'name,followers_count,fan_count,published_posts.limit(0).summary(total_count)'
        : 'username,name,followers_count,media_count'

    const url = new URL(`https://graph.facebook.com/${graphVersion}/${entityId}`)
    url.searchParams.set('fields', fields)
    url.searchParams.set('access_token', accessToken)

    const res = await fetch(url.toString())
    if (!res.ok) {
      const body = await res.text()
      error = `Meta Graph ${res.status}: ${body.slice(0, 200)}`
    } else {
      const json = (await res.json()) as {
        name?: string
        username?: string
        followers_count?: number
        fan_count?: number
        media_count?: number
        published_posts?: { summary?: { total_count?: number } }
      }
      followers = json.followers_count ?? json.fan_count ?? null
      displayName = json.name || displayName
      if (platform === 'INSTAGRAM') {
        username = json.username ? `@${json.username}` : username
        apiPostsCount = json.media_count ?? null
        profileUrl = json.username ? `https://www.instagram.com/${json.username}/` : null
      } else {
        username = displayName
        apiPostsCount = json.published_posts?.summary?.total_count ?? null
        profileUrl = `https://www.facebook.com/${entityId}`
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }

  return {
    username,
    displayName,
    profileUrl,
    followers,
    following: null,
    postsCount: db.postsCount || apiPostsCount,
    impressions: db.impressions || null,
    engagement: db.likes + db.comments + db.shares + db.clicks || null,
    likes: db.likes || null,
    comments: db.comments || null,
    shares: db.shares || null,
    clicks: db.clicks || null,
    fetchedAt: new Date().toISOString(),
    error,
  }
}

export async function fetchAccountStats(account: SocialMediaAccount): Promise<PlatformAccountStats> {
  const token = await getValidAccessToken(account)
  if (account.platform === 'TWITTER') return fetchTwitterAccountStats(account, token)
  if (account.platform === 'LINKEDIN') return fetchLinkedInAccountStats(account, token)
  if (account.platform === 'YOUTUBE') return fetchYouTubeAccountStats(account, token)
  if (account.platform === 'FACEBOOK') return fetchMetaPageStats(account, token, 'FACEBOOK')
  if (account.platform === 'INSTAGRAM') return fetchMetaPageStats(account, token, 'INSTAGRAM')
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
  if (!account.isActive) throw new Error('Account inactive')
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

/** Prefer real OAuth account over dry-run when multiple active rows exist. */
export function pickPreferredAccount<T extends { accountId: string; config: unknown }>(
  accounts: T[],
): T | undefined {
  const active = accounts.filter((a) => !a.accountId.startsWith('dryrun_'))
  if (active.length) {
    const oauth = active.find((a) => Boolean(cfgOf(a.config).oauth))
    return oauth || active[0]
  }
  return accounts[0]
}

export async function syncAllAccountStats(): Promise<{ synced: number; errors: string[] }> {
  const accounts = await prisma.socialMediaAccount.findMany({
    where: { isActive: true, platform: { in: ['TWITTER', 'LINKEDIN', 'YOUTUBE', 'FACEBOOK', 'INSTAGRAM'] } },
  })
  const byPlatform = new Map<SocialPlatform, SocialMediaAccount[]>()
  for (const account of accounts) {
    const list = byPlatform.get(account.platform) || []
    list.push(account)
    byPlatform.set(account.platform, list)
  }
  const toSync = [...byPlatform.values()]
    .map((list) => pickPreferredAccount(list))
    .filter((a): a is SocialMediaAccount => Boolean(a))
  let synced = 0
  const errors: string[] = []
  for (const account of toSync) {
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

async function fetchFacebookPostAnalytics(
  platformPostId: string,
  accessToken: string,
): Promise<PostAnalytics | null> {
  if (!platformPostId || platformPostId.startsWith('mock_') || accessToken === 'dry-run') return null
  const url = new URL(`https://graph.facebook.com/${metaGraphVersion()}/${platformPostId}`)
  url.searchParams.set('fields', 'shares,reactions.summary(true),comments.summary(true)')
  url.searchParams.set('access_token', accessToken)
  const res = await fetch(url.toString())
  if (!res.ok) return null
  const body = (await res.json()) as {
    shares?: { count?: number }
    reactions?: { summary?: { total_count?: number } }
    comments?: { summary?: { total_count?: number } }
  }
  const likes = body.reactions?.summary?.total_count ?? 0
  const comments = body.comments?.summary?.total_count ?? 0
  const shares = body.shares?.count ?? 0
  return {
    impressions: null,
    likes,
    comments,
    shares,
    clicks: null,
    engagement: likes + comments + shares,
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
  } else if (post.platform === 'FACEBOOK') {
    analytics = await fetchFacebookPostAnalytics(post.platformPostId, token)
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
    where: { status: 'PUBLISHED', platform: { in: ['TWITTER', 'LINKEDIN', 'FACEBOOK'] } },
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

export type TopPerformingPost = {
  id: string
  platform: string
  postContent: string
  publishedAt: string
  platformPostId: string | null
  engagement: number
  impressions: number | null
  likes: number | null
  comments: number | null
  shares: number | null
}

/** Best published posts by stored engagement — CS-08 leaderboard. */
export async function getTopPerformingPosts(limit = 5): Promise<TopPerformingPost[]> {
  const posts = await prisma.socialMediaPost.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      platform: true,
      publishedAt: true,
      createdAt: true,
      platformPostId: true,
      metrics: true,
    },
  })

  const withAnalytics = posts
    .map((p) => {
      const analytics = readPostAnalytics(p.metrics)
      return { post: p, analytics }
    })
    .filter((x): x is { post: (typeof posts)[number]; analytics: PostAnalytics } => Boolean(x.analytics))

  withAnalytics.sort((a, b) => (b.analytics.engagement ?? 0) - (a.analytics.engagement ?? 0))
  const top = withAnalytics.slice(0, limit)
  const previewById = new Map<string, string>()
  if (top.length) {
    const previewRows = await prisma.$queryRaw<Array<{ id: string; preview: string | null }>>`
      SELECT id, LEFT("postContent", 160) AS preview
      FROM "SocialMediaPost"
      WHERE id IN (${Prisma.join(top.map((t) => Prisma.sql`${t.post.id}`))})
    `
    for (const r of previewRows) previewById.set(r.id, r.preview || '')
  }

  return top.map(({ post, analytics }) => ({
    id: post.id,
    platform: post.platform,
    postContent: previewById.get(post.id) || '',
    publishedAt: (post.publishedAt || post.createdAt).toISOString(),
    platformPostId: post.platformPostId,
    engagement: analytics.engagement ?? 0,
    impressions: analytics.impressions ?? null,
    likes: analytics.likes ?? null,
    comments: analytics.comments ?? null,
    shares: analytics.shares ?? null,
  }))
}

export function getAccountStatsFromConfig(config: unknown): PlatformAccountStats | null {
  return readStoredStats(config)
}
