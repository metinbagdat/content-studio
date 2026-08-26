import {
  ContentStatus,
  PipelineStatus,
  SocialPlatform,
  type Prisma,
} from '@prisma/client'
import { prisma, ensurePrismaConnected, isPrismaConnectionError } from './prisma'
import { FAZ1_KINDS, generateTransform, toContentType } from './ai/transform'
import { generateAtomizationPlan, totalPlannedPieces } from './atomization/plan'
import { generateAllDerivatives } from './atomization/generateDerivatives'
import { buildDistributionCalendar } from './scheduling/distributionCalendar'
import { enqueuePipelineJob, enqueuePublishJob } from './queue'
import { ensureGeneratedPostImage, ensureGeneratedPostMedia, publishCaptionWithImages } from './social/publishCaption'
import { buildYouTubePostContent } from './social/publishVideo'
import { preparePostForPublish } from './social/preparePublish'
import { DEFAULT_PIPELINE_PLATFORMS, normalizePlatforms } from '@content-studio/core/platforms/targets'
import { platformsForSegment, withSegmentTag } from './audience/segments'
import { resolveAudienceSegment } from './audience/resolveAudienceSegment'
import { metaBulkPublishGapMs } from './social/metaReview'
import { splitArticleForEpisodes, suggestedPodcastEpisodeCount } from './media/podcastEpisodes'
import { canonicalArticleUrl } from './content/canonicalUrl'
import { isServerlessRuntime } from './storage/writableRoot'
import {
  faultMessageFromBulkError,
  isStorageOrVideoFault,
  markReviewFault,
  reopenReviewWithFault,
  readReviewFault,
  VIDEO_FAULT_TYPES,
} from './review/fault'

