import { Queue, Worker, type JobsOptions } from 'bullmq'
import IORedis from 'ioredis'

const QUEUE_PIPELINE = 'content-pipeline'
const QUEUE_SOCIAL = 'social-publishing'

let connection: IORedis | null = null

function redisEnabled(): boolean {
  const url = process.env.REDIS_URL
  return Boolean(url && url.trim().length > 0)
}

function redisUrl(): string {
  return process.env.REDIS_URL?.trim() || 'redis://localhost:6380'
}

export function getRedis(): IORedis {
  if (!connection) {
    connection = new IORedis(redisUrl(), {
      maxRetriesPerRequest: null,
      connectTimeout: 3000,
      lazyConnect: true,
    })
  }
  return connection
}

function pipelineQueue() {
  return new Queue(QUEUE_PIPELINE, { connection: getRedis() })
}

function socialQueue() {
  return new Queue(QUEUE_SOCIAL, { connection: getRedis() })
}

/** Enqueue pipeline processing. Skipped when REDIS_URL empty (Supabase-only mode). */
export async function enqueuePipelineJob(pipelineId: string): Promise<void> {
  if (!redisEnabled()) return
  try {
    const q = pipelineQueue()
    await getRedis().connect()
    await q.add(
      'process-pipeline',
      { pipelineId },
      { attempts: 3, removeOnComplete: 100, removeOnFail: 50 } satisfies JobsOptions,
    )
  } catch (err) {
    console.warn('[queue] Redis enqueue skipped (pipeline)', err)
  }
}

export async function enqueuePublishJob(postId: string, scheduledAt?: Date): Promise<void> {
  if (!redisEnabled()) return
  try {
    const delay = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0
    const q = socialQueue()
    await getRedis().connect()
    await q.add(
      'publish-post',
      { postId },
      { attempts: 3, delay, removeOnComplete: 100, removeOnFail: 50 },
    )
  } catch (err) {
    console.warn('[queue] Redis enqueue skipped (publish)', err)
  }
}

export function startWorkers() {
  if (!redisEnabled()) {
    console.log('[worker] REDIS_URL empty — BullMQ disabled; DB poll only')
    return null
  }
  const pipelineWorker = new Worker(
    QUEUE_PIPELINE,
    async (job) => {
      const { processPipeline } = await import('./pipeline')
      const { pipelineId } = job.data as { pipelineId: string }
      return processPipeline(pipelineId)
    },
    { connection: getRedis(), concurrency: 2 },
  )

  const socialWorker = new Worker(
    QUEUE_SOCIAL,
    async (job) => {
      const { publishPost } = await import('./social/publish')
      const { preparePostForPublish } = await import('./social/preparePublish')
      const { postId } = job.data as { postId: string }
      await preparePostForPublish(postId)
      return publishPost(postId, { requireImage: true })
    },
    { connection: getRedis(), concurrency: 3 },
  )

  pipelineWorker.on('failed', (job, err) => {
    console.error('[worker:pipeline]', job?.id, err.message)
  })
  socialWorker.on('failed', (job, err) => {
    console.error('[worker:social]', job?.id, err.message)
  })

  console.log('[worker] pipeline + social started')
  return { pipelineWorker, socialWorker }
}

/** Fallback: process PENDING PROCESS_PIPELINE jobs from DB when Redis empty */
export async function drainDbPipelineJobs(limit = 5) {
  const { processPipeline } = await import('./pipeline')
  const { prisma } = await import('./prisma')
  const jobs = await prisma.queueJob.findMany({
    where: { status: 'PENDING', jobType: 'PROCESS_PIPELINE', scheduledAt: { lte: new Date() } },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: limit,
  })

  for (const job of jobs) {
    await prisma.queueJob.update({
      where: { id: job.id },
      data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
    })
    try {
      const payload = job.payload as { pipelineId?: string }
      if (!payload.pipelineId) throw new Error('missing pipelineId')
      const result = await processPipeline(payload.pipelineId)
      await prisma.queueJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', completedAt: new Date(), result },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await prisma.queueJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', failedAt: new Date(), error: message },
      })
    }
  }
  return jobs.length
}

/** Fallback: process PENDING PUBLISH_SOCIAL_POST jobs when Redis empty or worker DB-only. */
export async function drainDbPublishJobs(limit = 5) {
  const { publishPost } = await import('./social/publish')
  const { preparePostForPublish, recoverStuckPublishing, isDryRunAccount } = await import(
    './social/preparePublish',
  )
  const { prisma } = await import('./prisma')

  await recoverStuckPublishing()

  const jobs = await prisma.queueJob.findMany({
    where: {
      status: 'PENDING',
      jobType: 'PUBLISH_SOCIAL_POST',
      scheduledAt: { lte: new Date() },
    },
    orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
    take: limit,
  })

  for (const job of jobs) {
    await prisma.queueJob.update({
      where: { id: job.id },
      data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
    })
    try {
      const payload = job.payload as { postId?: string }
      if (!payload.postId) throw new Error('missing postId')

      const post = await prisma.socialMediaPost.findUnique({
        where: { id: payload.postId },
        include: { account: true },
      })
      if (!post) throw new Error('post not found')
      if (!post.account.isActive || isDryRunAccount(post.account)) {
        await prisma.queueJob.update({
          where: { id: job.id },
          data: { status: 'COMPLETED', completedAt: new Date(), result: { skipped: true } },
        })
        continue
      }

      await preparePostForPublish(payload.postId)
      const result = await publishPost(payload.postId, {
        requireImage: post.platform === 'LINKEDIN',
      })
      await prisma.queueJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', completedAt: new Date(), result },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await prisma.queueJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', failedAt: new Date(), error: message },
      })
    }
  }
  return jobs.length
}
