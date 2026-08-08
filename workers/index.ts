import { startWorkers } from '../lib/queue'
import { startDiscoveryCron } from '../lib/discovery/discoveryCron'
import { startAnalyticsSyncCron } from '../lib/social/analyticsCron'
import { runWorkerTick } from '../lib/worker/runWorkerTick'

async function main() {
  console.log('[content-studio worker] starting…')
  try {
    startWorkers()
  } catch (err) {
    console.warn('[worker] BullMQ start failed; using DB poll only', err)
  }

  // Phase 0: daily sitemap discovery at 06:00 Europe/Istanbul
  startDiscoveryCron()

  // CS-08: periodic stats refresh (default every 3h)
  startAnalyticsSyncCron()

  setInterval(() => {
    runWorkerTick({ profile: 'full' })
      .then((r) => console.log('[worker tick]', r.profile, formatShort(r)))
      .catch((e) => console.error('[worker tick]', e))
  }, 15_000)

  const first = await runWorkerTick({ profile: 'full' })
  console.log('[worker tick] initial', formatShort(first))
}

function formatShort(r: Awaited<ReturnType<typeof runWorkerTick>>): string {
  return `due=${r.duePostsPublished} drafts=+${r.draftsSynced} err=${r.errors.length}`
}

main().catch((err) => {
  console.error('[worker] fatal startup error', err)
  process.exit(1)
})