const WP_DRAFT_TYPES = new Set([
  'BLOG_POST',
  'PODCAST_SCRIPT',
  'VIDEO_SCRIPT',
  'SHORT_VIDEO_SCRIPT',
  'MARCH_LYRICS',
  'SONG_LYRICS',
])

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
  const source = await prisma.contentSource.findUnique({ where: { id: sourceId } })
  if (!source) throw new Error('Source not found')

  const { segment } = await resolveAudienceSegment(`${source.title}\n${source.content}`, source.tags)
  const tagged = withSegmentTag(source.tags, segment)
  if (tagged.join('\0') !== source.tags.join('\0')) {
    await prisma.contentSource.update({ where: { id: sourceId }, data: { tags: tagged } })
    source.tags = tagged
  }

  const merged: PipelineConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    platforms: normalizePlatforms(config.platforms ?? platformsForSegment(segment)),
    autoPublish: false, // hard override — brand safety
  }

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

    const distributionCalendar = await buildDistributionCalendar({
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

    const articleUrl = canonicalArticleUrl(pipeline.source.tags)

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

      if (kind === 'PODCAST_SCRIPT') {
        const episodeCount = suggestedPodcastEpisodeCount(
          pipeline.source.content,
          atomizationPlan.contentPieces.podcastEpisodes,
        )
        const chunks = splitArticleForEpisodes(pipeline.source.content, episodeCount)
        const seriesId = crypto.randomUUID()
        for (const chunk of chunks) {
          const ep = await generateTransform('PODCAST_SCRIPT', pipeline.source.title, chunk.body, {
            episodeIndex: chunk.index,
            episodeTotal: chunk.total,
            episodeFocus: chunk.heading,
          })
          const epMeta: Record<string, unknown> = {
            ...(ep.metadata && typeof ep.metadata === 'object' ? ep.metadata : {}),
            seriesId,
            episodeIndex: chunk.index,
            episodeTotal: chunk.total,
            episodeFocus: chunk.heading,
            ...(articleUrl ? { articleUrl } : {}),
          }
          await prisma.derivedContent.create({
            data: {
              sourceId: pipeline.sourceId,
              contentType: toContentType(kind),
              title: ep.title,
              content: ep.content,
              metadata: epMeta as Prisma.InputJsonValue,
              status: 'IN_REVIEW',
            },
          })
        }
        continue
      }

      const out = await generateTransform(kind, pipeline.source.title, pipeline.source.content)
      const meta: Record<string, unknown> = {
        ...(out.metadata && typeof out.metadata === 'object' ? out.metadata : {}),
        ...(articleUrl ? { articleUrl } : {}),
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
          aiImagesGenerated,
          aiImageErrors,
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

export async function createSocialDraftsForDerived(
  derivedId: string,
  postContent: string,
  opts: { skipImages?: boolean } = {},
) {
  const derived = await prisma.derivedContent.findUnique({
    where: { id: derivedId },
    include: { source: { select: { tags: true } } },
  })
  if (!derived) return []

  const meta =
    derived.metadata && typeof derived.metadata === 'object'
      ? (derived.metadata as Record<string, unknown>)
      : {}
  const targetPlatform = meta.platform as SocialPlatform | undefined

  let platforms: SocialPlatform[] = ['TWITTER', 'LINKEDIN', 'FACEBOOK']
  if (derived.contentType === 'TWITTER_THREAD') platforms = ['TWITTER']
  if (derived.contentType === 'LINKEDIN_CAROUSEL') platforms = ['LINKEDIN']
  if (derived.contentType === 'VIDEO_SCRIPT' || derived.contentType === 'SHORT_VIDEO_SCRIPT') {
    platforms = ['YOUTUBE']
  }
  if (targetPlatform === 'PINTEREST') {
    platforms = ['PINTEREST']
  } else if (targetPlatform) {
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
    derived.contentType === 'SOCIAL_CAPTION' && !opts.skipImages
      ? await ensureGeneratedPostImage(derivedId)
      : []

  const body =
    derived.contentType === 'VIDEO_SCRIPT' || derived.contentType === 'SHORT_VIDEO_SCRIPT'
      ? buildYouTubePostContent({
          title: derived.title,
          content: derived.content,
          contentType: derived.contentType,
          metadata: derived.metadata,
          articleUrl:
            (typeof meta.articleUrl === 'string' && meta.articleUrl) ||
            canonicalArticleUrl(derived.source.tags),
        })
      : postContent
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
        postContent: body,
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
export async function syncSocialDraftsFromApprovedCaptions(opts: { skipImages?: boolean } = {}) {
  const captions = await prisma.derivedContent.findMany({
    where: {
      contentType: {
        in: ['SOCIAL_CAPTION', 'TWITTER_THREAD', 'LINKEDIN_CAROUSEL', 'VIDEO_SCRIPT', 'SHORT_VIDEO_SCRIPT'],
      },
      status: { in: ['APPROVED', 'PUBLISHED'] },
    },
  })
  let created = 0
  for (const caption of captions) {
    const posts = await createSocialDraftsForDerived(caption.id, caption.content, opts)
    created += posts.length
  }
  return { captions: captions.length, draftsCreated: created }
}

/** Facebook post rows for approved captions (metadata.platform TWITTER olsa bile). */
export async function backfillFacebookDraftsFromCaptions(opts: { skipImages?: boolean } = {}) {
  const fbAccount = await prisma.socialMediaAccount.findFirst({
    where: {
      platform: 'FACEBOOK',
      isActive: true,
      NOT: { accountId: { startsWith: 'dryrun_' } },
    },
  })
  if (!fbAccount) return { created: 0, reason: 'no_oauth_facebook_account' as const }

  const captions = await prisma.derivedContent.findMany({
    where: {
      contentType: 'SOCIAL_CAPTION',
      status: { in: ['APPROVED', 'PUBLISHED'] },
    },
  })

  let created = 0
  for (const caption of captions) {
    const existing = await prisma.socialMediaPost.findFirst({
      where: { derivedContentId: caption.id, accountId: fbAccount.id },
    })
    if (existing) continue

    const mediaUrls =
      !opts.skipImages ? await ensureGeneratedPostImage(caption.id) : []

    await prisma.socialMediaPost.create({
      data: {
        derivedContentId: caption.id,
        accountId: fbAccount.id,
        platform: 'FACEBOOK',
        postContent: caption.content,
        mediaUrls,
        status: 'DRAFT',
      },
    })
    created += 1
  }

  return { created, account: fbAccount.accountName }
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
    const videoTypes = ['VIDEO_SCRIPT', 'SHORT_VIDEO_SCRIPT'] as const

    if (socialTypes.includes(derived.contentType as (typeof socialTypes)[number])) {
      await createSocialDraftsForDerived(derived.id, derived.content)
      if (process.env.SOCIAL_AUTO_PUBLISH === 'true' && derived.contentType === 'SOCIAL_CAPTION') {
        await publishCaptionWithImages(derived.id)
      } else if (derived.contentType === 'SOCIAL_CAPTION') {
        const { afterCaptionApproved } = await import('./social/autopilot')
        await afterCaptionApproved(derived.id)
      }
    }

    if (videoTypes.includes(derived.contentType as (typeof videoTypes)[number])) {
      await createSocialDraftsForDerived(derived.id, derived.content)
      const { afterVideoApproved } = await import('./social/autopilot')
      await afterVideoApproved(derived.id)
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
  wpDraftsSent: number
  errors: string[]
}

/** Approve/reject many derivatives; optional podcast/image generation on approve. */
export async function bulkSetDerivedStatus(
  ids: string[],
  status: 'APPROVED' | 'REJECTED',
  options: { autoMedia?: boolean; autoWpDraft?: boolean } = {},
): Promise<BulkStatusResult> {
  const result: BulkStatusResult = {
    processed: 0,
    approved: 0,
    rejected: 0,
    draftsCreated: 0,
    mediaGenerated: 0,
    wpDraftsSent: 0,
    errors: [],
  }

  for (const id of ids) {
    try {
      const existing = await prisma.derivedContent.findUnique({
        where: { id },
        select: { metadata: true, contentType: true, status: true },
      })
      if (!existing) {
        result.errors.push(`${id}: bulunamadı`)
        continue
      }
      if (readReviewFault(existing.metadata).fault) {
        result.errors.push(`${id}: Arı kuyruğunda — toplu onay atlandı`)
        continue
      }

      if (
        status === 'APPROVED' &&
        options.autoMedia &&
        isServerlessRuntime() &&
        VIDEO_FAULT_TYPES.has(existing.contentType)
      ) {
        const msg = 'Video — prod/Vercel\'de üretilemez; Arı kuyruğuna alındı (yerel npm run dev)'
        await markReviewFault(id, msg)
        result.errors.push(`${id}: ${msg}`)
        continue
      }

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
            await ensureGeneratedPostMedia(id)
            result.mediaGenerated += 1
            try {
              const { generateAiImageVariations } = await import('./image/generateAiImage')
              await generateAiImageVariations(id, 2)
              result.mediaGenerated += 1
            } catch (err) {
              const msg = `AI gorsel - ${err instanceof Error ? err.message : String(err)}`
              await markReviewFault(id, msg)
              result.errors.push(`${id}: ${msg}`)
            }
          }
          if (derived.contentType === 'MARCH_LYRICS' || derived.contentType === 'SONG_LYRICS') {
            try {
              const { generateSongAudio } = await import('./media/generateSong')
              await generateSongAudio(id)
              result.mediaGenerated += 1
            } catch (err) {
              const msg = `Sarki sesi - ${err instanceof Error ? err.message : String(err)}`
              await markReviewFault(id, msg)
              result.errors.push(`${id}: ${msg}`)
            }
          }
          if (derived.contentType === 'VIDEO_SCRIPT' || derived.contentType === 'SHORT_VIDEO_SCRIPT') {
            if (isServerlessRuntime()) {
              const msg = "Video — Vercel'de atlandı; yerel npm run dev ile üretin"
              await reopenReviewWithFault(id, msg)
              result.approved -= 1
              result.errors.push(`${id}: ${msg}`)
            } else {
              try {
                const { ensureGeneratedVideo } = await import('./social/publishVideo')
                await ensureGeneratedVideo(id)
                result.mediaGenerated += 1
              } catch (err) {
                const msg = `Video - ${err instanceof Error ? err.message : String(err)}`
                await reopenReviewWithFault(id, msg)
                result.approved -= 1
                result.errors.push(`${id}: ${msg}`)
              }
            }
          }
        }

        if (options.autoWpDraft && WP_DRAFT_TYPES.has(derived.contentType)) {
          try {
            const { sendDerivedToWordPressDraft } = await import('./wordpress/sendDraft')
            const wp = await sendDerivedToWordPressDraft(id)
            if (wp.publish?.success) result.wpDraftsSent += 1
            else if (!wp.skipped) {
              result.errors.push(
                `${id}: WP draft - ${wp.publish?.errorMessage || wp.validation?.reason || 'başarısız'}`,
              )
            }
          } catch (err) {
            result.errors.push(`${id}: WP draft - ${err instanceof Error ? err.message : String(err)}`)
          }
        }
      } else {
        result.rejected += 1
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`${id}: ${msg}`)
      await markReviewFault(id, msg).catch(() => {})
    }
  }

  for (const line of result.errors) {
    const parsed = faultMessageFromBulkError(line)
    if (parsed && isStorageOrVideoFault(parsed.message)) {
      await reopenReviewWithFault(parsed.id, parsed.message).catch(() => {})
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

/** Publish DRAFT/FAILED social posts. Dry-run accounts skipped by default (mock IDs only). */
export async function bulkPublishDraftPosts(
  options: { includeDryRun?: boolean; platform?: import('@prisma/client').SocialPlatform; limit?: number } = {},
): Promise<BulkPublishResult> {
  const posts = await prisma.socialMediaPost.findMany({
    where: {
      status: { in: ['DRAFT', 'FAILED'] },
      ...(options.platform ? { platform: options.platform } : {}),
    },
    include: { account: true },
    orderBy: { createdAt: 'asc' },
  })

  const result: BulkPublishResult = { attempted: 0, published: 0, skipped: 0, failed: 0, errors: [] }
  const { publishPost } = await import('./social/publish')
  const maxAttempts = options.limit && options.limit > 0 ? options.limit : undefined
  // Meta spam/rate limits: pause between Facebook/IG publishes
  const metaGapMs = metaBulkPublishGapMs()

  for (const post of posts) {
    if (maxAttempts != null && result.attempted >= maxAttempts) break
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

    if (
      result.attempted > 0 &&
      metaGapMs > 0 &&
      (post.platform === 'FACEBOOK' || post.platform === 'INSTAGRAM')
    ) {
      await new Promise((r) => setTimeout(r, metaGapMs))
    }

    result.attempted += 1
    try {
      await ensurePrismaConnected()
      await preparePostForPublish(post.id)
      const r = await publishPost(post.id, { requireImage: post.platform === 'LINKEDIN' })
      if (r.skipped) {
        result.skipped += 1
      } else {
        result.published += 1
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (isPrismaConnectionError(err)) {
        try {
          await ensurePrismaConnected()
          await preparePostForPublish(post.id)
          const r = await publishPost(post.id, { requireImage: post.platform === 'LINKEDIN' })
          if (r.skipped) result.skipped += 1
          else result.published += 1
          continue
        } catch (retryErr) {
          result.failed += 1
          result.errors.push(
            `${post.platform} ${post.id.slice(0, 8)}: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
          )
          continue
        }
      }
      result.failed += 1
      result.errors.push(`${post.platform} ${post.id.slice(0, 8)}: ${msg}`)
      // Meta temporary spam block — stop this batch early
      if (/belirli bir süre|spam|rate.?limit|#4\b|code.?4/i.test(msg)) {
        result.errors.push('Meta hız limiti — batch durdu; 30–60 dk sonra tekrar deneyin')
        break
      }
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
