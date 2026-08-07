import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function appendQueryParam(url: string, key: string, value: string): string {
  if (url.includes(`${key}=`)) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${key}=${value}`
}

/** Supabase session pooler (~15 total) — budget per Node process (dev + worker ≈ 10). */
function databaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const limit = process.env.PRISMA_CONNECTION_LIMIT?.trim() || '5'
  let out = appendQueryParam(url, 'connection_limit', limit)
  out = appendQueryParam(out, 'connect_timeout', '15')
  out = appendQueryParam(out, 'pool_timeout', '30')
  return out
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl() } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

globalForPrisma.prisma = prisma
