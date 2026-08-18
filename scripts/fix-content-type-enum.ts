/**
 * Adds any ContentType enum values that exist in packages/db/prisma/schema.prisma but are
 * missing from the live Postgres database, then prints the full enum list to
 * confirm. Self-contained on purpose — avoids all the PowerShell quoting/paste
 * issues around hand-typed ALTER TYPE statements.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/fix-content-type-enum.ts
 *   (or --env-file=.env if that's the file with your real DATABASE_URL)
 */
import { prisma } from '../lib/prisma'

const REQUIRED_VALUES = [
  'VIDEO_SCRIPT',
  'PODCAST_SCRIPT',
  'MARCH_LYRICS',
  'SONG_LYRICS',
  'SOCIAL_CAPTION',
  'BLOG_POST',
  'TWITTER_THREAD',
  'LINKEDIN_CAROUSEL',
  'SHORT_VIDEO_SCRIPT',
  'INFOGRAPHIC_TEXT',
]

async function main() {
  console.log('Connecting to:', (process.env.DATABASE_URL || '').replace(/:\/\/[^@]+@/, '://***@'))

  const before = await prisma.$queryRawUnsafe<Array<{ unnest: string }>>(
    'SELECT unnest(enum_range(NULL::"ContentType")) as unnest',
  )
  const existing = new Set(before.map((r) => r.unnest))
  console.log('\nBefore:', [...existing].sort().join(', '))

  const missing = REQUIRED_VALUES.filter((v) => !existing.has(v))
  if (!missing.length) {
    console.log('\nNothing to do — all required ContentType values already exist.')
    return
  }

  console.log('\nMissing values to add:', missing.join(', '))
  for (const value of missing) {
    // ALTER TYPE ... ADD VALUE cannot use bound parameters; value is from our own
    // fixed whitelist above (not user input), so string interpolation is safe here.
    await prisma.$executeRawUnsafe(`ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS '${value}'`)
    console.log(`  added: ${value}`)
  }

  const after = await prisma.$queryRawUnsafe<Array<{ unnest: string }>>(
    'SELECT unnest(enum_range(NULL::"ContentType")) as unnest',
  )
  console.log('\nAfter:', after.map((r) => r.unnest).sort().join(', '))
  console.log('\nDone. Restart `npm run dev` / `npm run worker` if either was already running.')
}

main()
  .catch((err) => {
    console.error('\nFAILED:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
