import { startWorkers, drainDbPipelineJobs, drainDbPublishJobs } from '../lib/queue'
import { drainDuePosts } from '../lib/social/publish'
import { startDiscoveryCron } from '../lib/discovery/discoveryCron'
import { startAnalyticsSyncCron } from '../lib/social/analyticsCron'
import { runSocialAutopilot } from '../lib/social/autopilot'

async function main() {
  console.log('[content-studio worker] starting…')
  try {
    startWorkers()
  } catch (err) {
    console.warn('[worker] BullMQ start failed; using DB poll only', err)
  }

  // Phase 0: daily sitemap discovery at 06:00 Europe/Istanbul
  startDiscoveryCron()

  // CS-08: periodic X/LinkedIn stats refresh (default every 3h)
  startAnalyticsSyncCron()

  setInterval(() => {
    runWorkerTick().catch((e) => console.error('[worker tick]', e))
  }, 15_000)

  await runWorkerTick()
}

async function runWorkerTick() {
  await drainDbPipelineJobs(3)
  await drainDbPublishJobs(5)
  await drainDuePosts(5)
  await runSocialAutopilot(8)
}

main().catch((err) => {
  console.error('[worker] fatal startup error', err)
  process.exit(1)
})
