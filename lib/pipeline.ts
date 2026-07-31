import {
  ContentStatus,
  PipelineStatus,
  SocialPlatform,
  type Prisma,
} from '@prisma/client'
import { prisma } from './prisma'
import { FAZ1_KINDS, generateTransform, toContentType } from './ai/transform'
import { generateAtomizationPlan, totalPlannedPieces } from './atomization/plan'
import { generateAllDerivatives } from './atomization/generateDerivatives'
import { buildDistributionCalendar } from './scheduling/distributionCalendar'
import { enqueuePipelineJob, enqueuePublishJob } from './queue'
import { ensureGeneratedPostImage, publishCaptionWithImages } from './social/publishCaption'
import { DEFAULT_PIPELINE_PLATFORMS, normalizePlatforms } from './platforms/targets'

export type PipelineConfig = {
  platforms: SocialPlatform[]
  videoStyle?: string
  podcastDuration?: number
  marchStyle?: string
  musicGenre?: string
  /** Always false by default — human approval required */
  autoPublish?: boolean
  includeMarchSong?: boolean
  priority?: number
}

const DEFAULT_CONFIG: PipelineConfig = {
  platforms: DEFAULT_PIPELINE_PLATFORMS,
  videoStyle: 'educational',
  podcastDuration: 10,
  autoPublish: false,
  includeMarchSong: false,
}

export async function createPipeline(sourceId: string, config: Partial<PipelineConfig> = {}) {
  const merged: PipelineConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    platforms: normalizePlatforms(config.platforms ?? DEFAULT_CONFIG.platforms),
    autoPublish: false, // hard override — brand safety
  }

  const source = await prisma.contentSource.findUnique({ where: { id: sourceId } })
  if (!source) throw new Error('Source not found')

  const pipeline = await prisma.contentPipeline.create({
    data: {
      sourceId,
      name: `Auto-Production ${new Date().toISOString().slice(0, 16)}`,
      status: 'PENDING',
      currentStep: 0,
      totalSteps: merged.includeMarchSong ? 6 : 4,
      config: merged as unknown as Prisma.InputJsonValue,
    },
  })

  await prisma.queueJob.create({
    data: {
      jobType: 'PROCESS_PIPELINE',
      payload: { pipelineId: pipeline.id },
      priority: merged.priority ?? 5,
    },
  })

  await enqueuePipelineJob(pipeline.id)

  return pipeline
}

export async function processPipeline(pipelineId: string) {
  const pipeline = await prisma.contentPipeline.findUnique({
    where: { id: pipelineId },
    include: { source: true },
  })
  if (!pipeline) throw new Error('Pipeline not found')

  const config = (pipeline.config || DEFAULT_CONFIG) as PipelineConfig

  await prisma.contentPipeline.update({
    where: { id: pipelineId },
    data: { status: 'RUNNING', startedAt: new Date(), errors: [] },
  })

  try {
    const atomizationPlan = await generateAtomizationPlan(
      pipeline.source.title,
      pipeline.source.content,
    )
    const distributionCalendar = buildDistributionCalendar({
      plan: atomizationPlan,
      sourceTitle: pipeline.source.title,
      platforms: config.platforms,
    })

    await prisma.contentPipeline.update({
      where: { id: pipelineId },
      data: {
        config: {
          ...config,
          atomizationPlan,
          distributionCalendar,
          plannedPieces: totalPlannedPieces(atomizationPlan.contentPieces),
        } as Prisma.InputJsonValue,
      },
    })

    const articleUrl = pipeline.source.tags.find((t) => t.startsWith('blog:'))
      ? `https://www.egitim.today/blog/${pipeline.source.tags.find((t) => t.startsWith('blog:'))!.replace('blog:', '')}`
      : undefined

    const kinds = [...FAZ1_KINDS].filter((k) => k !== 'SOCIAL_CAPTION')
    if (config.includeMarchSong) {
      kinds.push('MARCH_LYRICS', 'SONG_LYRICS')
    }

    let step = 0
    for (const kind of kinds) {
      step += 1
      await prisma.contentPipeline.update({
        where: { id: pipelineId },
        data: { currentStep: step },
      })

      const out = await generateTransform(kind, pipeline.source.title, pipeline.source.content)
      const meta: Record<string, unknown> = {
        ...(out.metadata && typeof out.metadata === 'object' ? out.metadata : {}),
      }
      if (kind === 'VIDEO_SCRIPT' && config.platforms.includes('YOUTUBE')) {
        meta.platform = 'YOUTUBE'
        meta.atomKind = 'long_form_video'
      }

      await prisma.derivedContent.create({
        data: {
          sourceId: pipeline.sourceId,
          contentType: toContentType(kind),
          title: out.title,
          content: out.content,
          metadata: meta as Prisma.InputJsonValue,
          status: 'IN_REVIEW',
        },
      })
    }

    const atomized = await generateAllDerivatives(atomizationPlan, {
      sourceId: pipeline.sourceId,
      title: pipeline.source.title,
      article: pipeline.source.content,
      articleUrl,
      tags: pipeline.source.tags,
      platforms: config.platforms,
    })

    await prisma.contentPipeline.update({
      where: { id: pipelineId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        currentStep: kinds.length + 1,
        totalSteps: kinds.length + 1,
        config: {
          ...config,
          atomizationPlan,
          distributionCalendar,
          plannedPieces: totalPlannedPieces(atomizationPlan.contentPieces),
          atomizedCreated: atomized.created,
          atomizedByType: atomized.byType,
        } as Prisma.InputJsonValue,
      },
    })

    return { success: true, derivedCount: kinds.length + atomized.created, atomized }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.contentPipeline.update({
      where: { id: pipelineId },
      data: {
        status: 'FAILED',
        errors: [...pipeline.errors, message],
      },
    })
    throw err
  }
}

