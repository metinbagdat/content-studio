import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/** Supabase session pooler (max ~15) — cap connections per Node process (dev + worker). */
function databaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  if (url.includes('connection_limit=')) return url
  const limit = process.env.PRISMA_CONNECTION_LIMIT?.trim() || '2'
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}connection_limit=${limit}`
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl() } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

globalForPrisma.prisma = prisma
