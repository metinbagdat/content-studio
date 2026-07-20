import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  let db = 'ok'
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    db = 'down'
  }
  return NextResponse.json({
    ok: true,
    service: 'content-studio',
    brand: process.env.BRAND_URL || 'https://egitim.today',
    db,
    time: new Date().toISOString(),
  })
}
