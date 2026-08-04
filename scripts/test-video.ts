import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { generateVideoVariants } from '../lib/video/generateVideo'

async function main() {
  const derivedContentId = process.argv[2]

  let targetId = derivedContentId
  if (!targetId) {
    const latest = await prisma.derivedContent.findFirst({
      where: { contentType: 'VIDEO_SCRIPT' },
      orderBy: { createdAt: 'desc' },
    })
    if (!latest) {
      console.error(
        'No VIDEO_SCRIPT found and no id passed. Usage: tsx scripts/test-video.ts <derivedContentId>',
      )
      process.exit(1)
    }
    console.log(`No id passed — using latest VIDEO_SCRIPT: ${latest.id} ("${latest.title}")`)
    targetId = latest.id
  }

  console.log('Rendering video variants (this can take a while — FFmpeg + AI images + TTS)...')
  const start = Date.now()
  const variants = await generateVideoVariants(targetId)  // sadece 16:9 (varsayılan)
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log(`Done in ${elapsed}s`)
  console.log(JSON.stringify(variants, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())