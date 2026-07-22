import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

const MUTABLE_POST_STATUSES = ['DRAFT', 'SCHEDULED', 'FAILED'] as const

function normalizeMediaUrls(input: unknown): string[] | undefined {
  if (input === undefined) return undefined
  if (!Array.isArray(input)) throw new Error('mediaUrls must be an array')
  const urls = input.map(String).map((u) => u.trim()).filter((u) => u.startsWith('http'))
  if (!urls.length && input.length > 0) {
    throw new Error('mediaUrls must contain valid http(s) URLs')
  }
  return urls
}

export async function getSocialPost(id: string) {
  return prisma.socialMediaPost.findUnique({
    where: { id },
    include: {
      account: { select: { id: true, platform: true, accountName: true } },
      derivedContent: { select: { id: true, title: true, status: true } },
    },
  })
}

export async function updateSocialPost(
  id: string,
  input: {
    postContent?: string
    mediaUrls?: string[]
    scheduledAt?: string | null
    cancelSchedule?: boolean
  },
) {
  const post = await prisma.socialMediaPost.findUnique({ where: { id } })
  if (!post) throw new Error('Post not found')
  if (post.status === 'PUBLISHED' || post.status === 'PUBLISHING') {
    throw new Error('Yayınlanmış veya yayınlanmakta olan post düzenlenemez')
  }
  if (!MUTABLE_POST_STATUSES.includes(post.status as (typeof MUTABLE_POST_STATUSES)[number])) {
    throw new Error(`Post status ${post.status} cannot be edited`)
  }

  const postContent =
    input.postContent !== undefined ? String(input.postContent).trim() : undefined
  if (postContent !== undefined && !postContent) throw new Error('postContent cannot be empty')

  const mediaUrls = normalizeMediaUrls(input.mediaUrls)

  const data: Prisma.SocialMediaPostUpdateInput = {}
  if (postContent !== undefined) data.postContent = postContent
  if (mediaUrls !== undefined) data.mediaUrls = mediaUrls
  if (input.cancelSchedule) {
    data.status = 'DRAFT'
    data.scheduledAt = null
  } else if (input.scheduledAt !== undefined) {
    if (input.scheduledAt === null) {
      data.scheduledAt = null
      data.status = 'DRAFT'
    } else {
      data.scheduledAt = new Date(input.scheduledAt)
      data.status = 'SCHEDULED'
    }
  }

  const updated = await prisma.socialMediaPost.update({
    where: { id },
    data,
    include: { account: { select: { accountName: true, platform: true } } },
  })

  if (postContent !== undefined) {
    await prisma.derivedContent.update({
      where: { id: post.derivedContentId },
      data: { content: postContent },
    })
  }

  return updated
}

export async function deleteSocialPost(id: string) {
  const post = await prisma.socialMediaPost.findUnique({
    where: { id },
    include: { account: true },
  })
  if (!post) throw new Error('Post not found')
  const isMock = Boolean(post.platformPostId?.startsWith('mock_'))
  const cfg =
    post.account.config && typeof post.account.config === 'object'
      ? (post.account.config as Record<string, unknown>)
      : {}
  const isDryRun = Boolean(cfg.dryRun) || post.account.accountId.startsWith('dryrun_')
  if ((post.status === 'PUBLISHED' || post.status === 'PUBLISHING') && !isMock && !isDryRun) {
    throw new Error('Yayınlanmış post silinemez — platformda güncelle veya LinkedIn\'den sil')
  }
  await prisma.socialMediaPost.delete({ where: { id } })
  return { deleted: true, id }
}
