import { ContentStatus, ContentType, type Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { setDerivedStatus } from './pipeline'

const EDITABLE_STATUSES: ContentStatus[] = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED']

export type UpdateDerivedInput = {
  title?: string
  content?: string
  metadata?: Prisma.InputJsonValue
  reviewNote?: string
  /** Force status; use reopen=true shortcut from UI */
  status?: Extract<ContentStatus, 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'DRAFT'>
  reopen?: boolean
}

function appendEditHistory(
  metadata: Prisma.JsonValue | null | undefined,
  note: string,
): Prisma.InputJsonValue {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {}
  const history = Array.isArray(base.editHistory) ? [...base.editHistory] : []
  history.push({ at: new Date().toISOString(), note })
  return { ...base, editHistory: history } as Prisma.InputJsonValue
}

export async function getDerivedContent(id: string) {
  return prisma.derivedContent.findUnique({
    where: { id },
    include: { source: { select: { id: true, title: true } }, socialPosts: { select: { id: true, status: true } } },
  })
}

export async function updateDerivedContent(id: string, input: UpdateDerivedInput) {
  const existing = await prisma.derivedContent.findUnique({ where: { id } })
  if (!existing) throw new Error('Derived content not found')
  if (existing.status === 'PUBLISHED' && !input.reopen) {
    throw new Error('Yayınlanmış içerik düzenlenemez — önce tekrar incelemeye al')
  }

  const title = input.title !== undefined ? String(input.title).trim() : undefined
  const content = input.content !== undefined ? String(input.content).trim() : undefined
  if (title !== undefined && !title) throw new Error('title cannot be empty')
  if (content !== undefined && !content) throw new Error('content cannot be empty')

  const contentChanged =
    (title !== undefined && title !== existing.title) ||
    (content !== undefined && content !== existing.content)

  let nextStatus = input.status
  if (input.reopen) nextStatus = 'IN_REVIEW'
  else if (
    contentChanged &&
    (existing.status === 'APPROVED' || existing.status === 'REJECTED')
  ) {
    nextStatus = 'IN_REVIEW'
  }

  let metadata = existing.metadata as Prisma.InputJsonValue | undefined
  if (input.metadata !== undefined) metadata = input.metadata
  if (input.reviewNote) {
    metadata = appendEditHistory(metadata, input.reviewNote)
  } else if (contentChanged) {
    metadata = appendEditHistory(metadata, 'İçerik düzenlendi')
  }

  const data: Prisma.DerivedContentUpdateInput = {}
  if (title !== undefined) data.title = title
  if (content !== undefined) data.content = content
  if (metadata !== undefined) data.metadata = metadata
  if (nextStatus) {
    data.status = nextStatus
    data.approvedAt = nextStatus === 'APPROVED' ? new Date() : null
    if (nextStatus === 'IN_REVIEW') data.approvedAt = null
  }

  const derived = await prisma.derivedContent.update({
    where: { id },
    data,
    include: { source: { select: { id: true, title: true } } },
  })

  if (contentChanged && existing.contentType === 'SOCIAL_CAPTION') {
    await syncSocialDraftsFromCaption(id, derived.content)
  }

  return derived
}

async function syncSocialDraftsFromCaption(derivedId: string, postContent: string) {
  await prisma.socialMediaPost.updateMany({
    where: {
      derivedContentId: derivedId,
      status: { in: ['DRAFT', 'SCHEDULED', 'FAILED'] },
    },
    data: { postContent },
  })
}

export async function deleteDerivedContent(id: string) {
  const existing = await prisma.derivedContent.findUnique({ where: { id } })
  if (!existing) throw new Error('Derived content not found')
  if (existing.status === 'PUBLISHED') {
    throw new Error('Yayınlanmış içerik silinemez')
  }
  await prisma.derivedContent.delete({ where: { id } })
  return { deleted: true, id }
}

export async function createDerivedContent(input: {
  sourceId: string
  contentType: ContentType
  title: string
  content: string
  metadata?: Prisma.InputJsonValue
  status?: Extract<ContentStatus, 'DRAFT' | 'IN_REVIEW'>
}) {
  const source = await prisma.contentSource.findUnique({ where: { id: input.sourceId } })
  if (!source) throw new Error('Source not found')

  const title = String(input.title).trim()
  const content = String(input.content).trim()
  if (!title || !content) throw new Error('title and content required')

  return prisma.derivedContent.create({
    data: {
      sourceId: input.sourceId,
      contentType: input.contentType,
      title,
      content,
      metadata: input.metadata,
      status: input.status || 'IN_REVIEW',
    },
    include: { source: { select: { id: true, title: true } } },
  })
}

export { setDerivedStatus, EDITABLE_STATUSES }
