import { NextRequest, NextResponse } from 'next/server'
import { formatWorkerTickSummary, runWorkerTick } from '@/lib/worker/runWorkerTick'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Vercel Cron (Hobby: 1×/gün) — CRON_SECRET ile korunur. Worker process gerekmez. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET tanımlı değil' }, { status: 503 })
  }

  const auth = req.headers.get('authorization') || ''
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runWorkerTick({ profile: 'daily' })
    return NextResponse.json({
      ok: result.errors.length === 0,
      summary: formatWorkerTickSummary(result),
      result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/cron/daily]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
