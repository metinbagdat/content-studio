import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { formatWorkerTickSummary, runWorkerTick, type WorkerTickProfile } from '@/lib/worker/runWorkerTick'

export const dynamic = 'force-dynamic'
/** Vercel Hobby: daily tick should finish under ~60s; full profile may need local worker. */
export const maxDuration = 60

const PROFILES: WorkerTickProfile[] = ['quick', 'maintain', 'daily', 'full']

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const profile = String(body.profile || 'daily') as WorkerTickProfile
  if (!PROFILES.includes(profile)) {
    return NextResponse.json({ error: 'profile quick|maintain|daily|full' }, { status: 400 })
  }

  const discoveryLimit = body.discoveryLimit != null ? Number(body.discoveryLimit) : undefined

  try {
    const result = await runWorkerTick({ profile, discoveryLimit })
    return NextResponse.json({
      ok: result.errors.length === 0,
      summary: formatWorkerTickSummary(result),
      result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/worker/tick]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
