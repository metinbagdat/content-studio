/**
 * Delete unpublished leftovers from the old ~50-piece plan.
 * Keeps published rows and the lean set (long video, podcast, blog, LinkedIn, Facebook).
 *
 *   npx tsx --env-file=.env scripts/purge-closed-channel-drafts.ts
 *   npx tsx --env-file=.env scripts/purge-closed-channel-drafts.ts --apply
 */
import { Prisma, ContentType } from '@prisma/client'
import { prisma } from '../lib/prisma'

const DROP_TYPES: ContentType[] = [
  'MARCH_LYRICS',
  'SONG_LYRICS',
  'TWITTER_THREAD',
  'LINKEDIN_CAROUSEL',
  'SHORT_VIDEO_SCRIPT',
  'INFOGRAPHIC_TEXT',
]

const DROP_PLATFORMS = ['TWITTER', 'INSTAGRAM', 'TIKTOK', 'PINTEREST'] as const

const apply = process.argv.includes('--apply')

async function main() {
  const db = process.env.DATABASE_URL || ''
  if (!/localhost|127\.0\.0\.1/.test(db)) {
    throw new Error('Refusing to run: DATABASE_URL is not local Docker')
  }

  const protectedIds = await prisma.socialMediaPost.findMany({
    where: { status: { in: ['PUBLISHED', 'PUBLISHING'] } },
    select: { derivedContentId: true },
  })
  const keep = protectedIds.map((row) => row.derivedContentId)

  const platformOr = DROP_PLATFORMS.map((platform) => ({
    metadata: { path: ['platform'], equals: platform },
  }))

  const where: Prisma.DerivedContentWhereInput = {
    status: { not: 'PUBLISHED' },
    id: keep.length ? { notIn: keep } : undefined,
    OR: [{ contentType: { in: DROP_TYPES } }, { contentType: 'SOCIAL_CAPTION', OR: platformOr }],
  }

  const rows = await prisma.derivedContent.findMany({
    where,
    select: { id: true, contentType: true, status: true },
  })

  const byType: Record<string, number> = {}
  for (const row of rows) {
    const key = `${row.contentType}:${row.status}`
    byType[key] = (byType[key] || 0) + 1
  }

  const socialWhere: Prisma.SocialMediaPostWhereInput = {
    platform: { in: [...DROP_PLATFORMS] },
    status: { in: ['DRAFT', 'FAILED', 'SCHEDULED'] },
    ...(keep.length ? { derivedContentId: { notIn: keep } } : {}),
  }
  const socialCount = await prisma.socialMediaPost.count({ where: socialWhere })

  console.log(JSON.stringify({ derived: rows.length, byType, socialDrafts: socialCount, apply }, null, 2))

  if (!apply) {
    console.log('Dry run. Re-run with --apply to delete.')
    return
  }

  const derivedIds = rows.map((row) => row.id)
  const deletedSocial = await prisma.socialMediaPost.deleteMany({ where: socialWhere })
  const deletedDerived = derivedIds.length
    ? await prisma.derivedContent.deleteMany({ where: { id: { in: derivedIds } } })
    : { count: 0 }

  console.log(JSON.stringify({ deletedDerived: deletedDerived.count, deletedSocial: deletedSocial.count }))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
