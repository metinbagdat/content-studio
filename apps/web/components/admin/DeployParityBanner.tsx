'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@content-studio/core/adminKey'

type Parity = {
  appUrl: string
  isProduction: boolean
  prodUrl: string
  databaseFingerprint: string | null
  databaseSynced: boolean
  gitCommit: string | null
  environment: string
  sharedDataNote: string
  dbHost?: 'supabase' | 'local'
  egressWarning?: string | null
}

export function DeployParityBanner({ adminKey }: { adminKey: string }) {
  const [parity, setParity] = useState<Parity | null>(null)

  const load = useCallback(async () => {
    const key = adminKey || DEFAULT_ADMIN_API_KEY
    try {
      const res = await fetch('/api/admin/deploy-parity', {
        headers: { 'x-admin-key': key },
        cache: 'no-store',
      })
      if (res.ok) setParity(await res.json())
    } catch {
      /* ignore */
    }
  }, [adminKey])

  useEffect(() => {
    load()
    const t = setInterval(load, 5 * 60_000)
    return () => clearInterval(t)
  }, [load])

  if (!parity) return null

  const envLabel = parity.isProduction ? 'Production' : 'Local dev'
  const egressRisk = Boolean(parity.egressWarning)
  const dbOk = parity.databaseFingerprint && parity.databaseSynced && !egressRisk

  return (
    <section
      className={`deploy-parity panel ${dbOk ? 'deploy-parity-ok' : 'deploy-parity-warn'}`}
      aria-label="Ortam senkronu"
    >
      <div className="deploy-parity-row">
        <span className={`badge ${parity.isProduction ? 'ok' : ''}`}>{envLabel}</span>
        <code className="deploy-parity-url">{parity.appUrl}</code>
        {parity.gitCommit ? <span className="muted">build {parity.gitCommit}</span> : null}
        <span className={`badge ${parity.dbHost === 'supabase' && !parity.isProduction ? 'danger' : 'ok'}`}>
          DB {parity.dbHost === 'supabase' ? 'Supabase' : 'local'}
        </span>
        {parity.databaseFingerprint ? (
          <span className={dbOk ? 'badge ok' : 'badge danger'} title={parity.sharedDataNote}>
            {parity.databaseFingerprint}
            {dbOk ? ' · ok' : ' · kontrol'}
          </span>
        ) : (
          <span className="badge danger">DATABASE_URL yok</span>
        )}
        {!parity.isProduction ? (
          <span className="muted deploy-parity-hint">
            {parity.egressWarning ||
              `Günlük iş: Docker :5434 (sıfır egress). Prod: ${parity.prodUrl}`}
          </span>
        ) : null}
      </div>
    </section>
  )
}
