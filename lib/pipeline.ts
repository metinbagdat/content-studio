import {
  ContentStatus,
  PipelineStatus,
  SocialPlatform,
  type Prisma,
} from '@prisma/client'
import { prisma } from './prisma'
import { FAZ1_KINDS, generateTransform, toContentType } from './ai/transform'
import { enqueuePipelineJob, enqueuePublishJob } from './queue'

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
  platforms: ['TWITTER', 'LINKEDIN'],
  videoStyle: 'educational',
  podcastDuration: 10,
  autoPublish: false,
  includeMarchSong: false,
}

export async function createPipeline(sourceId: string, config: Partial<PipelineConfig> = {}) {
  const merged: PipelineConfig = {
    ...DEFAULT_CONFIG,
    ...config,
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
    const kinds = [...FAZ1_KINDS]
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

      await prisma.derivedContent.create({
        data: {
          sourceId: pipeline.sourceId,
          contentType: toContentType(kind),
          title: out.title,
          content: out.content,
          metadata: out.metadata as Prisma.InputJsonValue,
          status: 'IN_REVIEW',
        },
      })
    }

    await prisma.contentPipeline.update({
      where: { id: pipelineId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        currentStep: kinds.length,
        totalSteps: kinds.length,
      },
    })

    return { success: true, derivedCount: kinds.length }
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

export async function createSocialDraftsForCaption(derivedId: string, postContent: string) {
  const accounts = await prisma.socialMediaAccount.findMany({
    where: { isActive: true, platform: { in: ['TWITTER', 'LINKEDIN'] } },
  })
  const created = []
  for (const account of accounts) {
    const existing = await prisma.socialMediaPost.findFirst({
      where: { derivedContentId: derivedId, accountId: account.id },
    })
    if (existing) continue
    const post = await prisma.socialMediaPost.create({
      data: {
        derivedContentId: derivedId,
        accountId: account.id,
        platform: account.platform,
        postContent,
        status: 'DRAFT',
      },
    })
    created.push(post)
  }
  return created
}

/** Backfill drafts when caption was approved before accounts were connected. */
export async function syncSocialDraftsFromApprovedCaptions() {
  const captions = await prisma.derivedContent.findMany({
    where: { contentType: 'SOCIAL_CAPTION', status: { in: ['APPROVED', 'PUBLISHED'] } },
  })
  let created = 0
  for (const caption of captions) {
    const posts = await createSocialDraftsForCaption(caption.id, caption.content)
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

  if (status === 'APPROVED' && derived.contentType === 'SOCIAL_CAPTION') {
    await createSocialDraftsForCaption(derived.id, derived.content)
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
