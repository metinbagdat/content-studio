import { prisma } from './prisma'

export async function getSource(id: string) {
  return prisma.contentSource.findUnique({
    where: { id },
    include: {
      _count: { select: { derivedContents: true, pipelines: true } },
    },
  })
}

export async function updateSource(
  id: string,
  input: { title?: string; content?: string; category?: string; tags?: string[] },
) {
  const existing = await prisma.contentSource.findUnique({ where: { id } })
  if (!existing) throw new Error('Source not found')

  const title = input.title !== undefined ? String(input.title).trim() : undefined
  const content = input.content !== undefined ? String(input.content).trim() : undefined
  if (title !== undefined && !title) throw new Error('title cannot be empty')
  if (content !== undefined && !content) throw new Error('content cannot be empty')

  return prisma.contentSource.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(input.category !== undefined ? { category: String(input.category) } : {}),
      ...(input.tags !== undefined ? { tags: input.tags.map(String) } : {}),
    },
  })
}

export async function deleteSource(id: string) {
  const existing = await prisma.contentSource.findUnique({ where: { id } })
  if (!existing) throw new Error('Source not found')
  await prisma.contentSource.delete({ where: { id } })
  return { deleted: true, id }
}
