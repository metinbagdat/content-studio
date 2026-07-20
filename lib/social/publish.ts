import { prisma } from '../prisma'
import { decryptSecret } from '../crypto'

/**
 * Publish a scheduled/draft social post.
 * Real X/LinkedIn APIs require OAuth credentials; without them we dry-run and mark PUBLISHED with a mock platform id.
 */
export async function publishPost(postId: string) {
  const post = await prisma.socialMediaPost.findUnique({
    where: { id: postId },
    include: { account: true },
  })
  if (!post) throw new Error('Post not found')
  if (post.status === 'PUBLISHED') return { skipped: true, platformPostId: post.platformPostId }

  await prisma.socialMediaPost.update({
    where: { id: postId },
    data: { status: 'PUBLISHING' },
  })

  try {
    let platformPostId: string

    if (post.platform === 'TWITTER') {
      platformPostId = await publishTwitter(post.postContent, decryptSecret(post.account.accessToken))
    } else if (post.platform === 'LINKEDIN') {
      platformPostId = await publishLinkedIn(
        post.postContent,
        decryptSecret(post.account.accessToken),
        post.account.accountId,
      )
    } else {
      throw new Error(`Platform not implemented in Faz 1: ${post.platform}`)
    }

    await prisma.socialMediaPost.update({
      where: { id: postId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        platformPostId,
        error: null,
      },
    })

    await prisma.derivedContent.update({
      where: { id: post.derivedContentId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    })

    return { success: true, platformPostId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.socialMediaPost.update({
      where: { id: postId },
      data: { status: 'FAILED', error: message },
    })
    throw err
  }
}

async function publishTwitter(text: string, accessToken: string): Promise<string> {
  if (!accessToken || accessToken === 'dry-run' || !process.env.X_CLIENT_ID) {
    return `mock_x_${Date.now()}`
  }
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: text.slice(0, 280) }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`X API ${res.status}: ${body}`)
  }
  const data = (await res.json()) as { data?: { id?: string } }
  return data.data?.id || `x_${Date.now()}`
}

async function publishLinkedIn(
  text: string,
  accessToken: string,
  authorUrn: string,
): Promise<string> {
  if (!accessToken || accessToken === 'dry-run' || !process.env.LINKEDIN_CLIENT_ID) {
    return `mock_li_${Date.now()}`
  }
  const author = authorUrn.startsWith('urn:') ? authorUrn : `urn:li:person:${authorUrn}`
  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LinkedIn API ${res.status}: ${body}`)
  }
  return res.headers.get('x-restli-id') || `li_${Date.now()}`
}

/** Process due SCHEDULED posts (DB poll fallback). */
export async function drainDuePosts(limit = 10) {
  const due = await prisma.socialMediaPost.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: new Date() },
    },
    take: limit,
    orderBy: { scheduledAt: 'asc' },
  })
  for (const p of due) {
    try {
      await publishPost(p.id)
    } catch (err) {
      console.error('[drainDuePosts]', p.id, err)
    }
  }
  return due.length
}
