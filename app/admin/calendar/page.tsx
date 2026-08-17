'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@/lib/adminKey'

type PipelineRow = {
  id: string
  name: string
  status: string
  source?: { id: string; title: string }
}

type PreviewSlot = {
  slotIndex: number
  platform: string
  contentKind: string
  dayOffset: number
  scheduledAt: string
  derivativeTitle?: string
  derivativeStatus?: string
  accountReady: boolean
  schedulable: boolean
  skipReason?: string
}

type Preview = {
  pipelineId: string
  sourceTitle: string
  distributionDays: number
  totalSlots: number
  readyCount: number
  pendingApprovalCount: number
  skippedCount: number
  slots: PreviewSlot[]
}

type AdaptiveRow = {
  platform: string
  weekend: boolean
  samples: number
  minSamples: number
  adaptive: boolean
  slots: string[]
}

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export default function CalendarPage() {
  const [adminKey, setAdminKey] = useState('')
  const [posts, setPosts] = useState<any[]>([])
  const [pipelines, setPipelines] = useState<PipelineRow[]>([])
  const [adaptiveSlots, setAdaptiveSlots] = useState<AdaptiveRow[]>([])
  const [pipelineId, setPipelineId] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [approvedOnly, setApprovedOnly] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const loadPosts = useCallback(async () => {
    if (!adminKey) return
    const res = await fetch('/api/social', { headers: headers(adminKey), cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    const sorted = (data.posts || []).slice().sort((a: any, b: any) => {
      const ta = a.scheduledAt || a.publishedAt || a.createdAt
      const tb = b.scheduledAt || b.publishedAt || b.createdAt
      return new Date(ta).getTime() - new Date(tb).getTime()
    })
    setPosts(sorted)
  }, [adminKey])

  const loadPipelines = useCallback(async () => {
    if (!adminKey) return
    const res = await fetch('/api/scheduling', { headers: headers(adminKey), cache: 'no-store' })
    if (!res.ok) {
      setMsg(`Scheduling API ${res.status}`)
      return
    }
    const data = await res.json()
    setPipelines(data.pipelines || [])
    setAdaptiveSlots(data.adaptiveSlots || [])
  }, [adminKey])

  const load = useCallback(async () => {
    await Promise.all([loadPosts(), loadPipelines()])
  }, [loadPosts, loadPipelines])

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

  async function runPreview() {
    if (!pipelineId) {
      setMsg('Pipeline seç')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const q = new URLSearchParams({
        pipelineId,
        approvedOnly: approvedOnly ? 'true' : 'false',
      })
      const res = await fetch(`/api/scheduling?${q}`, {
        headers: headers(adminKey),
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setPreview(data.preview)
      setMsg(
        `Önizleme: ${data.preview.readyCount} hazır · ${data.preview.pendingApprovalCount} onay bekliyor · ${data.preview.skippedCount} atlandı`,
      )
    } catch (e) {
      setPreview(null)
      setMsg(e instanceof Error ? e.message : 'Preview hatası')
    } finally {
      setBusy(false)
    }
  }

  async function applySchedule() {
    if (!pipelineId) {
      setMsg('Pipeline seç')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/scheduling', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({
          action: 'apply',
          pipelineId,
          approvedOnly,
          reschedule: false,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const r = data.result || {}
      setMsg(`Uygulandı: ${r.scheduled ?? 0} zamanlandı · ${r.skipped ?? 0} atlandı` +
        (r.errors?.length ? ` · ${r.errors.length} hata` : ''))
      await loadPosts()
      await runPreview()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Apply hatası')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1>Takvim</h1>
      <p className="lead">14 günlük dağıtım önizlemesi + onaylı içerikleri zamanla; planlanan/yayınlanan postlar. Saatler ≥5 metrikli yayından sonra etkileşime göre kayar.</p>

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

      {adaptiveSlots.length ? (
        <section className="panel" style={{ marginBottom: '1.25rem' }}>
          <h2>Öğrenilen saatler (CS-08)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Hafta içi / sonu ayrı. Adaptive = o dilimde en az 5 yayın + metrik.
          </p>
          <ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {adaptiveSlots
              .filter((r) => !r.weekend)
              .map((r) => (
                <li key={`${r.platform}-wd`}>
                  {r.platform}: {r.adaptive ? 'adaptive' : `statik (${r.samples}/${r.minSamples})`} ·{' '}
                  {r.slots.join(', ')}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="panel" style={{ marginBottom: '1.25rem' }}>
        <h2>Dağıtım takvimi uygula</h2>
        <label>COMPLETED pipeline (calendar’lı)</label>
        <select value={pipelineId} onChange={(e) => setPipelineId(e.target.value)}>
          <option value="">Seç…</option>
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>
              {p.source?.title || p.name || p.id}
            </option>
          ))}
        </select>
        {!pipelines.length ? (
          <p className="muted">Calendar’lı tamamlanmış pipeline yok — önce Pipeline çalıştır.</p>
        ) : null}
        <label className="row" style={{ margin: '0.75rem 0' }}>
          <input
            type="checkbox"
            checked={approvedOnly}
            onChange={(e) => setApprovedOnly(e.target.checked)}
          />
          <span className="muted">Sadece onaylı türevleri zamanla</span>
        </label>
        <div className="row" style={{ gap: '0.5rem' }}>
          <button type="button" className="secondary" disabled={busy || !pipelineId} onClick={runPreview}>
            Önizle
          </button>
          <button type="button" disabled={busy || !pipelineId} onClick={applySchedule}>
            Takvime uygula
          </button>
        </div>

        {preview ? (
          <div style={{ marginTop: '1rem' }}>
            <p className="muted">
              {preview.sourceTitle} · {preview.distributionDays} gün · {preview.totalSlots} slot
            </p>
            <ul className="list">
              {preview.slots.slice(0, 40).map((s) => (
                <li key={s.slotIndex} style={{ marginBottom: '0.35rem' }}>
                  <div className="row">
                    <span className="badge">{s.platform}</span>
                    <span className="badge">{s.contentKind}</span>
                    <span className={`badge ${s.schedulable ? 'ready' : 'skip'}`}>
                      {s.schedulable ? 'hazır' : 'atla'}
                    </span>
                    <span className="muted">+{s.dayOffset}g · {new Date(s.scheduledAt).toLocaleString()}</span>
                  </div>
                  <div className="muted">
                    {s.derivativeTitle || '—'}
                    {s.derivativeStatus ? ` · ${s.derivativeStatus}` : ''}
                    {s.skipReason ? ` · ${s.skipReason}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <h2>Planlanan / yayınlanan postlar</h2>
      <ul className="list">
        {posts.map((p) => (
          <li key={p.id} className="panel" style={{ marginBottom: '0.5rem' }}>
            <div className="row">
              <span className="badge">{p.platform}</span>
              <span className="badge">{p.status}</span>
              <span className="muted">
                {p.scheduledAt
                  ? `schedule ${new Date(p.scheduledAt).toLocaleString()}`
                  : p.publishedAt
                    ? `published ${new Date(p.publishedAt).toLocaleString()}`
                    : new Date(p.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="muted">{(p.postContent || '').slice(0, 160)}…</div>
          </li>
        ))}
        {!posts.length ? <li className="muted">Henüz post yok</li> : null}
      </ul>
    </div>
  )
}
