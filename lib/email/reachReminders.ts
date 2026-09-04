import { prisma } from '../prisma'

const NOTIFIED_TAG = 'reach:notified'
const WP_PUBLISHED_TAG = 'wp-published'

export type ReachReminder = {
  sourceId: string
  title: string
  link: string | null
  createdAt: string
}

function extractLink(tags: string[]): string | null {
  const raw = tags.find((t) => t.startsWith('wp-link:'))
  return raw ? raw.slice('wp-link:'.length) : null
}

/** WP-published sources that haven't been marked as "Reach'e bildirildi" yet. */
export async function listPendingReachReminders(limit = 10): Promise<ReachReminder[]> {
  const rows = await prisma.contentSource.findMany({
    where: {
      tags: { has: WP_PUBLISHED_TAG },
      NOT: { tags: { has: NOTIFIED_TAG } },
    },
    select: { id: true, title: true, tags: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return rows.map((r) => ({
    sourceId: r.id,
    title: r.title,
    link: extractLink(r.tags),
    createdAt: r.createdAt.toISOString(),
  }))
}

/** Mark a source's Reach newsletter reminder as handled (human confirmed they sent it in Reach). */
export async function dismissReachReminder(sourceId: string): Promise<void> {
  const row = await prisma.contentSource.findUnique({ where: { id: sourceId }, select: { tags: true } })
  if (!row) return
  if (row.tags.includes(NOTIFIED_TAG)) return
  await prisma.contentSource.update({
    where: { id: sourceId },
    data: { tags: [...row.tags, NOTIFIED_TAG] },
  })
}
