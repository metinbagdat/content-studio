import type { ReviewBulkAction, ReviewBulkJob, ReviewBulkStatus } from '@prisma/client'
import { prisma } from '../prisma'
import { bulkSetDerivedStatus } from '../pipeline'

export type ReviewBulkJobPublic = {
  id: string
  action: ReviewBulkAction
  status: ReviewBulkStatus
  itemIds: string[]
  cursor: number
  total: number
  autoMedia: boolean
  autoWpDraft: boolean
  scopeFilter: string
  errors: string[]
  approvedCount: number
  rejectedCount: number
  draftsCount: number
  mediaCount: number
  wpDraftCount: number
  currentLabel: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export function reviewBulkChunkSize(
  action: ReviewBulkAction,
  autoMedia: boolean,
  autoWpDraft: boolean,
): number {
  if (action === 'REJECT') return 15
  if (autoMedia || autoWpDraft) return 1
  return 10
}

export function toPublicBulkJob(job: ReviewBulkJob): ReviewBulkJobPublic {
  return {
    id: job.id,
    action: job.action,
    status: job.status,
    itemIds: job.itemIds,
    cursor: job.cursor,
    total: job.itemIds.length,
    autoMedia: job.autoMedia,
    autoWpDraft: job.autoWpDraft,
    scopeFilter: job.scopeFilter,
    errors: job.errors,
    approvedCount: job.approvedCount,
    rejectedCount: job.rejectedCount,
    draftsCount: job.draftsCount,
    mediaCount: job.mediaCount,
    wpDraftCount: job.wpDraftCount,
    currentLabel: job.currentLabel,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  }
}

export async function createReviewBulkJob(input: {
  action: ReviewBulkAction
  itemIds: string[]
  autoMedia?: boolean
  autoWpDraft?: boolean
  scopeFilter?: string
}): Promise<ReviewBulkJob> {
  const itemIds = [...new Set(input.itemIds.map(String).filter(Boolean))]
  if (!itemIds.length) throw new Error('itemIds required')

  await prisma.reviewBulkJob.updateMany({
    where: { status: { in: ['PENDING', 'RUNNING'] } },
    data: { status: 'PAUSED' },
  })

  return prisma.reviewBulkJob.create({
    data: {
      action: input.action,
      status: 'PENDING',
      itemIds,
      cursor: 0,
      autoMedia: Boolean(input.autoMedia),
      autoWpDraft: input.action === 'APPROVE' && Boolean(input.autoWpDraft),
      scopeFilter: input.scopeFilter || 'ALL',
    },
  })
}

export async function getReviewBulkJob(id: string): Promise<ReviewBulkJob | null> {
  return prisma.reviewBulkJob.findUnique({ where: { id } })
}

export async function getActiveReviewBulkJob(): Promise<ReviewBulkJob | null> {
  return prisma.reviewBulkJob.findFirst({
    where: { status: { in: ['PENDING', 'RUNNING', 'PAUSED'] } },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function pauseReviewBulkJob(id: string): Promise<ReviewBulkJob> {
  return prisma.reviewBulkJob.update({
    where: { id },
    data: { status: 'PAUSED' },
  })
}

export async function cancelReviewBulkJob(id: string): Promise<ReviewBulkJob> {
  return prisma.reviewBulkJob.update({
    where: { id },
    data: { status: 'CANCELLED', completedAt: new Date(), currentLabel: null },
  })
}

export async function resumeReviewBulkJob(id: string): Promise<ReviewBulkJob> {
  const job = await prisma.reviewBulkJob.findUnique({ where: { id } })
  if (!job) throw new Error('job not found')
  if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
    throw new Error(`job already ${job.status}`)
  }
  return prisma.reviewBulkJob.update({
    where: { id },
    data: {
      status: 'RUNNING',
      startedAt: job.startedAt ?? new Date(),
    },
  })
}

export async function tickReviewBulkJob(id: string): Promise<{
  job: ReviewBulkJob
  done: boolean
}> {
  const job = await prisma.reviewBulkJob.findUnique({ where: { id } })
  if (!job) throw new Error('job not found')
  if (job.status === 'CANCELLED' || job.status === 'COMPLETED') {
    return { job, done: true }
  }
  if (job.status === 'PAUSED') {
    return { job, done: false }
  }

  if (job.cursor >= job.itemIds.length) {
    const finished = await prisma.reviewBulkJob.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date(), currentLabel: null },
    })
    return { job: finished, done: true }
  }

  const chunkSize = reviewBulkChunkSize(job.action, job.autoMedia, job.autoWpDraft)
  const chunk = job.itemIds.slice(job.cursor, job.cursor + chunkSize)
  const labelId = chunk[0]
  const labelRow = labelId
    ? await prisma.derivedContent.findUnique({
        where: { id: labelId },
        select: { title: true },
      })
    : null
  const currentLabel =
    labelRow?.title?.slice(0, 80) || `öğe ${job.cursor + 1}/${job.itemIds.length}`

  await prisma.reviewBulkJob.update({
    where: { id },
    data: {
      status: 'RUNNING',
      startedAt: job.startedAt ?? new Date(),
      currentLabel,
    },
  })

  const derivedStatus = job.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
  let chunkResult: Awaited<ReturnType<typeof bulkSetDerivedStatus>>
  try {
    chunkResult = await bulkSetDerivedStatus(chunk, derivedStatus, {
      autoMedia: job.action === 'APPROVE' && job.autoMedia,
      autoWpDraft: job.action === 'APPROVE' && job.autoWpDraft,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const failed = await prisma.reviewBulkJob.update({
      where: { id },
      data: {
        status: 'PAUSED',
        errors: [...job.errors, `${currentLabel}: ${msg}`].slice(-200),
        currentLabel,
      },
    })
    return { job: failed, done: false }
  }

  const nextCursor = job.cursor + chunk.length
  const done = nextCursor >= job.itemIds.length
  const updated = await prisma.reviewBulkJob.update({
    where: { id },
    data: {
      cursor: nextCursor,
      approvedCount: job.approvedCount + (chunkResult.approved || 0),
      rejectedCount: job.rejectedCount + (chunkResult.rejected || 0),
      draftsCount: job.draftsCount + (chunkResult.draftsCreated || 0),
      mediaCount: job.mediaCount + (chunkResult.mediaGenerated || 0),
      wpDraftCount: job.wpDraftCount + (chunkResult.wpDraftsSent || 0),
      errors: chunkResult.errors.length
        ? [...job.errors, ...chunkResult.errors].slice(-200)
        : job.errors,
      currentLabel: done ? null : currentLabel,
      status: done ? 'COMPLETED' : 'RUNNING',
      completedAt: done ? new Date() : null,
    },
  })

  return { job: updated, done }
}
