import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { databaseFingerprint } from '@/lib/env/deployParity'

export const dynamic = 'force-dynamic'

export async function GET() {
  const fp = databaseFingerprint()
  const dbConfigured = Boolean(process.env.DATABASE_URL?.trim())
  let db = 'ok'
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    db = 'down'
  }
  return NextResponse.json({
    ok: db === 'ok',
    service: 'content-studio',
    brand: process.env.BRAND_URL || 'https://egitim.today',
    db,
    dbConfigured,
    dbFingerprint: fp,
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    time: new Date().toISOString(),
  })
}
