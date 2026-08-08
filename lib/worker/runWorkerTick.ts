import { drainDbPipelineJobs, drainDbPublishJobs } from '../queue'
import { runContentDiscovery, type DiscoveryResult } from '../discovery/contentDiscovery'
import { runScheduledAnalyticsSync, type AnalyticsSyncResult } from '../social/analyticsCron'
import { runSocialAutopilot, type AutopilotResult } from '../social/autopilot'
import { drainDuePosts } from '../social/publish'
import { syncSocialDraftsFromApprovedCaptions } from '../pipeline'
import { repairMissingSocialAccounts } from '../social/accountAudit'

export type WorkerTickProfile = 'quick' | 'daily' | 'full'

export type WorkerTickOptions = {
  profile?: WorkerTickProfile
  /** Override discovery ingest limit (daily default: 2) */
  discoveryLimit?: number
}

export type WorkerTickResult = {
  profile: WorkerTickProfile
  pipelineJobs: number
  publishJobs: number
  duePostsPublished: number
  draftsSynced: number
  autopilot: AutopilotResult | null
  analytics: AnalyticsSyncResult | null
  discovery: DiscoveryResult | null
  errors: string[]
  ranAt: string
  durationMs: number
}

/** Same logic as `workers/index.ts` — callable from admin API or Vercel cron (no 7/24 process). */
export async function runWorkerTick(options: WorkerTickOptions = {}): Promise<WorkerTickResult> {
  const started = Date.now()
  const profile = options.profile || 'daily'
  const errors: string[] = []

  let pipelineJobs = 0
  let publishJobs = 0
  let duePostsPublished = 0
  let draftsSynced = 0
  let autopilot: AutopilotResult | null = null
  let analytics: AnalyticsSyncResult | null = null
  let discovery: DiscoveryResult | null = null

  const runPipeline = profile !== 'quick'
  const runDiscovery = profile === 'daily' || profile === 'full'

  if (runPipeline) {
    try {
      pipelineJobs = await drainDbPipelineJobs(profile === 'full' ? 3 : 2)
    } catch (err) {
      errors.push(`pipeline: ${err instanceof Error ? err.message : String(err)}`)
    }
    try {
      publishJobs = await drainDbPublishJobs(profile === 'full' ? 5 : 3)
    } catch (err) {
      errors.push(`publishQueue: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  try {
    duePostsPublished = await drainDuePosts(profile === 'full' ? 10 : 5)
  } catch (err) {
    errors.push(`duePosts: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (profile === 'quick') {
    /* quick = scheduled publish only */
  } else if (profile === 'daily') {
    try {
      await repairMissingSocialAccounts()
      const sync = await syncSocialDraftsFromApprovedCaptions({ skipImages: true })
      draftsSynced = sync.draftsCreated
    } catch (err) {
      errors.push(`drafts: ${err instanceof Error ? err.message : String(err)}`)
    }
    try {
      analytics = await runScheduledAnalyticsSync()
    } catch (err) {
      errors.push(`analytics: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (runDiscovery) {
      try {
        const limit = options.discoveryLimit ?? Number(process.env.DISCOVERY_DAILY_LIMIT || 2)
        discovery = await runContentDiscovery({ limit, triggerPipeline: true })
      } catch (err) {
        errors.push(`discovery: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  } else {
    try {
      autopilot = await runSocialAutopilot(8)
      draftsSynced = autopilot.draftsSynced
      if (autopilot.errors.length) errors.push(...autopilot.errors.slice(0, 5))
    } catch (err) {
      errors.push(`autopilot: ${err instanceof Error ? err.message : String(err)}`)
    }
    try {
      analytics = await runScheduledAnalyticsSync()
    } catch (err) {
      errors.push(`analytics: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (runDiscovery) {
      try {
        const limit = options.discoveryLimit ?? Number(process.env.DISCOVERY_DAILY_LIMIT || 3)
        discovery = await runContentDiscovery({ limit, triggerPipeline: true })
      } catch (err) {
        errors.push(`discovery: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  return {
    profile,
    pipelineJobs,
    publishJobs,
    duePostsPublished,
    draftsSynced,
    autopilot,
    analytics,
    discovery,
    errors,
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - started,
  }
}

export function formatWorkerTickSummary(result: WorkerTickResult): string {
  const parts = [
    `profil: ${result.profile}`,
    `zamanlanmış yayın: ${result.duePostsPublished}`,
    `taslak: +${result.draftsSynced}`,
  ]
  if (result.analytics) {
    parts.push(`metrik hesap: ${result.analytics.accountsSynced}, post: ${result.analytics.postsSynced}`)
  }
  if (result.discovery) {
    parts.push(`discovery: ${result.discovery.newArticles} yeni`)
  }
  if (result.autopilot) {
    parts.push(`autopilot yayın: ${result.autopilot.published}, retry: ${result.autopilot.retried}`)
  }
  parts.push(`${Math.round(result.durationMs / 1000)}s`)
  return parts.join(' · ')
}
