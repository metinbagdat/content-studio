import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function appendQueryParam(url: string, key: string, value: string): string {
  if (url.includes(`${key}=`)) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${key}=${value}`
}

function normalizeDatabaseUrl(raw: string): string {
  let url = raw.trim().replace(/^\uFEFF/, '')
  if (url.startsWith('DATABASE_URL=')) url = url.slice('DATABASE_URL='.length).trim()
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1).trim()
  }
  return url
}

const BUILD_PLACEHOLDER_URL = 'postgresql://build:build@127.0.0.1:5432/postgres?schema=public'

function isNextBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build'
}

/** Supabase session pooler (~15 total) — budget per Node process (dev + worker ≈ 10). */
function databaseUrl(): string {
  const raw = process.env.DATABASE_URL
  if (!raw?.trim()) {
    if (isNextBuildPhase()) return BUILD_PLACEHOLDER_URL
    throw new Error('DATABASE_URL is not set')
  }
  const url = normalizeDatabaseUrl(raw)
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    if (isNextBuildPhase()) return BUILD_PLACEHOLDER_URL
    throw new Error('DATABASE_URL must start with postgresql:// or postgres://')
  }
  const isVercel = Boolean(process.env.VERCEL)
  const defaultLimit = isVercel ? '1' : '5'
  const limit = process.env.PRISMA_CONNECTION_LIMIT?.trim() || defaultLimit
  let out = appendQueryParam(url, 'connection_limit', limit)
  if (/:6543\//.test(url) || process.env.DATABASE_PGBOUNCER === 'true') {
    out = appendQueryParam(out, 'pgbouncer', 'true')
  }
  out = appendQueryParam(out, 'connect_timeout', '15')
  out = appendQueryParam(out, 'pool_timeout', '30')
  return out
}

/** True when Prisma talks to hosted Supabase (billed egress). Local Docker is not billed. */
export function isSupabaseDatabaseUrl(raw = process.env.DATABASE_URL): boolean {
  if (!raw?.trim()) return false
  return /supabase\.(co|com)|pooler\.supabase/i.test(normalizeDatabaseUrl(raw))
}

/** One-shot local → Supabase only (never leave set during daily Docker work). */
export function isSupabaseLocalAllowlisted(): boolean {
  return (
    process.env.CS_ALLOW_SUPABASE_WORKER === '1' || process.env.CS_ALLOW_SUPABASE === '1'
  )
}

/**
 * Block local Next/worker/scripts from Supabase unless explicitly allowlisted.
 * Vercel Production may use Supabase; local daily work must use localhost:5434.
 */
export function assertLocalSupabaseEgressAllowed(): void {
  if (process.env.VERCEL || isNextBuildPhase()) return
  if (!isSupabaseDatabaseUrl()) return
  if (isSupabaseLocalAllowlisted()) {
    console.warn(
      '[egress] CS_ALLOW_SUPABASE*=1 — local process → Supabase (Hobby egress). Prefer localhost:5434; unset the flag after the one-shot.',
    )
    return
  }
  throw new Error(
    '[egress] Refused: local DATABASE_URL points at Supabase (Hobby 5GB egress). Use Docker localhost:5434 for daily work. One-shot only: CS_ALLOW_SUPABASE_WORKER=1. See docs/LOCAL_AND_PROD.md',
  )
}

assertLocalSupabaseEgressAllowed()

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl() } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

globalForPrisma.prisma = prisma

export function isPrismaConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /Server has closed the connection|Can't reach database|Connection reset|P1017|P1001|P1002|ECONNRESET|max clients|EMAXCONNSESSION|ECIRCUITBREAKER/i.test(
    msg,
  )
}

export async function ensurePrismaConnected(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    await prisma.$disconnect().catch(() => {})
    await prisma.$connect()
  }
}

export async function withPrismaRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      if (i > 0) await ensurePrismaConnected()
      return await fn()
    } catch (err) {
      last = err
      if (!isPrismaConnectionError(err) || i === attempts - 1) throw err
      await new Promise((r) => setTimeout(r, 400 * (i + 1)))
    }
  }
  throw last
}
