/**
 * One-shot: publish a specific SocialMediaPost against production, to verify
 * the LinkedIn carousel fix (issue #76 — ShareCommentary 4000-char limit).
 *
 * Run from repo root, ALL in one command line (avoids terminal env drift):
 *
 *   $env:DATABASE_URL="<prod connection string>"; $env:CS_ALLOW_SUPABASE_WORKER="1"; npx tsx scripts/publish-one.ts <postId>
 *
 * Example:
 *   ... npx tsx scripts/publish-one.ts 0c97d785-8bac-4dd9-8913-82bd1e5eb068
 */
import { prisma } from '../lib/prisma'
import { preparePostForPublish } from '../lib/social/preparePublish'
import { publishPost } from '../lib/social/publish'
import { syncAccountStats } from '../lib/social/platformStats'

async function main() {
  const postId = process.argv[2]
  if (!postId) {
    console.error('Usage: npx tsx scripts/publish-one.ts <postId>')
    process.exit(1)
  }
  if (!process.env.DATABASE_URL || !/postgres/i.test(process.env.DATABASE_URL)) {
    console.error('DATABASE_URL missing or invalid — aborting before touching anything.')
    process.exit(1)
  }
  console.log('Target DB host:', new URL(process.env.DATABASE_URL).host)

  const post = await prisma.socialMediaPost.findUnique({ where: { id: postId } })
  if (!post) {
    console.error(`Post not found: ${postId}`)
    process.exit(1)
  }
  console.log(`Found post — platform=${post.platform} status=${post.status} derivedContentId=${post.derivedContentId}`)

  const mediaUrls = await preparePostForPublish(postId)
  await prisma.socialMediaPost.update({ where: { id: postId }, data: { mediaUrls } })

  const replace = post.status === 'PUBLISHED'
  try {
    const result = await publishPost(postId, {
      replace,
      requireImage: post.platform === 'LINKEDIN',
      requireVideo: post.platform === 'YOUTUBE',
      force: true,
    })
    console.log('\nResult:', JSON.stringify(result, null, 2))

    try {
      const stats = await syncAccountStats(post.accountId)
      console.log('Account stats synced:', stats ? 'ok' : 'skipped')
    } catch (err) {
      console.warn('sync-stats warning (non-fatal):', err instanceof Error ? err.message : String(err))
    }

    const updated = await prisma.socialMediaPost.findUnique({ where: { id: postId } })
    console.log('\nFinal post status:', updated?.status, '· platformPostId:', updated?.platformPostId)
    process.exit(0)
  } catch (err) {
    console.error('\n✗ Publish failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

main()