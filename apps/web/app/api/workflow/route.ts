import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getWorkflowSnapshot } from '@/lib/workflow/status'
import { runWorkflowContinueStep } from '@/lib/workflow/runContinueStep'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const snapshot = await getWorkflowSnapshot()
  return NextResponse.json(snapshot)
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runWorkflowContinueStep()
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/workflow]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
