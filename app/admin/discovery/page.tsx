'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@/lib/adminKey'

type RecentSource = {
  id: string
  title: string
  tags: string[]
  createdAt: string
  slug: string | null
}

type DiscoveryInfo = {
  cronEnabled: boolean
  dailyLimit: number
  recent: RecentSource[]
}

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export default function DiscoveryPage() {
  const [adminKey, setAdminKey] = useState('')
  const [info, setInfo] = useState<DiscoveryInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [limit, setLimit] = useState(2)
  const [triggerPipeline, setTriggerPipeline] = useState(true)

  const load = useCallback(async () => {
    if (!adminKey) return
    const res = await fetch('/api/discovery', { headers: headers(adminKey), cache: 'no-store' })
    if (!res.ok) {
      setMsg(`API hatası ${res.status} — ADMIN_API_KEY kontrol et`)
      setInfo(null)
      return
    }
    const data = await res.json()
    setInfo(data)
    setMsg('')
  }, [adminKey])

  useEffect(() => {
    const saved = localStorage.getItem('cs_admin_key')
    if (saved) setAdminKey(saved)
    else setAdminKey(DEFAULT_ADMIN_API_KEY)
  }, [])

  useEffect(() => {
    if (adminKey) {
      localStorage.setItem('cs_admin_key', adminKey)
      load()
    }
  }, [adminKey, load])

  async function runDiscovery() {
    setBusy(true)
    setMsg('Discovery çalışıyor…')
    try {
      const res = await fetch('/api/discovery', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ limit, triggerPipeline }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const r = data.result || {}
      setMsg(
        `Tarama: ${r.scanned ?? '?'} · yeni: ${r.newArticles ?? 0} · duplicate: ${r.skippedDuplicates ?? 0}` +
          (r.errors?.length ? ` · hatalar: ${r.errors.length}` : ''),
      )
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Discovery hatası')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1>Discovery</h1>
      <p className="lead">egitim.today sitemap tarama → kaynak ingest → isteğe bağlı pipeline (Phase 0).</p>

      <div className="keybar">
        <div style={{ flex: 1 }}>
          <label>Admin API key (varsayılan: {DEFAULT_ADMIN_API_KEY})</label>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder={DEFAULT_ADMIN_API_KEY}
          />
        </div>
        <button type="button" className="secondary" onClick={load} disabled={busy}>
          Yenile
        </button>
      </div>
      {msg ? <p className="muted">{msg}</p> : null}

      <div className="grid two">
        <section className="panel">
          <h2>Durum</h2>
          <p className="muted">
            Cron: {info?.cronEnabled === false ? 'kapalı' : 'açık (worker · 06:00 IST)'}
          </p>
          <p className="muted">Günlük limit (env): {info?.dailyLimit ?? '—'}</p>
          <label>Bu çalıştırma limiti</label>
          <input
            type="number"
            min={1}
            max={20}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 1)}
          />
          <label className="row" style={{ marginTop: '0.75rem' }}>
            <input
              type="checkbox"
              checked={triggerPipeline}
              onChange={(e) => setTriggerPipeline(e.target.checked)}
            />
            <span className="muted">Yeni makaleler için pipeline başlat</span>
          </label>
          <button type="button" disabled={busy || !adminKey} onClick={runDiscovery} style={{ marginTop: '1rem' }}>
            Şimdi tara
          </button>
        </section>

        <section className="panel">
          <h2>Son blog kaynakları</h2>
          <ul className="list">
            {(info?.recent || []).map((s) => (
              <li key={s.id} style={{ marginBottom: '0.5rem' }}>
                <div className="row">
                  <span className="badge">blog</span>
                  <span className="muted">{new Date(s.createdAt).toLocaleString()}</span>
                </div>
                <div>{s.title}</div>
                {s.slug ? <div className="muted">slug: {s.slug}</div> : null}
              </li>
            ))}
            {!info?.recent?.length ? <li className="muted">Henüz discovery kaydı yok</li> : null}
          </ul>
        </section>
      </div>
    </div>
  )
}
