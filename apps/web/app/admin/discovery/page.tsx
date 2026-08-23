'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@content-studio/core/adminKey'
import { HoverExpandList, HoverExpandRow } from '@/components/admin/HoverExpandList'

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

type DiscoveryLog = {
  id: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRY'
  payload: { source: string; scanned: number } | null
  result: {
    newArticles: number
    skippedDuplicates: number
    skippedHubPages: number
    errors: string[]
    ingested: Array<{ slug: string; sourceId: string; title: string }>
  } | null
  error: string | null
  createdAt: string
}

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export default function DiscoveryPage() {
  const [adminKey, setAdminKey] = useState('')
  const [info, setInfo] = useState<DiscoveryInfo | null>(null)
  const [logs, setLogs] = useState<DiscoveryLog[]>([])
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

  const loadLogs = useCallback(async () => {
    if (!adminKey) return
    const res = await fetch('/api/admin/discovery-log?limit=20', {
      headers: headers(adminKey),
      cache: 'no-store',
    })
    if (!res.ok) return
    const data = await res.json()
    setLogs(data.logs || [])
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
      loadLogs()
    }
  }, [adminKey, load, loadLogs])

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
          (r.skippedHubPages ? ` · hub atlandı: ${r.skippedHubPages}` : '') +
          (r.errors?.length ? ` · hatalar: ${r.errors.length}` : ''),
      )
      await load()
      await loadLogs()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Discovery hatası')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1>Discovery</h1>
      <p className="lead">
        egitim.today sitemap tarama → kaynak ingest → isteğe bağlı pipeline. Kategori/hub sayfaları
        (ör. &quot;TYT Hazırlık Rehberleri&quot;) artık otomatik atlanır — benzer başlıkların tekrarını önler.
      </p>

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
        <button
          type="button"
          className="secondary"
          onClick={() => {
            load()
            loadLogs()
          }}
          disabled={busy}
        >
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
          <HoverExpandList>
            {(info?.recent || []).map((s) => (
              <HoverExpandRow
                key={s.id}
                summary={
                  <>
                    <span className="badge">blog</span>
                    <strong className="hover-row-title">{s.title}</strong>
                    <span className="muted hover-row-when">{new Date(s.createdAt).toLocaleString('tr-TR')}</span>
                  </>
                }
              >
                {s.slug ? <div className="muted">slug: {s.slug}</div> : null}
              </HoverExpandRow>
            ))}
            {!info?.recent?.length ? (
              <li className="muted hover-row" style={{ border: 'none', boxShadow: 'none' }}>Henüz discovery kaydı yok</li>
            ) : null}
          </HoverExpandList>
        </section>
      </div>

      <section className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Discovery Log</h2>
        <p className="muted">Zamanlanmış ve manuel çalıştırmaların geçmişi (sitemap / RSS kaynağı dahil).</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Tarih</th>
              <th style={{ textAlign: 'left' }}>Kaynak</th>
              <th style={{ textAlign: 'left' }}>Durum</th>
              <th style={{ textAlign: 'left' }}>Yeni</th>
              <th style={{ textAlign: 'left' }}>Hata</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} style={{ borderTop: '1px solid #333' }}>
                <td>{new Date(log.createdAt).toLocaleString('tr-TR')}</td>
                <td>{log.payload?.source ?? '—'}</td>
                <td>{log.status}</td>
                <td>
                  {log.result?.newArticles ?? 0}
                  {log.result?.ingested?.length ? (
                    <ul>
                      {log.result.ingested.map((i) => (
                        <li key={i.sourceId}>{i.title}</li>
                      ))}
                    </ul>
                  ) : null}
                </td>
                <td style={{ color: log.error ? 'red' : undefined }}>{log.error || '—'}</td>
              </tr>
            ))}
            {!logs.length ? (
              <tr>
                <td colSpan={5} className="muted">
                  Henüz log kaydı yok
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  )
}