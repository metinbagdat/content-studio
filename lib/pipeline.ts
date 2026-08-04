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

  // Never let two pipelines for the same source be in-flight at once — a double click,
  // an overlapping discovery trigger, or a stuck worker queue would otherwise pile up
  // duplicate PENDING/RUNNING rows for the same article.
  const inFlight = await prisma.contentPipeline.findFirst({
    where: { sourceId, status: { in: ['PENDING', 'RUNNING'] } },
    orderBy: { createdAt: 'desc' },
  })
  if (inFlight?.status === 'RUNNING') {
    throw new Error('Bu kaynak için pipeline zaten çalışıyor — bitmesini bekleyin.')
  }
  if (inFlight) {
    // PENDING and not yet started — reuse it instead of creating a duplicate row.
    // Whoever called createPipeline() will still call processPipeline() on this id as usual.
    return inFlight
  }

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
          atomizedCreated: atomized.created,
          atomizedByType: atomized.byType,
          atomizedErrors: atomized.errors,
          aiImagesGenerated,        // YENİ
          aiImageErrors,            // YENİ
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
    // processPipeline içinde, bu bloğun hemen altına:
    const atomized = await generateAllDerivatives(atomizationPlan, {
      sourceId: pipeline.sourceId,
      title: pipeline.source.title,
      article: pipeline.source.content,
      articleUrl,
      tags: pipeline.source.tags,
      platforms: config.platforms,
    })

    // YENİ: socialCard işaretli caption'lar için AI görsel üret (best-effort — bir
    // görsel başarısız olursa diğerlerini ve pipeline'ı etkilemesin)
    const socialCardTargets = await prisma.derivedContent.findMany({
      where: {
        sourceId: pipeline.sourceId,
        contentType: 'SOCIAL_CAPTION',
        createdAt: { gte: pipeline.startedAt ?? pipeline.createdAt },
      },
      select: { id: true, metadata: true },
    })
    const aiImageErrors: string[] = []
    let aiImagesGenerated = 0
    for (const item of socialCardTargets) {
      const m = item.metadata && typeof item.metadata === 'object' ? (item.metadata as Record<string, unknown>) : {}
      if (!m.socialCard) continue
      try {
        const { generateAiImageVariations } = await import('./image/generateAiImage')
        const variations = await generateAiImageVariations(item.id, 2)
        if (variations.length) aiImagesGenerated += 1
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        aiImageErrors.push(`${item.id.slice(0, 8)}: ${msg}`)
      }
    }
			
    // A handful of failed items (e.g. a not-yet-migrated ContentType enum value) shouldn't
    // sink the whole run when dozens of other pieces were generated fine — surface them as
    // warnings on a COMPLETED pipeline instead of a hard FAILED status.
    const allErrors = [...pipeline.errors, ...atomized.errors, ...aiImageErrors]
	
    await prisma.contentPipeline.update({
      where: { id: pipelineId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        currentStep: kinds.length + 1,
        totalSteps: kinds.length + 1,
        errors: allErrors,
        config: {
          ...config,
          atomizationPlan,
          distributionCalendar,
          plannedPieces: totalPlannedPieces(atomizationPlan.contentPieces),
          atomizedCreated: atomized.created,
          atomizedByType: atomized.byType,
          atomizedErrors: atomized.errors,
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

  // Prefer real OAuth accounts; fall back to dry-run so drafts still appear on /admin/social
  let accounts = await prisma.socialMediaAccount.findMany({
    where: {
      isActive: true,
      platform: { in: platforms },
      accountId: { not: { startsWith: 'dryrun_' } },
    },
  })
  if (!accounts.length) {
    accounts = await prisma.socialMediaAccount.findMany({
      where: {
        isActive: true,
        platform: { in: platforms },
        accountId: { startsWith: 'dryrun_' },
      },
    })
  }
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

export type BulkStatusResult = {
  processed: number
  approved: number
  rejected: number
  draftsCreated: number
  mediaGenerated: number
  errors: string[]
}

/** Approve/reject many derivatives; optional podcast/image generation on approve. */
export async function bulkSetDerivedStatus(
  ids: string[],
  status: 'APPROVED' | 'REJECTED',
  options: { autoMedia?: boolean } = {},
): Promise<BulkStatusResult> {
  const result: BulkStatusResult = {
    processed: 0,
    approved: 0,
    rejected: 0,
    draftsCreated: 0,
    mediaGenerated: 0,
    errors: [],
  }

  for (const id of ids) {
    try {
      const before = await prisma.socialMediaPost.count({ where: { derivedContentId: id } })
      const derived = await setDerivedStatus(id, status)
      result.processed += 1
      if (status === 'APPROVED') {
        result.approved += 1
        const after = await prisma.socialMediaPost.count({ where: { derivedContentId: id } })
        result.draftsCreated += Math.max(0, after - before)

        if (options.autoMedia) {
          if (derived.contentType === 'PODCAST_SCRIPT') {
            const { generatePodcastAudio } = await import('./media/generatePodcast')
            await generatePodcastAudio(id)
            result.mediaGenerated += 1
          }
          if (derived.contentType === 'SOCIAL_CAPTION') {
            await ensureGeneratedPostImage(id)
            result.mediaGenerated += 1
          }
        }
      } else {
        result.rejected += 1
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${id}: ${msg}`)
    }
  }

  return result
}

export type BulkPublishResult = {
  attempted: number
  published: number
  skipped: number
  failed: number
  errors: string[]
}

/** Publish every DRAFT/FAILED social post now. Dry-run accounts skipped by default (mock IDs only). */
export async function bulkPublishDraftPosts(
  options: { includeDryRun?: boolean } = {},
): Promise<BulkPublishResult> {
  const posts = await prisma.socialMediaPost.findMany({
    where: { status: { in: ['DRAFT', 'FAILED'] } },
    include: { account: true },
    orderBy: { createdAt: 'asc' },
  })

  const result: BulkPublishResult = { attempted: 0, published: 0, skipped: 0, failed: 0, errors: [] }
  const { publishPost } = await import('./social/publish')

  for (const post of posts) {
    const cfg =
      post.account.config && typeof post.account.config === 'object'
        ? (post.account.config as Record<string, unknown>)
        : {}
    const isDryRun = Boolean(cfg.dryRun) || post.account.accountId.startsWith('dryrun_')
    if (isDryRun && !options.includeDryRun) {
      result.skipped += 1
      continue
    }
    if (!post.account.isActive) {
      result.skipped += 1
      continue
    }

    result.attempted += 1
    try {
      const mediaUrls = await ensureGeneratedPostImage(post.derivedContentId)
      if (mediaUrls.length) {
        await prisma.socialMediaPost.update({ where: { id: post.id }, data: { mediaUrls } })
      }
      const r = await publishPost(post.id, { requireImage: true })
      if (r.skipped) {
        result.skipped += 1
      } else {
        result.published += 1
      }
    } catch (err) {
      result.failed += 1
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${post.platform} ${post.id.slice(0, 8)}: ${msg}`)
    }
  }

  return result
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
