import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { generateAiImageVariations } from '../lib/image/generateAiImage'

async function main() {
  const derivedContentId = process.argv[2]
  if (!derivedContentId) {
    // Fall back to the most recent SOCIAL_CAPTION if no id passed
    const latest = await prisma.derivedContent.findFirst({
      where: { contentType: 'SOCIAL_CAPTION' },
      orderBy: { createdAt: 'desc' },
    })
    if (!latest) {
      console.error('No SOCIAL_CAPTION found and no id passed. Usage: tsx scripts/test-ai-image.ts <derivedContentId>')
      process.exit(1)
    }
    console.log(`No id passed — using latest SOCIAL_CAPTION: ${latest.id} ("${latest.title}")`)
    const result = await generateAiImageVariations(latest.id, 2)
    console.log(JSON.stringify(result, null, 2))
    return
  }

  const result = await generateAiImageVariations(derivedContentId, 2)
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())