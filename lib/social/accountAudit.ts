import type { SocialPlatform } from '@prisma/client'
import { prisma } from '../prisma'
import { oauthPlatformStatus } from './config'
import { upsertDryRunAccount } from './oauth'

/** Platforms that produce drafts and can publish in Faz 1. */
export const PUBLISH_PLATFORMS: SocialPlatform[] = ['TWITTER', 'LINKEDIN']

/** Pipeline-only platforms — dry-run for draft/calendar infra until OAuth (Faz 2). */
export const FAZ2_DRY_RUN_PLATFORMS: SocialPlatform[] = ['YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK']

export type AccountSlotStatus = 'ok' | 'missing' | 'dry_run' | 'expired' | 'oauth_ok' | 'failed_posts'

export type AccountSlot = {
  platform: SocialPlatform
  label: string
  status: AccountSlotStatus
  accountName?: string
  dbAccountId?: string
  isOAuth: boolean
  oauthConfigured: boolean
  failedPosts: number
  detail: string
}

export type AccountAudit = {
  slots: AccountSlot[]
  missingCount: number
  brokenCount: number
  repaired: string[]
}

function platformLabel(platform: SocialPlatform): string {
  return platform === 'TWITTER' ? 'X' : platform === 'LINKEDIN' ? 'LinkedIn' : platform
}

export async function auditSocialAccounts(): Promise<AccountAudit> {
  const oauth = oauthPlatformStatus()
  const accounts = await prisma.$queryRaw<
    Array<{
      id: string
      platform: SocialPlatform
      accountName: string
      accountId: string
      tokenExpiry: Date | null
      dryRun: boolean
      oauth: boolean
      hasRefreshToken: boolean
    }>
  >`
    SELECT
      id,
      platform,
      "accountName",
      "accountId",
      "tokenExpiry",
      (
        COALESCE(config->>'dryRun', 'false') IN ('true', 't', '1')
        OR "accountId" LIKE 'dryrun_%'
      ) AS "dryRun",
      COALESCE(config->>'oauth', 'false') IN ('true', 't', '1') AS oauth,
      ("refreshToken" IS NOT NULL AND length("refreshToken") > 0) AS "hasRefreshToken"
    FROM "SocialMediaAccount"
    WHERE platform IN ('TWITTER', 'LINKEDIN') AND "isActive" = true
    ORDER BY "updatedAt" DESC
  `

  const failedByAccount = await prisma.socialMediaPost.groupBy({
    by: ['accountId'],
    where: { status: 'FAILED' },
    _count: { _all: true },
  })
  const failedMap = new Map(failedByAccount.map((r) => [r.accountId, r._count._all]))

  const slots: AccountSlot[] = []
  let missingCount = 0
  let brokenCount = 0

  for (const platform of PUBLISH_PLATFORMS) {
    const oauthConfigured =
      platform === 'TWITTER' ? oauth.twitter.configured : oauth.linkedin.configured
    const platformAccounts = accounts.filter((a) => a.platform === platform)
    const real = platformAccounts.find((a) => !a.dryRun)
    const dry = platformAccounts.find((a) => a.dryRun)
    const active = real || dry

    if (!active) {
      missingCount += 1
      slots.push({
        platform,
        label: platformLabel(platform),
        status: 'missing',
        isOAuth: false,
        oauthConfigured,
        failedPosts: 0,
        detail: oauthConfigured ? 'OAuth veya dry-run bağla' : 'Dry-run önerilir (env yok)',
      })
      continue
    }

    const failedPosts = failedMap.get(active.id) ?? 0
    const dryRun = active.dryRun
    const oauthAccount = active.oauth || (!dryRun && active.hasRefreshToken)

    let status: AccountSlotStatus = 'ok'
    let detail = active.accountName

    if (dryRun) {
      status = 'dry_run'
      detail = `${active.accountName} — gerçek SM’de görünmez`
    } else if (
      active.tokenExpiry &&
      active.tokenExpiry.getTime() < Date.now() + 120_000 &&
      !oauthAccount
    ) {
      status = 'expired'
      brokenCount += 1
      detail = 'Token süresi doldu — yeniden OAuth'
    } else if (oauthAccount) {
      status = 'oauth_ok'
      detail = `${active.accountName} · OAuth bağlı`
    }

    if (failedPosts > 0) {
      if (status === 'ok' || status === 'oauth_ok') status = 'failed_posts'
      brokenCount += 1
      detail += ` · ${failedPosts} başarısız post`
    }

    slots.push({
      platform,
      label: platformLabel(platform),
      status,
      accountName: active.accountName,
      dbAccountId: active.id,
      isOAuth: Boolean(oauthAccount && !dryRun),
      oauthConfigured,
      failedPosts,
      detail,
    })
  }

  return { slots, missingCount, brokenCount, repaired: [] }
}

/** Create dry-run accounts only when OAuth env is missing; otherwise use OAuth connect. */
export async function repairMissingSocialAccounts(): Promise<AccountAudit> {
  const audit = await auditSocialAccounts()
  const oauth = oauthPlatformStatus()
  const repaired: string[] = []

  for (const slot of audit.slots) {
    if (slot.status !== 'missing') continue
    const oauthConfigured =
      slot.platform === 'TWITTER' ? oauth.twitter.configured : oauth.linkedin.configured
    if (oauthConfigured) continue
    await upsertDryRunAccount(slot.platform, `Dry-run ${slot.platform}`)
    repaired.push(slot.platform)
  }

  const faz2 = await bootstrapFaz2DryRunAccounts()
  repaired.push(...faz2)

  if (repaired.length) {
    const { syncSocialDraftsFromApprovedCaptions } = await import('../pipeline')
    await syncSocialDraftsFromApprovedCaptions()
  }

  const refreshed = await auditSocialAccounts()
  return { ...refreshed, repaired }
}

/** Ensure YouTube/Instagram/TikTok/Facebook dry-run slots exist for pipeline captions. */
export async function bootstrapFaz2DryRunAccounts(): Promise<string[]> {
  const repaired: string[] = []
  for (const platform of FAZ2_DRY_RUN_PLATFORMS) {
    const existing = await prisma.socialMediaAccount.findFirst({
      where: { platform, isActive: true },
      select: { id: true },
    })
    if (existing) continue
    await upsertDryRunAccount(platform, `Dry-run ${platform}`)
    repaired.push(platform)
  }
  return repaired
}
