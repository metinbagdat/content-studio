import { startWorkers } from '../../../lib/queue'
import { startDiscoveryCron } from '../../../lib/discovery/discoveryCron'
import { startAnalyticsSyncCron } from '../../../lib/social/analyticsCron'
import { assertLocalSupabaseEgressAllowed } from '../../../lib/prisma'
import { runWorkerTick } from '../../../lib/worker/runWorkerTick'

function wantsDrain(): boolean {
  return process.argv.includes('--drain') || process.env.WORKER_MODE === 'drain'
}

async function refuseSupabaseIfNeeded(): Promise<void> {
  try {
    assertLocalSupabaseEgressAllowed()
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

async function drainUntilIdle(): Promise<void> {
  console.log('[worker] drain mode — process queued jobs, then exit')
  const maxTicks = Math.max(1, Number(process.env.WORKER_DRAIN_MAX_TICKS || 20))
  for (let i = 0; i < maxTicks; i++) {
    const r = await runWorkerTick({ profile: 'drain' })
    const busy = r.pipelineJobs + r.publishJobs + r.duePostsPublished
    console.log('[worker drain]', `${i + 1}/${maxTicks}`, formatShort(r), `busy=${busy}`)
    if (r.errors.length) console.warn('[worker drain] errors', r.errors.slice(0, 5))
    if (busy === 0) {
      console.log('[worker] idle — exiting')
      return
    }
  }
  console.log('[worker] max ticks reached — exiting (jobs may remain)')
}

async function main() {
  console.log('[content-studio worker] starting…')
  await refuseSupabaseIfNeeded()

  if (wantsDrain()) {
    await drainUntilIdle()
    return
  }

  try {
    startWorkers()
  } catch (err) {
    console.warn('[worker] BullMQ start failed; using DB poll only', err)
  }

  startDiscoveryCron()
  startAnalyticsSyncCron()

  setInterval(() => {
    runWorkerTick({ profile: 'quick' })
      .then((r) => console.log('[worker tick]', r.profile, formatShort(r)))
      .catch((e) => console.error('[worker tick]', e))
  }, 15_000)

  const maintainMs = Math.max(5, Number(process.env.WORKER_MAINTAIN_INTERVAL_MINUTES || 10)) * 60_000
  setInterval(() => {
    runWorkerTick({ profile: 'maintain' })
      .then((r) => console.log('[worker maintain]', r.profile, formatShort(r)))
      .catch((e) => console.error('[worker maintain]', e))
  }, maintainMs)

  const first = await runWorkerTick({ profile: 'quick' })
  console.log('[worker tick] initial', formatShort(first))
}

function formatShort(r: Awaited<ReturnType<typeof runWorkerTick>>): string {
  return `due=${r.duePostsPublished} pipe=${r.pipelineJobs} pubq=${r.publishJobs} drafts=+${r.draftsSynced} err=${r.errors.length}`
}

main().catch((err) => {
  console.error('[worker] fatal startup error', err)
  process.exit(1)
})
