import type { SocialPlatform } from '@prisma/client'
import { prisma } from '../prisma'
import { PUBLISH_PLATFORMS } from './accountAudit'

export type CaptionPlatformBreakdown = {
  platform: string
  approvedCount: number
  draftCount: number
  publishedCount: number
  failedCount: number
  hasAccount: boolean
  isPublishable: boolean
  reason: string
}

export type DraftDiagnostics = {
  totalApprovedCaptions: number
  totalDrafts: number
  totalPublished: number
  totalFailed: number
  unsupportedApprovedCount: number
  breakdown: CaptionPlatformBreakdown[]
}

const DUAL_TARGET_LABEL = 'TWITTER + LINKEDIN (genel)'

function platformOfCaption(metadata: unknown, contentType: string): string {
  const meta = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {}
  if (typeof meta.platform === 'string' && meta.platform) return meta.platform
  if (contentType === 'TWITTER_THREAD') return 'TWITTER'
  if (contentType === 'LINKEDIN_CAROUSEL') return 'LINKEDIN'
  return DUAL_TARGET_LABEL
}

/** Explains why approved captions do or don't become draft/published posts. */
export async function getDraftDiagnostics(): Promise<DraftDiagnostics> {
  const [captions, accounts, posts] = await Promise.all([
    prisma.derivedContent.findMany({
      where: {
        contentType: { in: ['SOCIAL_CAPTION', 'TWITTER_THREAD', 'LINKEDIN_CAROUSEL'] },
        status: { in: ['APPROVED', 'PUBLISHED'] },
      },
      select: { contentType: true, metadata: true },
    }),
    prisma.socialMediaAccount.findMany({ where: { isActive: true }, select: { platform: true } }),
    prisma.socialMediaPost.findMany({ select: { platform: true, status: true } }),
  ])

  const accountPlatforms = new Set(accounts.map((a) => a.platform as string))

  const approvedByPlatform = new Map<string, number>()
  for (const c of captions) {
    const platform = platformOfCaption(c.metadata, c.contentType)
    approvedByPlatform.set(platform, (approvedByPlatform.get(platform) || 0) + 1)
  }

  const draftByPlatform = new Map<string, number>()
  const publishedByPlatform = new Map<string, number>()
  const failedByPlatform = new Map<string, number>()
  for (const p of posts) {
    if (p.status === 'PUBLISHED') {
      publishedByPlatform.set(p.platform, (publishedByPlatform.get(p.platform) || 0) + 1)
    } else if (p.status === 'FAILED') {
      failedByPlatform.set(p.platform, (failedByPlatform.get(p.platform) || 0) + 1)
    } else {
      draftByPlatform.set(p.platform, (draftByPlatform.get(p.platform) || 0) + 1)
    }
  }

  const breakdown: CaptionPlatformBreakdown[] = []
  let unsupportedApprovedCount = 0

  for (const [platform, approvedCount] of approvedByPlatform.entries()) {
    if (platform === DUAL_TARGET_LABEL) {
      breakdown.push({
        platform: DUAL_TARGET_LABEL,
        approvedCount,
        draftCount: 0,
        publishedCount: 0,
        failedCount: 0,
        hasAccount: accountPlatforms.has('TWITTER') || accountPlatforms.has('LINKEDIN'),
        isPublishable: true,
        reason: 'Platform etiketi yok — hem X hem LinkedIn hesabına taslak dener',
      })
      continue
    }

    const isPublishable = (PUBLISH_PLATFORMS as string[]).includes(platform)
    const hasAccount = accountPlatforms.has(platform)
    if (!isPublishable) unsupportedApprovedCount += approvedCount

    let reason: string
    if (!isPublishable) {
      reason = 'Faz 1 yayın API yok (sadece X + LinkedIn) — bu platform için taslak/post oluşmaz'
    } else if (!hasAccount) {
      reason = 'Hesap bağlı değil — OAuth veya dry-run bağlanınca taslak oluşur'
    } else if ((draftByPlatform.get(platform) || 0) + (publishedByPlatform.get(platform) || 0) === 0) {
      reason = 'Hesap var ama taslak yok — "Taslakları senkronize et" ile oluştur'
    } else if ((publishedByPlatform.get(platform) || 0) === 0) {
      reason = 'Taslak var, henüz yayınlanmadı — "Şimdi yayınla" veya toplu yayınla'
    } else {
      reason = 'Yayında'
    }

    breakdown.push({
      platform,
      approvedCount,
      draftCount: draftByPlatform.get(platform) || 0,
      publishedCount: publishedByPlatform.get(platform) || 0,
      failedCount: failedByPlatform.get(platform) || 0,
      hasAccount,
      isPublishable,
      reason,
    })
  }

  breakdown.sort((a, b) => b.approvedCount - a.approvedCount)

  const totalDrafts = posts.filter((p) => p.status !== 'PUBLISHED' && p.status !== 'FAILED').length
  const totalPublished = posts.filter((p) => p.status === 'PUBLISHED').length
  const totalFailed = posts.filter((p) => p.status === 'FAILED').length

  return {
    totalApprovedCaptions: captions.length,
    totalDrafts,
    totalPublished,
    totalFailed,
    unsupportedApprovedCount,
    breakdown,
  }
}

export type { SocialPlatform }
