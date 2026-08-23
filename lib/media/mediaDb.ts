import { prisma } from '../prisma'

export async function getMediaFile(id: string) {
  return prisma.mediaFile.findUnique({
    where: { id },
    include: { derivedContent: { select: { title: true, contentType: true } } },
  })
}

export async function listMedia(derivedContentId?: string, opts?: { includeFailed?: boolean }) {
  return prisma.mediaFile.findMany({
    where: {
      ...(derivedContentId ? { derivedContentId } : {}),
      ...(opts?.includeFailed ? {} : { processingStatus: { not: 'FAILED' } }),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      derivedContent: { select: { id: true, title: true, contentType: true, status: true } },
    },
  })
}
