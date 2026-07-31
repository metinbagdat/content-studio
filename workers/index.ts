import { startWorkers, drainDbPipelineJobs } from '../lib/queue'
import { drainDuePosts } from '../lib/social/publish'
import { startDiscoveryCron } from '../lib/discovery/discoveryCron'

async function main() {
  console.log('[content-studio worker] starting…')
  try {
    startWorkers()
  } catch (err) {
    console.warn('[worker] BullMQ start failed; using DB poll only', err)
  }

  // Phase 0: daily sitemap discovery at 06:00 Europe/Istanbul
  startDiscoveryCron()

  setInterval(() => {
    drainDbPipelineJobs(3).catch((e) => console.error(e))
    drainDuePosts(5).catch((e) => console.error(e))
  }, 15_000)

  await drainDbPipelineJobs(5)
  await drainDuePosts(5)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
