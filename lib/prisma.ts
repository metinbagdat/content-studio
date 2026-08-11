import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function appendQueryParam(url: string, key: string, value: string): string {
  if (url.includes(`${key}=`)) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${key}=${value}`
}

function normalizeDatabaseUrl(raw: string): string {
  let url = raw.trim()
  // Vercel UI: users often paste .env lines or wrap in quotes
  if (url.startsWith('DATABASE_URL=')) url = url.slice('DATABASE_URL='.length).trim()
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1).trim()
  }
  return url
}

/** Supabase session pooler (~15 total) — budget per Node process (dev + worker ≈ 10). */
function databaseUrl(): string {
  const raw = process.env.DATABASE_URL
  if (!raw?.trim()) throw new Error('DATABASE_URL is not set')
  const url = normalizeDatabaseUrl(raw)
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    throw new Error('DATABASE_URL must start with postgresql:// or postgres://')
  }
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
