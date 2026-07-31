import type { ContentStatus, ContentType, SocialPlatform } from '@prisma/client'
import { prisma } from '../prisma'
import { createSocialDraftsForDerived, schedulePost } from '../pipeline'
import type { DistributionCalendar, CalendarSlot } from './distributionCalendar'
import type { AtomKind } from '../atomization/types-derivative'

export type SchedulePreviewSlot = {
  slotIndex: number
  platform: SocialPlatform
  contentKind: string
  dayOffset: number
  scheduledAt: string
  derivativeId?: string
  derivativeTitle?: string
  derivativeStatus?: ContentStatus
  existingPostId?: string
  existingPostStatus?: string
  accountReady: boolean
  schedulable: boolean
  skipReason?: string
}

export type SchedulePreview = {
  pipelineId: string
  sourceId: string
  sourceTitle: string
  distributionDays: number
  totalSlots: number
  readyCount: number
  pendingApprovalCount: number
  skippedCount: number
  slots: SchedulePreviewSlot[]
}

export type ApplyScheduleResult = {
  scheduled: number
  skipped: number
  errors: string[]
  postIds: string[]
}

const VIDEO_KINDS = new Set(['instagram_reel', 'tiktok_video', 'youtube_short', 'short_video'])

const KIND_TO_CONTENT_TYPE: Record<string, ContentType[]> = {
  twitter_post: ['SOCIAL_CAPTION'],
  linkedin_post: ['SOCIAL_CAPTION'],
  instagram_post: ['SOCIAL_CAPTION'],
  facebook_post: ['SOCIAL_CAPTION'],
  social_card: ['SOCIAL_CAPTION'],
  twitter_thread: ['TWITTER_THREAD'],
  linkedin_carousel: ['LINKEDIN_CAROUSEL'],
}

type DerivativeRow = {
  id: string
  title: string
  content: string
  contentType: ContentType
  status: ContentStatus
  metadata: Record<string, unknown> | null
  createdAt: Date
}

function readMeta(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {}
}

function poolKey(platform: string, atomKind: string): string {
  return `${platform}:${atomKind}`
}

function parseCalendar(raw: unknown): DistributionCalendar | null {
  if (!raw || typeof raw !== 'object') return null
  const cal = raw as DistributionCalendar
  if (!Array.isArray(cal.slots)) return null
  return {
    ...cal,
    slots: cal.slots.map((s) => ({
      ...s,
      scheduledAt: new Date(s.scheduledAt as unknown as string),
    })),
  }
}

function sortDerivatives(rows: DerivativeRow[]): DerivativeRow[] {
  return rows.slice().sort((a, b) => {
    const ai = Number(readMeta(a.metadata).partIndex ?? 0)
    const bi = Number(readMeta(b.metadata).partIndex ?? 0)
    if (ai !== bi) return ai - bi
    return a.createdAt.getTime() - b.createdAt.getTime()
  })
}

function buildDerivativePools(rows: DerivativeRow[]): Map<string, DerivativeRow[]> {
  const pools = new Map<string, DerivativeRow[]>()
  for (const row of sortDerivatives(rows)) {
    const meta = readMeta(row.metadata)
    const platform = String(meta.platform || '')
    const atomKind = String(meta.atomKind || '')
    if (!platform || !atomKind) continue
    const key = poolKey(platform, atomKind)
    const list = pools.get(key) || []
    list.push(row)
    pools.set(key, list)
  }
  return pools
}

function takeFromPool(pools: Map<string, DerivativeRow[]>, platform: SocialPlatform, kind: string) {
  const key = poolKey(platform, kind)
  const list = pools.get(key)
  if (!list?.length) return undefined
  return list.shift()
}

async function loadAccounts(): Promise<Map<SocialPlatform, boolean>> {
  const accounts = await prisma.socialMediaAccount.findMany({
    where: { isActive: true, accountId: { not: { startsWith: 'dryrun_' } } },
    select: { platform: true },
  })
  const map = new Map<SocialPlatform, boolean>()
  for (const a of accounts) map.set(a.platform, true)
  return map
}

function isSchedulableKind(kind: string): boolean {
  return !VIDEO_KINDS.has(kind) && Boolean(KIND_TO_CONTENT_TYPE[kind])
}

async function loadPipelineContext(pipelineId: string) {
  const pipeline = await prisma.contentPipeline.findUnique({
    where: { id: pipelineId },
    include: {
      source: {
        include: {
          derivedContents: {
            orderBy: { createdAt: 'asc' },
            include: { socialPosts: { select: { id: true, status: true, scheduledAt: true } } },
          },
        },
      },
    },
  })
  if (!pipeline) throw new Error('Pipeline not found')
  const config =
    pipeline.config && typeof pipeline.config === 'object'
      ? (pipeline.config as Record<string, unknown>)
      : {}
  const calendar = parseCalendar(config.distributionCalendar)
  if (!calendar) throw new Error('Pipeline has no distribution calendar — run pipeline first')
  return { pipeline, calendar, config }
}

function filterSchedulableDerivatives(rows: DerivativeRow[]): DerivativeRow[] {
  const allowed = new Set<ContentType>([
    'SOCIAL_CAPTION',
    'TWITTER_THREAD',
    'LINKEDIN_CAROUSEL',
  ])
  return rows.filter((r) => allowed.has(r.contentType))
}

