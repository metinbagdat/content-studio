import { prisma } from '../prisma'
import { runContentDiscovery, type DiscoveryResult } from './contentDiscovery'

const IST_OFFSET_MS = 3 * 60 * 60 * 1000
const DISCOVERY_HOUR_IST = 6
const DISCOVERY_MINUTE_IST = 0

/** Milliseconds until the next 06:00 Europe/Istanbul from now. */
export function msUntilNextDiscoveryRun(from = new Date()): number {
  const istNow = new Date(from.getTime() + IST_OFFSET_MS)
  const istYear = istNow.getUTCFullYear()
  const istMonth = istNow.getUTCMonth()
  const istDate = istNow.getUTCDate()
  let targetUtc = Date.UTC(istYear, istMonth, istDate, DISCOVERY_HOUR_IST - 3, DISCOVERY_MINUTE_IST, 0, 0)
  if (targetUtc <= from.getTime()) {
    targetUtc = Date.UTC(istYear, istMonth, istDate + 1, DISCOVERY_HOUR_IST - 3, DISCOVERY_MINUTE_IST, 0, 0)
  }
  return Math.max(0, targetUtc - from.getTime())
}

export type DiscoveryRunOptions = {
  limit?: number
  triggerPipeline?: boolean
}

/** Persist a QueueJob record so admins can see discovery runs in the job log. */
async function logDiscoveryRun(result: DiscoveryResult): Promise<void> {
  try {
    await prisma.queueJob.create({
      data: {
        jobType: 'DISCOVERY_NOTIFICATION',
        status: result.errors.length > 0 && result.newArticles === 0 ? 'FAILED' : 'COMPLETED',
        payload: {
          source: result.source,
          scanned: result.scanned,
        },
        result: {
          newArticles: result.newArticles,
          skippedDuplicates: result.skippedDuplicates,
          skippedHubPages: result.skippedHubPages,
          errors: result.errors,
          ingested: result.ingested,
        },
        error: result.errors.length ? result.errors.join('; ') : null,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    })
  } catch (err) {
    // Never let logging failure break the discovery run itself
    console.error('[discovery] failed to persist QueueJob log', err)
  }
}

/** Run discovery and emit structured logs for admin / ops visibility. */
export async function runScheduledDiscovery(
  options: DiscoveryRunOptions = {},
): Promise<DiscoveryResult> {
  const limit = options.limit ?? Number(process.env.DISCOVERY_DAILY_LIMIT || 3)
  const triggerPipeline = options.triggerPipeline ?? true

  console.log('[discovery] scheduled run starting', {
    limit,
    triggerPipeline,
    at: new Date().toISOString(),
  })

  const result = await runContentDiscovery({ limit, triggerPipeline })

  console.log('[discovery] run complete', {
    scanned: result.scanned,
    newArticles: result.newArticles,
    skippedDuplicates: result.skippedDuplicates,
    errors: result.errors.length,
    ingested: result.ingested.map((i) => ({ slug: i.slug, sourceId: i.sourceId, title: i.title })),
  })

  if (result.errors.length) {
    console.warn('[discovery] errors', result.errors)
  }

  if (result.newArticles > 0) {
    console.log(
      `[discovery] ${result.newArticles} new article(s) ingested — pipeline(s) queued`,
    )
  }

  await logDiscoveryRun(result)

  return result
}

let discoveryTimer: ReturnType<typeof setTimeout> | null = null
let discoveryRunning = false

function scheduleNextDiscoveryRun(runNow = false): void {
  if (discoveryTimer) clearTimeout(discoveryTimer)
  const delay = runNow ? 0 : msUntilNextDiscoveryRun()
  const nextAt = new Date(Date.now() + delay)
  console.log('[discovery] next run scheduled', {
    nextAt: nextAt.toISOString(),
    delayMs: delay,
    hourIst: `${DISCOVERY_HOUR_IST}:${String(DISCOVERY_MINUTE_IST).padStart(2, '0')}`,
  })
  discoveryTimer = setTimeout(async () => {
    if (discoveryRunning) {
      scheduleNextDiscoveryRun()
      return
    }
    discoveryRunning = true
    try {
      await runScheduledDiscovery()
    } catch (err) {
      console.error('[discovery] scheduled run failed', err)
    } finally {
      discoveryRunning = false
      scheduleNextDiscoveryRun()
    }
  }, delay)
}

/** Start daily 06:00 IST discovery; optionally run once on worker boot. */
export function startDiscoveryCron(options: { runOnStart?: boolean } = {}): void {
  if (process.env.DISCOVERY_CRON_ENABLED === 'false') {
    console.log('[discovery] cron disabled (DISCOVERY_CRON_ENABLED=false)')
    return
  }
  const runOnStart = options.runOnStart ?? process.env.DISCOVERY_RUN_ON_START === 'true'
  scheduleNextDiscoveryRun(runOnStart)
}