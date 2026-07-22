import { linkedinUploadImageFromUrl, linkedinUploadImageFromBuffer } from './linkedinMedia'
import { linkedinAuthorUrn } from './config'
import { getValidAccessToken } from './tokenRefresh'
import { resolvePostMediaUrls, readPostImageBuffer } from './brandImage'
import { prisma } from '../prisma'

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
    const accessToken = await getValidAccessToken(post.account)

    if (post.platform === 'TWITTER') {
      platformPostId = await publishTwitter(post.postContent, accessToken)
    } else if (post.platform === 'LINKEDIN') {
      const author = linkedinAuthorUrn(post.account.accountId, post.account.config)
      const mediaUrls =
        post.mediaUrls.length > 0 ? post.mediaUrls : await resolvePostMediaUrls(post.derivedContentId)
      platformPostId = await publishLinkedIn(
        post.postContent,
        accessToken,
        author,
        post.account,
        mediaUrls,
        post.derivedContentId,
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
  account?: { config: unknown; accountId: string },
  mediaUrls: string[] = [],
  derivedContentId?: string,
): Promise<string> {
  if (!accessToken || accessToken === 'dry-run') {
    return `mock_li_${Date.now()}`
  }
  const cfg =
    account?.config && typeof account.config === 'object'
      ? (account.config as Record<string, unknown>)
      : {}
  const authorFromConfig = typeof cfg.linkedinAuthorUrn === 'string' ? cfg.linkedinAuthorUrn : authorUrn
  const author = authorFromConfig.startsWith('urn:')
    ? authorFromConfig
    : `urn:li:person:${authorFromConfig}`

  const imageUrl = mediaUrls.find((u) => u.startsWith('http'))
  let shareContent: Record<string, unknown>

  if (imageUrl || derivedContentId) {
    try {
      let asset: string
      const localBuffer = derivedContentId ? await readPostImageBuffer(derivedContentId) : null
      if (localBuffer) {
        asset = await linkedinUploadImageFromBuffer(accessToken, author, localBuffer, 'image/png')
      } else if (imageUrl) {
        asset = await linkedinUploadImageFromUrl(accessToken, author, imageUrl)
      } else {
        throw new Error('No image available')
      }
      shareContent = {
        shareCommentary: { text },
        shareMediaCategory: 'IMAGE',
        media: [
          {
            status: 'READY',
            description: { text: 'egitim.today' },
            media: asset,
            title: { text: 'egitim.today' },
          },
        ],
      }
    } catch (err) {
      console.warn('[publishLinkedIn] image upload failed, text-only', err)
      shareContent = {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      }
    }
  } else {
    shareContent = {
      shareCommentary: { text },
      shareMediaCategory: 'NONE',
    }
  }

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
        'com.linkedin.ugc.ShareContent': shareContent,
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
