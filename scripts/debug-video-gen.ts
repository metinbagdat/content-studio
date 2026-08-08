import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { ensureGeneratedVideo } from '../lib/social/publishVideo'

async function main() {
  const content = await prisma.derivedContent.findFirst({
    where: { title: { contains: 'Matematik Problemleri' } },
  })
  if (!content) {
    console.error('Content not found')
    return
  }
  console.log('Found:', content.id, content.contentType, content.title)
  console.log('Raw content:', content.content.slice(0, 500))

  const result = await ensureGeneratedVideo(content.id)
  console.log('SUCCESS:', result)
}

main()
  .catch((err) => {
    console.error('FULL ERROR:')
    console.error(err)
    console.error('STACK:', err?.stack)
  })
  .finally(() => prisma.$disconnect())