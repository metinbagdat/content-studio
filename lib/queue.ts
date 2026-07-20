import { Queue, Worker, type JobsOptions } from 'bullmq'
import IORedis from 'ioredis'

const QUEUE_PIPELINE = 'content-pipeline'
const QUEUE_SOCIAL = 'social-publishing'

let connection: IORedis | null = null

function redisUrl(): string {
  return process.env.REDIS_URL || 'redis://localhost:6380'
}

export function getRedis(): IORedis {
  if (!connection) {
    connection = new IORedis(redisUrl(), { maxRetriesPerRequest: null })
  }
  return connection
}

function pipelineQueue() {
  return new Queue(QUEUE_PIPELINE, { connection: getRedis() })
}

function socialQueue() {
  return new Queue(QUEUE_SOCIAL, { connection: getRedis() })
}

/** Enqueue pipeline processing. If Redis is down, DB QueueJob still exists for poll fallback. */
export async function enqueuePipelineJob(pipelineId: string): Promise<void> {
  try {
    await pipelineQueue().add(
      'process-pipeline',
      { pipelineId },
      { attempts: 3, removeOnComplete: 100, removeOnFail: 50 } satisfies JobsOptions,
    )
  } catch (err) {
    console.warn('[queue] Redis enqueue failed (pipeline); worker poll can pick DB job', err)
  }
}

export async function enqueuePublishJob(postId: string, scheduledAt?: Date): Promise<void> {
  try {
    const delay = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0
    await socialQueue().add(
      'publish-post',
      { postId },
      { attempts: 3, delay, removeOnComplete: 100, removeOnFail: 50 },
    )
  } catch (err) {
    console.warn('[queue] Redis enqueue failed (publish)', err)
  }
}

export function startWorkers() {
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
      const { postId } = job.data as { postId: string }
      return publishPost(postId)
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
