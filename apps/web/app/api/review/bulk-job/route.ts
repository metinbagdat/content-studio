import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import {
  cancelReviewBulkJob,
  createReviewBulkJob,
  getActiveReviewBulkJob,
  getReviewBulkJob,
  pauseReviewBulkJob,
  resumeReviewBulkJob,
  tickReviewBulkJob,
  toPublicBulkJob,
} from '@/lib/review/bulkJob'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const job = await getReviewBulkJob(id)
    if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ job: toPublicBulkJob(job) })
  }
  const active = await getActiveReviewBulkJob()
  return NextResponse.json({ job: active ? toPublicBulkJob(active) : null })
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')

  try {
    if (action === 'create') {
      const bulkAction = body.bulkAction === 'REJECT' ? 'REJECT' : 'APPROVE'
      const itemIds = Array.isArray(body.itemIds) ? body.itemIds.map(String).filter(Boolean) : []
      if (!itemIds.length) {
        return NextResponse.json({ error: 'itemIds[] required' }, { status: 400 })
      }
      const job = await createReviewBulkJob({
        action: bulkAction,
        itemIds,
        autoMedia: Boolean(body.autoMedia),
        autoWpDraft: Boolean(body.autoWpDraft),
        scopeFilter: String(body.scopeFilter || 'ALL'),
      })
      return NextResponse.json({ job: toPublicBulkJob(job) }, { status: 201 })
    }

    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    if (action === 'tick') {
      const existing = await getReviewBulkJob(id)
      if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
      if (existing.status === 'PENDING' || existing.status === 'PAUSED') {
        await resumeReviewBulkJob(id)
      }
      const { job, done } = await tickReviewBulkJob(id)
      return NextResponse.json({ job: toPublicBulkJob(job), done })
    }

    if (action === 'pause') {
      const job = await pauseReviewBulkJob(id)
      return NextResponse.json({ job: toPublicBulkJob(job) })
    }

    if (action === 'cancel') {
      const job = await cancelReviewBulkJob(id)
      return NextResponse.json({ job: toPublicBulkJob(job) })
    }

    if (action === 'resume') {
      const job = await resumeReviewBulkJob(id)
      return NextResponse.json({ job: toPublicBulkJob(job) })
    }

    return NextResponse.json(
      { error: 'action=create|tick|pause|cancel|resume required' },
      { status: 400 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
