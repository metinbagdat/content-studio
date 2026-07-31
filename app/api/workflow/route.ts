import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getWorkflowSnapshot } from '@/lib/workflow/status'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const snapshot = await getWorkflowSnapshot()
  return NextResponse.json(snapshot)
}
