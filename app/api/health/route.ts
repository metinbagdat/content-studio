import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { databaseFingerprint } from '@/lib/env/deployParity'

export const dynamic = 'force-dynamic'

export async function GET() {
  const fp = databaseFingerprint()
  const dbConfigured = Boolean(process.env.DATABASE_URL?.trim())
  let db = 'ok'
  let dbError: string | null = null
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (err) {
    db = 'down'
    const msg = err instanceof Error ? err.message : String(err)
    if (/ECIRCUITBREAKER|too many authentication failures/i.test(msg)) dbError = 'circuit_breaker'
    else if (/Authentication failed|P1000/i.test(msg)) dbError = 'auth_failed'
    else if (/Can't reach|P1001/i.test(msg)) dbError = 'unreachable'
    else if (/timed out|P1002/i.test(msg)) dbError = 'timeout'
    else if (/quota|exceeded|restricted|EMAXCONNSESSION|max clients/i.test(msg)) dbError = 'quota'
    else dbError = 'unknown'
  }
  return NextResponse.json({
    ok: db === 'ok',
    service: 'content-studio',
    brand: process.env.BRAND_URL || 'https://egitim.today',
    db,
    dbError,
    dbConfigured,
    dbFingerprint: fp,
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    time: new Date().toISOString(),
  })
}
