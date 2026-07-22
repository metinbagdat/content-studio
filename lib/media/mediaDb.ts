import { prisma } from '../prisma'

export async function getMediaFile(id: string) {
  return prisma.mediaFile.findUnique({
    where: { id },
    include: { derivedContent: { select: { title: true, contentType: true } } },
  })
}

export async function listMedia(derivedContentId?: string) {
  return prisma.mediaFile.findMany({
    where: derivedContentId ? { derivedContentId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      derivedContent: { select: { id: true, title: true, contentType: true, status: true } },
    },
  })
}
