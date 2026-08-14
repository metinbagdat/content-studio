import { createHash } from 'crypto'

const PROD_APP_URL = 'https://studio.egitim.today'

function normalizeDatabaseUrl(raw: string): string {
  let url = raw.trim()
  if (url.startsWith('DATABASE_URL=')) url = url.slice('DATABASE_URL='.length).trim()
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1).trim()
  }
  return url
}

/** Stable hash of DB host + database name — same value on local & prod when sharing Supabase. */
export function databaseFingerprint(): string | null {
  const raw = process.env.DATABASE_URL?.trim()
  if (!raw) return null
  const url = normalizeDatabaseUrl(raw)
  try {
    const normalized = url.replace(/^postgresql:/, 'http:')
    const u = new URL(normalized)
    const host = u.hostname
    const db = u.pathname.replace(/^\//, '').split('?')[0] || 'postgres'
    return createHash('sha256').update(`${host}/${db}`).digest('hex').slice(0, 12)
  } catch {
    return null
  }
}

export type DeployParityInfo = {
  appUrl: string
  isProduction: boolean
  prodUrl: string
  databaseFingerprint: string | null
  databaseSynced: boolean
  gitCommit: string | null
  environment: string
  sharedDataNote: string
  dbHost: 'supabase' | 'local'
  egressWarning: string | null
}

export function getDeployParityInfo(): DeployParityInfo {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3100'
  const isProduction = appUrl.includes('studio.egitim.today')
  const fp = databaseFingerprint()
  const expected = process.env.DEPLOY_PARITY_DB_FINGERPRINT?.trim()
  const databaseSynced = Boolean(fp && (!expected || fp === expected))
  const supabase = /supabase\.(co|com)|pooler\.supabase/i.test(process.env.DATABASE_URL || '')
  const localAgainstSupabase = supabase && !process.env.VERCEL && !isProduction

  return {
    appUrl,
    isProduction,
    prodUrl: PROD_APP_URL,
    databaseFingerprint: fp,
    databaseSynced,
    gitCommit:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
      process.env.GIT_COMMIT?.slice(0, 7) ||
      null,
    environment: process.env.VERCEL_ENV || (isProduction ? 'production' : 'development'),
    sharedDataNote: localAgainstSupabase
      ? 'Local → Supabase = Hobby egress. docker compose Postgres (localhost:5434) kullanın.'
      : 'Prod Supabase; günlük local iş Docker :5434 (sıfır egress).',
    dbHost: supabase ? 'supabase' : 'local',
    egressWarning: localAgainstSupabase
      ? 'npm run dev Supabase’e bağlı — 5GB Hobby egress kotasına yazılıyor. DATABASE_URL=postgresql://content:content@localhost:5434/content_studio'
      : null,
  }
}
