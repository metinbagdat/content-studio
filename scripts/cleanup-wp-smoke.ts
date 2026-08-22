import { prisma } from '../lib/prisma'

const SMOKE_POST_IDS = [999999003, 999999001, 999999099, 999999098, 999999002, 999999088]

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
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
