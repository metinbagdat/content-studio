import { syncAllAccountStats, syncAllPublishedPostAnalytics } from './platformStats'

export type AnalyticsSyncResult = {
  accountsSynced: number
  accountErrors: string[]
  postsSynced: number
  postErrors: string[]
}

/** Refresh X/LinkedIn account + published-post stats. Safe to call often — dry-run accounts skip real API calls. */
export async function runScheduledAnalyticsSync(): Promise<AnalyticsSyncResult> {
  console.log('[analytics] scheduled sync starting', { at: new Date().toISOString() })

  const accounts = await syncAllAccountStats()
  const posts = await syncAllPublishedPostAnalytics(50)

  console.log('[analytics] sync complete', {
    accountsSynced: accounts.synced,
    accountErrors: accounts.errors.length,
    postsSynced: posts.synced,
    postErrors: posts.errors.length,
  })
  if (accounts.errors.length) console.warn('[analytics] account errors', accounts.errors)
  if (posts.errors.length) console.warn('[analytics] post errors', posts.errors)

  return {
    accountsSynced: accounts.synced,
    accountErrors: accounts.errors,
    postsSynced: posts.synced,
    postErrors: posts.errors,
  }
}

let analyticsTimer: ReturnType<typeof setInterval> | null = null
let analyticsRunning = false

async function tick(): Promise<void> {
  if (analyticsRunning) return
  analyticsRunning = true
  try {
    await runScheduledAnalyticsSync()
  } catch (err) {
    console.error('[analytics] scheduled sync failed', err)
  } finally {
    analyticsRunning = false
  }
}

/** Periodic X/LinkedIn stats refresh (default every 3h). Disable with ANALYTICS_SYNC_ENABLED=false. */
export function startAnalyticsSyncCron(options: { runOnStart?: boolean } = {}): void {
  if (process.env.ANALYTICS_SYNC_ENABLED === 'false') {
    console.log('[analytics] cron disabled (ANALYTICS_SYNC_ENABLED=false)')
    return
  }

  const intervalMinutes = Number(process.env.ANALYTICS_SYNC_INTERVAL_MINUTES || 180)
  const intervalMs = Math.max(15, intervalMinutes) * 60_000

  console.log('[analytics] cron scheduled', { everyMinutes: Math.round(intervalMs / 60_000) })

  if (analyticsTimer) clearInterval(analyticsTimer)
  analyticsTimer = setInterval(tick, intervalMs)

  const runOnStart = options.runOnStart ?? process.env.ANALYTICS_RUN_ON_START !== 'false'
  if (runOnStart) {
    // Small delay so the worker's other boot logs settle first.
    setTimeout(tick, 20_000)
  }
}