export async function createSocialDraftsForDerived(derivedId: string, postContent: string) {
  const derived = await prisma.derivedContent.findUnique({ where: { id: derivedId } })
  if (!derived) return []

  const meta =
    derived.metadata && typeof derived.metadata === 'object'
      ? (derived.metadata as Record<string, unknown>)
      : {}
  const targetPlatform = meta.platform as SocialPlatform | 'PINTEREST' | undefined

  let platforms: SocialPlatform[] = ['TWITTER', 'LINKEDIN']
  if (derived.contentType === 'TWITTER_THREAD') platforms = ['TWITTER']
  if (derived.contentType === 'LINKEDIN_CAROUSEL') platforms = ['LINKEDIN']
  if (targetPlatform && targetPlatform !== 'PINTEREST') {
    platforms = [targetPlatform]
  }

  const accounts = await prisma.socialMediaAccount.findMany({
    where: {
      isActive: true,
      platform: { in: platforms },
      accountId: { not: { startsWith: 'dryrun_' } },
    },
  })
  const mediaUrls =
    derived.contentType === 'SOCIAL_CAPTION' ? await ensureGeneratedPostImage(derivedId) : []
  const created = []
  for (const account of accounts) {
    if (targetPlatform && account.platform !== targetPlatform && derived.contentType === 'SOCIAL_CAPTION') {
      continue
    }
    const existing = await prisma.socialMediaPost.findFirst({
      where: { derivedContentId: derivedId, accountId: account.id },
    })
    if (existing) {
      if (mediaUrls.length) {
        await prisma.socialMediaPost.update({
          where: { id: existing.id },
          data: { mediaUrls },
        })
      }
      continue
    }
    const post = await prisma.socialMediaPost.create({
      data: {
        derivedContentId: derivedId,
        accountId: account.id,
        platform: account.platform,
        postContent,
        mediaUrls,
        status: 'DRAFT',
      },
    })
    created.push(post)
  }
  return created
}

/** @deprecated use createSocialDraftsForDerived */
export async function createSocialDraftsForCaption(derivedId: string, postContent: string) {
  return createSocialDraftsForDerived(derivedId, postContent)
}

/** Backfill drafts when caption was approved before accounts were connected. */
export async function syncSocialDraftsFromApprovedCaptions() {
  const captions = await prisma.derivedContent.findMany({
    where: {
      contentType: { in: ['SOCIAL_CAPTION', 'TWITTER_THREAD', 'LINKEDIN_CAROUSEL'] },
      status: { in: ['APPROVED', 'PUBLISHED'] },
    },
  })
  let created = 0
  for (const caption of captions) {
    const posts = await createSocialDraftsForDerived(caption.id, caption.content)
    created += posts.length
  }
  return { captions: captions.length, draftsCreated: created }
}

export async function setDerivedStatus(
  id: string,
  status: Extract<ContentStatus, 'APPROVED' | 'REJECTED' | 'IN_REVIEW'>,
) {
  const derived = await prisma.derivedContent.update({
    where: { id },
    data: {
      status,
      approvedAt: status === 'APPROVED' ? new Date() : null,
    },
    include: { source: true },
  })

  if (status === 'APPROVED') {
    const socialTypes = ['SOCIAL_CAPTION', 'TWITTER_THREAD', 'LINKEDIN_CAROUSEL'] as const
    if (socialTypes.includes(derived.contentType as (typeof socialTypes)[number])) {
      await createSocialDraftsForDerived(derived.id, derived.content)
      if (process.env.SOCIAL_AUTO_PUBLISH === 'true' && derived.contentType === 'SOCIAL_CAPTION') {
        await publishCaptionWithImages(derived.id)
      }
    }
  }

  return derived
}

export async function schedulePost(postId: string, scheduledAt: Date) {
  const post = await prisma.socialMediaPost.update({
    where: { id: postId },
    data: { scheduledAt, status: 'SCHEDULED' },
  })
  await prisma.queueJob.create({
    data: {
      jobType: 'PUBLISH_SOCIAL_POST',
      payload: { postId },
      scheduledAt,
      priority: 3,
    },
  })
  await enqueuePublishJob(postId, scheduledAt)
  return post
}

export { PipelineStatus }
