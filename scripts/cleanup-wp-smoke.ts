import { prisma } from '../lib/prisma'

const SMOKE_POST_IDS = [1, 42, 43, 999999003, 999999001, 999999099, 999999098, 999999002, 999999088, 999999077, 999999066, 999999055]

const SMOKE_TITLE_PREFIXES = [
  'vercel-key-test',
  'local-key-retest',
  'local-key-test',
  'key-test',
  'key-test2',
  'ok-test',
  'kontrol',
  'post-deploy smoke',
  'curl smoke',
  'x-api-key smoke',
  'ping',
  'smoke',
  'CS->WP ok ping',
]

async function main() {
  for (const postId of SMOKE_POST_IDS) {
    const tag = `wp-post:${postId}`
    const rows = await prisma.contentSource.findMany({
      where: { tags: { has: tag } },
      select: { id: true, title: true },
    })
    for (const row of rows) {
      await prisma.contentSource.delete({ where: { id: row.id } })
      console.log(`deleted ${row.id} ${tag} ${row.title.slice(0, 50)}`)
    }
    if (rows.length === 0) console.log(`none ${tag}`)
  }

  for (const prefix of SMOKE_TITLE_PREFIXES) {
    const rows = await prisma.contentSource.findMany({
      where: { title: { startsWith: prefix, mode: 'insensitive' } },
      select: { id: true, title: true, tags: true },
    })
    for (const row of rows) {
      await prisma.contentSource.delete({ where: { id: row.id } })
      console.log(`deleted ${row.id} title:${row.title.slice(0, 50)}`)
    }
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
