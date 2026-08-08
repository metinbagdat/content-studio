import { createHash } from 'crypto'

const PROD_APP_URL = 'https://studio.egitim.today'

/** Stable hash of DB host + database name — same value on local & prod when sharing Supabase. */
export function databaseFingerprint(): string | null {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) return null
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
}

export function getDeployParityInfo(): DeployParityInfo {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3100'
  const isProduction = appUrl.includes('studio.egitim.today')
  const fp = databaseFingerprint()
  const expected = process.env.DEPLOY_PARITY_DB_FINGERPRINT?.trim()
  const databaseSynced = Boolean(fp && (!expected || fp === expected))

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
    sharedDataNote:
      'Aynı DATABASE_URL kullanıldığında local ve prod aynı workflow sayılarını görür (taslak, yayın, OAuth).',
  }
}
