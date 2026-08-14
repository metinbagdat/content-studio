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
  const [captionGroups, accounts, postGroups] = await Promise.all([
    prisma.derivedContent.groupBy({
      by: ['contentType'],
      where: {
        contentType: { in: ['SOCIAL_CAPTION', 'TWITTER_THREAD', 'LINKEDIN_CAROUSEL'] },
        status: { in: ['APPROVED', 'PUBLISHED'] },
      },
      _count: { _all: true },
    }),
    prisma.socialMediaAccount.findMany({ where: { isActive: true }, select: { platform: true } }),
    prisma.socialMediaPost.groupBy({
      by: ['platform', 'status'],
      _count: { _all: true },
    }),
  ])

  const accountPlatforms = new Set(accounts.map((a) => a.platform as string))

  const approvedByPlatform = new Map<string, number>()
  let totalApprovedCaptions = 0
  for (const c of captionGroups) {
    const platform = platformOfCaption(null, c.contentType)
    const n = c._count._all
    totalApprovedCaptions += n
    approvedByPlatform.set(platform, (approvedByPlatform.get(platform) || 0) + n)
  }

  const draftByPlatform = new Map<string, number>()
  const publishedByPlatform = new Map<string, number>()
  const failedByPlatform = new Map<string, number>()
  let totalDrafts = 0
  let totalPublished = 0
  let totalFailed = 0
  for (const p of postGroups) {
    const n = p._count._all
    if (p.status === 'PUBLISHED') {
      publishedByPlatform.set(p.platform, (publishedByPlatform.get(p.platform) || 0) + n)
      totalPublished += n
    } else if (p.status === 'FAILED') {
      failedByPlatform.set(p.platform, (failedByPlatform.get(p.platform) || 0) + n)
      totalFailed += n
    } else {
      draftByPlatform.set(p.platform, (draftByPlatform.get(p.platform) || 0) + n)
      totalDrafts += n
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
      reason = hasAccount
        ? 'Dry-run taslak oluşur ama gerçek yayın API\'si yok (Faz 2) — publish denemesi hata verir'
        : 'Hesap yok — Faz 2\'ye kadar sadece dry-run altyapı testi mümkün'
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

  return {
    totalApprovedCaptions,
    totalDrafts,
    totalPublished,
    totalFailed,
    unsupportedApprovedCount,
    breakdown,
  }
}

export type { SocialPlatform }
