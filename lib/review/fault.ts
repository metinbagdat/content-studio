import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { readReviewFault, parseBulkErrorLine, type ReviewFaultInfo } from './faultMeta'

export { readReviewFault, VIDEO_FAULT_TYPES, parseBulkErrorLine, isStorageOrVideoFault, type ReviewFaultInfo } from './faultMeta'

export function faultMessageFromBulkError(line: string): { id: string; message: string } | null {
  return parseBulkErrorLine(line)
}

function mergeFaultMetadata(
  metadata: Prisma.JsonValue | null | undefined,
  message: string,
): Prisma.InputJsonValue {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {}
  const prev = Array.isArray(base.reviewFaults) ? [...base.reviewFaults] : []
  prev.push({ at: new Date().toISOString(), message })
  return {
    ...base,
    reviewFault: true,
    reviewFaultLast: message,
    reviewFaults: prev.slice(-20),
  } as Prisma.InputJsonValue
}

export async function reopenReviewWithFault(derivedId: string, message: string): Promise<void> {
  await prisma.derivedContent.update({
    where: { id: derivedId },
    data: {
      status: 'IN_REVIEW',
      approvedAt: null,
      metadata: mergeFaultMetadata(
        (
          await prisma.derivedContent.findUnique({
            where: { id: derivedId },
            select: { metadata: true },
          })
        )?.metadata,
        message,
      ),
    },
  })
}

export async function markReviewFault(derivedId: string, message: string): Promise<void> {
  const row = await prisma.derivedContent.findUnique({
    where: { id: derivedId },
    select: { metadata: true },
  })
  if (!row) return
  await prisma.derivedContent.update({
    where: { id: derivedId },
    data: { metadata: mergeFaultMetadata(row.metadata, message) },
  })
}

export async function clearReviewFault(derivedId: string): Promise<void> {
  const row = await prisma.derivedContent.findUnique({
    where: { id: derivedId },
    select: { metadata: true },
  })
  if (!row) return
  const base =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? { ...(row.metadata as Record<string, unknown>) }
      : {}
  delete base.reviewFault
  delete base.reviewFaultLast
  delete base.reviewFaults
  await prisma.derivedContent.update({
    where: { id: derivedId },
    data: { metadata: base as Prisma.InputJsonValue },
  })
}

/** Prod'da video üretilemeyen IN_REVIEW kayıtları arı kuyruğuna al (toplu onaya girmez). */
export async function quarantineVideoScripts(reason: string): Promise<number> {
  const rows = await prisma.derivedContent.findMany({
    where: {
      status: 'IN_REVIEW',
      contentType: { in: ['VIDEO_SCRIPT', 'SHORT_VIDEO_SCRIPT'] },
    },
    select: { id: true, metadata: true },
  })
  let n = 0
  for (const row of rows) {
    if (readReviewFault(row.metadata).fault) continue
    await markReviewFault(row.id, reason)
    n += 1
  }
  return n
}

/** Seçili veya listelenen IN_REVIEW kayıtlarını arı kuyruğuna al. */
export async function quarantineByIds(ids: string[], reason: string): Promise<number> {
  let n = 0
  for (const id of ids) {
    const row = await prisma.derivedContent.findUnique({
      where: { id },
      select: { status: true, metadata: true },
    })
    if (!row || row.status !== 'IN_REVIEW') continue
    if (readReviewFault(row.metadata).fault) continue
    await markReviewFault(id, reason)
    n += 1
  }
  return n
}
