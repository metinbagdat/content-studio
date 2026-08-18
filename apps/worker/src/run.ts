import { startWorkers } from '../../../lib/queue'
import { startDiscoveryCron } from '../../../lib/discovery/discoveryCron'
import { startAnalyticsSyncCron } from '../../../lib/social/analyticsCron'
import { isSupabaseDatabaseUrl } from '../../../lib/prisma'
import { runWorkerTick } from '../../../lib/worker/runWorkerTick'

async function main() {
  console.log('[content-studio worker] starting…')
  if (isSupabaseDatabaseUrl()) {
    console.warn(
      '[egress] Worker → Supabase. 15s loop is quick-only (due posts). Analytics/discovery use their own crons. For zero Hobby egress use local Docker Postgres (localhost:5434).',
    )
  }
  try {
    startWorkers()
  } catch (err) {
    console.warn('[worker] BullMQ start failed; using DB poll only', err)
  }

  // Phase 0: daily sitemap discovery at 06:00 Europe/Istanbul
  startDiscoveryCron()

  // CS-08: periodic stats refresh (default every 3h) — not every 15s
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
  return `due=${r.duePostsPublished} drafts=+${r.draftsSynced} err=${r.errors.length}`
}

main().catch((err) => {
  console.error('[worker] fatal startup error', err)
  process.exit(1)
})
