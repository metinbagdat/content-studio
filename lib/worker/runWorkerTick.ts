import { drainDbPipelineJobs, drainDbPublishJobs } from '../queue'
import { runContentDiscovery, type DiscoveryResult } from '../discovery/contentDiscovery'
import { runHpvOpportunityScan, type HpvScanResult } from '../seo/hpvCron'
import { runScheduledAnalyticsSync, type AnalyticsSyncResult } from '../social/analyticsCron'
import { runSocialAutopilot, type AutopilotResult } from '../social/autopilot'
import { drainDuePosts } from '../social/publish'
import { syncSocialDraftsFromApprovedCaptions } from '../pipeline'
import { repairMissingSocialAccounts } from '../social/accountAudit'

export type WorkerTickProfile = 'quick' | 'maintain' | 'daily' | 'full'

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
  hpv: HpvScanResult | null
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
  let hpv: HpvScanResult | null = null

  const drainPipeline = profile !== 'quick'
  const runDraftRepair = profile === 'daily' || profile === 'maintain'
  const runAutopilot = profile === 'full' || profile === 'maintain'
  const runAnalytics =
    (profile === 'daily' || profile === 'full') && process.env.ANALYTICS_SYNC_ENABLED !== 'false'
  const runDiscovery =
    (profile === 'daily' || profile === 'full') && process.env.DISCOVERY_CRON_ENABLED !== 'false'
  const runHpv =
    (profile === 'daily' || profile === 'full') && process.env.HPV_CRON_ENABLED !== 'false'

  try {
    publishJobs = await drainDbPublishJobs(profile === 'quick' ? 3 : profile === 'full' ? 5 : 3)
  } catch (err) {
    errors.push(`publishQueue: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (drainPipeline) {
    try {
      pipelineJobs = await drainDbPipelineJobs(profile === 'full' ? 3 : 2)
    } catch (err) {
      errors.push(`pipeline: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  try {
    duePostsPublished = await drainDuePosts(profile === 'full' ? 10 : 5)
  } catch (err) {
    errors.push(`duePosts: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (runDraftRepair) {
    try {
      await repairMissingSocialAccounts()
      const sync = await syncSocialDraftsFromApprovedCaptions({ skipImages: true })
      draftsSynced = sync.draftsCreated
    } catch (err) {
      errors.push(`drafts: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (runAutopilot && process.env.SOCIAL_AUTOPILOT !== 'false') {
    try {
      autopilot = await runSocialAutopilot(8)
      draftsSynced = autopilot.draftsSynced
      if (autopilot.errors.length) errors.push(...autopilot.errors.slice(0, 5))
    } catch (err) {
      errors.push(`autopilot: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (runAnalytics) {
    try {
      analytics = await runScheduledAnalyticsSync()
    } catch (err) {
      errors.push(`analytics: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (runDiscovery) {
    try {
      const limit =
        options.discoveryLimit ??
        Number(process.env.DISCOVERY_DAILY_LIMIT || (profile === 'daily' ? 2 : 3))
      discovery = await runContentDiscovery({ limit, triggerPipeline: true })
    } catch (err) {
      errors.push(`discovery: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (runHpv) {
    try {
      hpv = await runHpvOpportunityScan(Number(process.env.HPV_DAILY_LIMIT || 8))
      if (hpv.errors.length) errors.push(...hpv.errors.slice(0, 3))
    } catch (err) {
      errors.push(`hpv: ${err instanceof Error ? err.message : String(err)}`)
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
    hpv,
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
  if (result.hpv) {
    parts.push(`hpv: wp=${result.hpv.taggedWp} sm=${result.hpv.taggedSm} sent=${result.hpv.sent}`)
  }
  if (result.autopilot) {
    parts.push(`autopilot yayın: ${result.autopilot.published}, retry: ${result.autopilot.retried}`)
  }
  parts.push(`${Math.round(result.durationMs / 1000)}s`)
  return parts.join(' · ')
}