export async function previewDistributionSchedule(
  pipelineId: string,
  options: { approvedOnly?: boolean } = {},
): Promise<SchedulePreview> {
  const approvedOnly = options.approvedOnly ?? false
  const { pipeline, calendar } = await loadPipelineContext(pipelineId)
  const accounts = await loadAccounts()

  const derivatives = filterSchedulableDerivatives(
    pipeline.source.derivedContents.map((d) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      contentType: d.contentType,
      status: d.status,
      metadata: readMeta(d.metadata),
      createdAt: d.createdAt,
    })),
  )

  const pools = buildDerivativePools(derivatives)
  const slots: SchedulePreviewSlot[] = []
  let readyCount = 0
  let pendingApprovalCount = 0
  let skippedCount = 0

  for (const slot of calendar.slots) {
    const schedulable = isSchedulableKind(slot.contentKind)
    const accountReady = accounts.has(slot.platform)
    let skipReason: string | undefined
    let derivative: DerivativeRow | undefined

    if (!schedulable) {
      skipReason = 'video script — metin paylaşımı henüz desteklenmiyor'
      skippedCount += 1
    } else {
      derivative = takeFromPool(pools, slot.platform, slot.contentKind)
      if (!derivative) {
        skipReason = 'eşleşen türev içerik yok'
        skippedCount += 1
      } else if (approvedOnly && derivative.status !== 'APPROVED' && derivative.status !== 'PUBLISHED') {
        skipReason = `onay bekliyor (${derivative.status})`
        pendingApprovalCount += 1
      } else if (!accountReady) {
        skipReason = `${slot.platform} hesabı bağlı değil`
        skippedCount += 1
      } else {
        readyCount += 1
      }
    }

    const existingPost = derivative
      ? pipeline.source.derivedContents
          .find((d) => d.id === derivative!.id)
          ?.socialPosts.find((p) => p.status === 'SCHEDULED' || p.status === 'DRAFT')
      : undefined

    const approved =
      derivative?.status === 'APPROVED' || derivative?.status === 'PUBLISHED'
    const canSchedule =
      schedulable &&
      Boolean(derivative) &&
      accountReady &&
      (!approvedOnly || approved) &&
      !skipReason

    slots.push({
      slotIndex: slot.slotIndex,
      platform: slot.platform,
      contentKind: slot.contentKind,
      dayOffset: slot.dayOffset,
      scheduledAt: slot.scheduledAt.toISOString(),
      derivativeId: derivative?.id,
      derivativeTitle: derivative?.title,
      derivativeStatus: derivative?.status,
      existingPostId: existingPost?.id,
      existingPostStatus: existingPost?.status,
      accountReady,
      schedulable: canSchedule,
      skipReason,
    })
  }

  return {
    pipelineId,
    sourceId: pipeline.sourceId,
    sourceTitle: calendar.sourceTitle || pipeline.source.title,
    distributionDays: calendar.distributionDays,
    totalSlots: calendar.totalSlots,
    readyCount,
    pendingApprovalCount,
    skippedCount,
    slots,
  }
}

export async function applyDistributionSchedule(
  pipelineId: string,
  options: { approvedOnly?: boolean; reschedule?: boolean } = {},
): Promise<ApplyScheduleResult> {
  const approvedOnly = options.approvedOnly ?? true
  const reschedule = options.reschedule ?? false
  const { config } = await loadPipelineContext(pipelineId)
  const preview = await previewDistributionSchedule(pipelineId, { approvedOnly })
  const result: ApplyScheduleResult = { scheduled: 0, skipped: 0, errors: [], postIds: [] }

  for (const slot of preview.slots) {
    if (!slot.schedulable || !slot.derivativeId) {
      result.skipped += 1
      continue
    }
    if (slot.derivativeStatus !== 'APPROVED' && slot.derivativeStatus !== 'PUBLISHED') {
      result.skipped += 1
      continue
    }
    if (slot.existingPostId && slot.existingPostStatus === 'SCHEDULED' && !reschedule) {
      result.skipped += 1
      continue
    }

    try {
      const derived = await prisma.derivedContent.findUnique({ where: { id: slot.derivativeId } })
      if (!derived) {
        result.skipped += 1
        continue
      }

      let postId = slot.existingPostId
      if (!postId) {
        const drafts = await createSocialDraftsForDerived(derived.id, derived.content)
        if (!drafts.length) {
          result.errors.push(`Slot ${slot.slotIndex}: draft oluşturulamadı (${slot.platform})`)
          result.skipped += 1
          continue
        }
        postId = drafts.find((p) => p.platform === slot.platform)?.id || drafts[0].id
      }

      const when = new Date(slot.scheduledAt)
      if (when.getTime() <= Date.now()) {
        result.errors.push(`Slot ${slot.slotIndex}: geçmiş tarih atlandı`)
        result.skipped += 1
        continue
      }

      await schedulePost(postId, when)
      result.scheduled += 1
      result.postIds.push(postId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`Slot ${slot.slotIndex}: ${msg}`)
      result.skipped += 1
    }
  }

  await prisma.contentPipeline.update({
    where: { id: pipelineId },
    data: {
      config: {
        ...config,
        distributionAppliedAt: new Date().toISOString(),
        distributionScheduledCount: result.scheduled,
      },
    },
  })

  return result
}

/** Rebuild calendar from stored atomization plan (e.g. after plan tweak). */
export function calendarSlotLabel(slot: CalendarSlot): string {
  return `${slot.platform} · ${slot.contentKind} · gün +${slot.dayOffset}`
}

export { parseCalendar }
