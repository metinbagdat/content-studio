import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const onVercel = process.env.VERCEL === '1'
  return NextResponse.json({
    mode: onVercel ? 'serverless' : 'local',
    workerProcessRequired: false,
    recommendedProfile: 'daily',
    cronEnabled: Boolean(process.env.CRON_SECRET?.trim()),
    cronSchedule: '0 3 * * *',
    cronNote: '06:00 TR — günlük bakım (zamanlanmış yayın + metrik + discovery)',
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100',
  })
}
