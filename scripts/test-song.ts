import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { generateSongAudio } from '../lib/media/generateSong'

async function main() {
  const id = process.argv[2]

  let targetId = id
  if (!targetId) {
    const latest = await prisma.derivedContent.findFirst({
      where: { contentType: { in: ['MARCH_LYRICS', 'SONG_LYRICS'] } },
      orderBy: { createdAt: 'desc' },
    })
    if (!latest) {
      console.error(
        'No MARCH_LYRICS/SONG_LYRICS found and no id passed. Usage: tsx scripts/test-song.ts <derivedContentId>',
      )
      process.exit(1)
    }
    console.log(`No id passed — using latest: ${latest.id} ("${latest.title}", ${latest.contentType})`)
    targetId = latest.id
  }

  const start = Date.now()
  const result = await generateSongAudio(targetId)
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log(`Done in ${elapsed}s`)
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())