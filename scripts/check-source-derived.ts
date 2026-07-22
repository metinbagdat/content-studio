import { prisma } from '../lib/prisma'

const sourceId = process.argv[2] || '4c122834-d580-4a8c-b288-e8cb7ff7b750'

async function main() {
  const rows = await prisma.derivedContent.findMany({
    where: { sourceId },
    orderBy: [{ contentType: 'asc' }, { title: 'asc' }],
    select: { id: true, contentType: true, title: true, status: true, metadata: true, content: true },
  })
  for (const r of rows) {
    const meta = r.metadata && typeof r.metadata === 'object' ? (r.metadata as Record<string, unknown>) : {}
    const extra =
      r.contentType === 'SOCIAL_CAPTION'
        ? ` part=${meta.partIndex}/${meta.partTotal} articleTitle=${meta.articleTitle}`
        : ''
    console.log(`${r.contentType}${extra} | ${r.status} | ${r.title.slice(0, 70)}`)
    if (r.contentType !== 'SOCIAL_CAPTION') {
      console.log(`  preview: ${r.content.slice(0, 100).replace(/\n/g, ' ')}…`)
    }
  }
  console.log('\n=== SOCIAL previews ===')
  for (const r of rows.filter((x) => x.contentType === 'SOCIAL_CAPTION')) {
    const meta = r.metadata && typeof r.metadata === 'object' ? (r.metadata as Record<string, unknown>) : {}
    console.log(`${meta.partIndex}/${meta.partTotal}: ${r.content.slice(0, 180).replace(/\n/g, ' | ')}`)
  }
  const posts = await prisma.socialMediaPost.findMany({
    where: { derivedContent: { sourceId } },
    include: { account: { select: { accountName: true, accountId: true } } },
  })
  console.log(`\nSocial posts: ${posts.length}`)
  for (const p of posts) {
    console.log(`  ${p.account.accountName} (${p.platform}) ${p.status}`)
  }
}

main().finally(() => prisma.$disconnect())
