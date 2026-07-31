'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@/lib/adminKey'

type Source = { id: string; title: string; content?: string; category: string; createdAt: string }
type Pipeline = {
  id: string
  name: string
  status: string
  currentStep: number
  totalSteps: number
  source?: { id: string; title: string }
}

function adminHeaders(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export default function AdminPipelinePage() {
  const [adminKey, setAdminKey] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [includeMarchSong, setIncludeMarchSong] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [editSourceId, setEditSourceId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  const load = useCallback(async () => {
    if (!adminKey) return
    const [sRes, pRes] = await Promise.all([
      fetch('/api/sources', { headers: adminHeaders(adminKey), cache: 'no-store' }),
      fetch('/api/pipelines', { headers: adminHeaders(adminKey), cache: 'no-store' }),
    ])
    if (!sRes.ok || !pRes.ok) {
      setMsg(`Yetkisiz veya API hatası — .env ADMIN_API_KEY ile aynı olmalı (varsayılan: ${DEFAULT_ADMIN_API_KEY})`)
      return
    }
    const s = await sRes.json()
    const p = await pRes.json()
    setSources(s.sources || [])
    setPipelines(p.pipelines || [])
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

  async function createSource() {
    setBusy(true)
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: adminHeaders(adminKey, true),
        body: JSON.stringify({ title, content, category: 'promo' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'fail')
      setTitle('')
      setContent('')
      setSourceId(data.source.id)
      await load()
      setMsg('Kaynak eklendi')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Hata')
    } finally {
      setBusy(false)
    }
  }

  async function startPipeline() {
    if (!sourceId) {
      setMsg('Kaynak seç')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/pipelines', {
        method: 'POST',
        headers: adminHeaders(adminKey, true),
        body: JSON.stringify({
          sourceId,
          platforms: ['TWITTER', 'LINKEDIN'],
          includeMarchSong,
          runSync: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'pipeline fail')
      setMsg(`Pipeline ${data.pipeline?.status}: ${data.pipeline?.id}`)
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Hata')
    } finally {
      setBusy(false)
    }
  }

  function startEditSource(s: Source) {
    setEditSourceId(s.id)
    setEditTitle(s.title)
    setEditContent(s.content || '')
    fetch(`/api/sources/${s.id}`, { headers: adminHeaders(adminKey) })
      .then((r) => r.json())
      .then((d) => {
        if (d.source?.content) setEditContent(d.source.content)
      })
      .catch(() => {})
  }

  function cancelEditSource() {
    setEditSourceId(null)
    setEditTitle('')
    setEditContent('')
  }

  async function saveSource() {
    if (!editSourceId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/sources/${editSourceId}`, {
        method: 'PATCH',
        headers: adminHeaders(adminKey, true),
        body: JSON.stringify({ title: editTitle, content: editContent }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'fail')
      cancelEditSource()
      await load()
      setMsg('Kaynak güncellendi')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Hata')
    } finally {
      setBusy(false)
    }
  }

  async function deleteSource(id: string) {
    if (!confirm('Kaynak ve tüm türevleri silinsin mi?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/sources/${id}`, { method: 'DELETE', headers: adminHeaders(adminKey) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'fail')
      if (sourceId === id) setSourceId('')
      if (editSourceId === id) cancelEditSource()
      await load()
      setMsg('Kaynak silindi')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Hata')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1>Pipeline</h1>
      <p className="lead">Kaynak CRUD + AI türev üretimi (onay ayrı ekranda).</p>

      <div className="keybar">
        <div style={{ flex: 1 }}>
          <label>Admin API key (`.env` → ADMIN_API_KEY, varsayılan: {DEFAULT_ADMIN_API_KEY})</label>
          <input value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder={DEFAULT_ADMIN_API_KEY} type="password" />
        </div>
        <button type="button" className="secondary" onClick={load}>
          Yenile
        </button>
      </div>
      {msg ? <p className="muted">{msg}</p> : null}

      <div className="grid two">
        <section className="panel">
          <h2>1. Kaynak makale</h2>
          <label>Başlık</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
          <label>İçerik</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} />
          <button type="button" disabled={busy || !title || !content} onClick={createSource}>
            Kaynak kaydet
          </button>
        </section>

        <section className="panel">
          <h2>2. Pipeline başlat</h2>
          <label>Kaynak</label>
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            <option value="">Seç…</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <p className="muted">Platformlar: X + LinkedIn · autoPublish kapalı · marş/şarkı dahil</p>
          <label className="row" style={{ marginBottom: '0.75rem' }}>
            <input type="checkbox" checked={includeMarchSong} onChange={(e) => setIncludeMarchSong(e.target.checked)} />
            <span className="muted">Marş + şarkı sözü üret</span>
          </label>
          <button type="button" disabled={busy || !sourceId} onClick={startPipeline}>
            Start Pipeline
          </button>
        </section>
      </div>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2>Kaynaklar (düzenle / sil)</h2>
        <ul className="list">
          {sources.map((s) => (
            <li key={s.id}>
              {editSourceId === s.id ? (
                <>
                  <label>Başlık</label>
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  <label>İçerik</label>
                  <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                  <div className="row">
                    <button type="button" className="ok" disabled={busy} onClick={saveSource}>
                      Kaydet
                    </button>
                    <button type="button" className="secondary" onClick={cancelEditSource}>
                      İptal
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <strong>{s.title}</strong>{' '}
                  <span className="badge">{s.category}</span>
                  <div className="muted">{s.id}</div>
                  <div className="row" style={{ marginTop: '0.35rem' }}>
                    <button type="button" className="secondary" disabled={busy} onClick={() => startEditSource(s)}>
                      Düzenle
                    </button>
                    <button type="button" className="danger" disabled={busy} onClick={() => deleteSource(s.id)}>
                      Sil
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
          {!sources.length ? <li className="muted">Kaynak yok</li> : null}
        </ul>
      </section>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2>Aktif / son pipeline’lar</h2>
        <ul className="list">
          {pipelines.map((p) => (
            <li key={p.id}>
              <strong>{p.source?.title || p.name}</strong>{' '}
              <span className={`badge ${p.status === 'COMPLETED' ? 'ok' : 'warn'}`}>{p.status}</span>
              <div className="muted">
                step {p.currentStep}/{p.totalSteps} · {p.id}
              </div>
            </li>
          ))}
          {!pipelines.length ? <li className="muted">Henüz yok</li> : null}
        </ul>
      </section>
    </div>
  )
}
