import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const onVercel = process.env.VERCEL === '1'
  const cronEnabled = false
  return NextResponse.json({
    mode: onVercel ? 'serverless' : 'local',
    workerProcessRequired: false,
    recommendedProfile: 'daily',
    cronEnabled,
    cronSchedule: null,
    cronNote: onVercel
      ? 'Vercel cron kapalı (Hobby egress). Admin butonları veya local worker.'
      : 'Zamanlanmış yayın: npm run worker veya aşağıdaki butonlar. Discovery/analytics local worker cron’unda.',
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100',
  })
}
