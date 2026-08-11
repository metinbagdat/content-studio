'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApiErrorMessage } from '@/lib/adminApiHint'
import { DEFAULT_ADMIN_API_KEY } from '@/lib/adminKey'
import {
  DEFAULT_PIPELINE_PLATFORMS,
  PLATFORM_TARGETS,
  type PlatformTarget,
} from '@/lib/platforms/targets'

type PlatformId = PlatformTarget['id']

type Source = { id: string; title: string; content?: string; category: string; createdAt: string; tags?: string[] }

function sourceSlug(tags?: string[]): string | null {
  const t = tags?.find((x) => x.startsWith('blog:'))
  return t ? t.replace('blog:', '') : null
}
type Pipeline = {
  id: string
  name: string
  status: string
  currentStep: number
  totalSteps: number
  createdAt: string
  errors?: string[]
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
  const [platforms, setPlatforms] = useState<PlatformId[]>([...DEFAULT_PIPELINE_PLATFORMS])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgError, setMsgError] = useState(false)
  const [editSourceId, setEditSourceId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  const selectedLabels = useMemo(
    () =>
      PLATFORM_TARGETS.filter((p) => platforms.includes(p.id))
        .map((p) => p.short)
        .join(' · '),
    [platforms],
  )

  const load = useCallback(async () => {
    if (!adminKey) return
    const [sRes, pRes] = await Promise.all([
      fetch('/api/sources', { headers: adminHeaders(adminKey), cache: 'no-store' }),
      fetch('/api/pipelines', { headers: adminHeaders(adminKey), cache: 'no-store' }),
    ])
    if (!sRes.ok || !pRes.ok) {
      setMsgError(true)
      setMsg(adminApiErrorMessage([sRes.status, pRes.status]))
      return
    }
    const s = await sRes.json()
    const p = await pRes.json()
    setSources(s.sources || [])
    setPipelines(p.pipelines || [])
    setMsgError(false)
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

  function togglePlatform(id: PlatformId) {
    setPlatforms((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev
        return prev.filter((p) => p !== id)
      }
      return [...prev, id]
    })
  }

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
      setMsgError(false)
      setMsg('Kaynak eklendi — pipeline için hazır')
    } catch (e) {
      setMsgError(true)
      setMsg(e instanceof Error ? e.message : 'Hata')
    } finally {
      setBusy(false)
    }
  }

  async function startPipeline() {
    if (!sourceId) {
      setMsgError(true)
      setMsg('Önce bir kaynak seç')
      return
    }
    if (!platforms.length) {
      setMsgError(true)
      setMsg('En az bir platform seç (X veya YouTube önerilir)')
      return
    }
    const existing = pipelines.find(
      (p) => p.source?.id === sourceId && ['PENDING', 'RUNNING', 'COMPLETED'].includes(p.status),
    )
    if (existing) {
      const ok = confirm(
        `Bu kaynak için zaten bir pipeline var (durum: ${existing.status}). Yine de yeni bir pipeline başlatılsın mı? Aynı içerik tekrar üretilecek.`,
      )
      if (!ok) return
    }
    setBusy(true)
    setMsgError(false)
    setMsg('Pipeline çalışıyor… X / YouTube türevleri üretiliyor')
    try {
      const res = await fetch('/api/pipelines', {
        method: 'POST',
        headers: adminHeaders(adminKey, true),
        body: JSON.stringify({
          sourceId,
          platforms,
          includeMarchSong,
          runSync: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'pipeline fail')
      setMsgError(false)
      setMsg(`Pipeline ${data.pipeline?.status} · ${selectedLabels} · id ${data.pipeline?.id}`)
      await load()
    } catch (e) {
      setMsgError(true)
      setMsg(e instanceof Error ? e.message : 'Hata')
    } finally {
      setBusy(false)
    }
  }

  async function processPipelineNow(pipelineId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}`, {
        method: 'POST',
        headers: adminHeaders(adminKey, true),
        body: JSON.stringify({ action: 'process-now' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'İşlenemedi')
      setMsgError(false)
      setMsg('Pipeline işlendi')
      await load()
    } catch (e) {
      setMsgError(true)
      setMsg(e instanceof Error ? e.message : 'Hata')
    } finally {
      setBusy(false)
    }
  }

  async function deletePipeline(pipelineId: string) {
    if (!confirm('Bu pipeline kaydı silinsin mi? (Üretilmiş içerikler etkilenmez)')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}`, {
        method: 'DELETE',
        headers: adminHeaders(adminKey),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Silinemedi')
      setMsgError(false)
      setMsg('Pipeline silindi')
      await load()
    } catch (e) {
      setMsgError(true)
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
      setMsgError(false)
      setMsg('Kaynak güncellendi')
    } catch (e) {
      setMsgError(true)
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
      setMsgError(false)
      setMsg('Kaynak silindi')
    } catch (e) {
      setMsgError(true)
      setMsg(e instanceof Error ? e.message : 'Hata')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <section className="hero-panel">
        <h1>Pipeline</h1>
        <p className="lead" style={{ marginBottom: '0.75rem' }}>
          Kaynak ekle → platform seç → Start Pipeline (podcast, video script, SM metinleri otomatik).
        </p>
        <div className="row">
          <a className="btn" href="/admin/review">Onay kuyruğuna git →</a>
          <a className="btn secondary" href="/admin/discovery">Discovery</a>
        </div>
      </section>

      <div className="keybar">
        <div>
          <label>Admin API key</label>
          <input
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder={DEFAULT_ADMIN_API_KEY}
            type="password"
            autoComplete="off"
          />
        </div>
        <button type="button" className="secondary" onClick={load} disabled={busy}>
          Yenile
        </button>
      </div>
      {msg ? <p className={`flash ${msgError ? 'error' : ''}`}>{msg}</p> : null}

      <div className="grid two">
        <section className="panel">
          <h2>1. Kaynak makale</h2>
          <label>Başlık</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn. Zamanı zafere dönüştürmek"
          />
          <label>İçerik</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Makale metnini yapıştır…"
          />
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

          <label>Hedef platformlar</label>
          <div className="platform-grid">
            {PLATFORM_TARGETS.map((p) => {
              const on = platforms.includes(p.id)
              return (
                <label
                  key={p.id}
                  className={`platform-chip ${on ? 'on' : ''} ${p.featured ? 'featured' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => togglePlatform(p.id)}
                  />
                  <span className="chip-label">
                    {p.label}
                    {p.featured ? <small>öncelikli</small> : <small>{p.short}</small>}
                  </span>
                </label>
              )
            })}
          </div>

          <p className="muted">Seçili: {selectedLabels || '—'} · autoPublish kapalı</p>
          <label className="row" style={{ marginBottom: '0.85rem', textTransform: 'none' }}>
            <input
              type="checkbox"
              checked={includeMarchSong}
              onChange={(e) => setIncludeMarchSong(e.target.checked)}
              style={{ width: 'auto', margin: 0 }}
            />
            <span className="muted">Marş + şarkı sözü üret</span>
          </label>
          <button type="button" disabled={busy || !sourceId} onClick={startPipeline}>
            {busy ? 'Üretiliyor…' : 'Start Pipeline'}
          </button>
        </section>
      </div>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2>Kaynaklar</h2>
        <p className="muted" style={{ marginBottom: '0.75rem' }}>
          Discovery bazen sitemap’taki <strong>kategori sayfalarını</strong> (ör. “TYT Hazırlık Rehberleri”)
          ayrı kaynak olarak ekler — slug farklı, başlık benzer görünür. Yeni discovery hub sayfalarını atlar.
        </p>
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
                  <div className="row">
                    <strong>{s.title}</strong>
                    <span className="badge">{s.category}</span>
                    {sourceSlug(s.tags) ? <span className="badge muted">slug: {sourceSlug(s.tags)}</span> : null}
                  </div>
                  <div className="muted">{new Date(s.createdAt).toLocaleString()}</div>
                  <div className="row" style={{ marginTop: '0.45rem' }}>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => {
                        setSourceId(s.id)
                        setMsgError(false)
                        setMsg(`Kaynak seçildi: ${s.title}`)
                      }}
                    >
                      Pipeline’da kullan
                    </button>
                    <a className="btn secondary" href="/admin/review" style={{ textDecoration: 'none' }}>
                      Onay
                    </a>
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
          {!sources.length ? (
            <li className="empty-state">
              <strong>Henüz kaynak yok</strong>
              Soldan makale ekle veya Discovery ile tara. DB boşsa `.env` DATABASE_URL’i kontrol et.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2>Son pipeline’lar</h2>
        <ul className="list">
          {pipelines.map((p) => {
            const stuckPending =
              p.status === 'PENDING' && Date.now() - new Date(p.createdAt).getTime() > 2 * 60_000
            return (
              <li key={p.id}>
                <div className="row">
                  <strong>{p.source?.title || p.name}</strong>
                  <span
                    className={`badge ${
                      p.status === 'COMPLETED' ? 'ok' : p.status === 'FAILED' ? 'danger' : 'warn'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                <div className="muted">
                  adım {p.currentStep}/{p.totalSteps}
                </div>
                {p.errors?.length ? (
                  <p className="muted" style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: '0.3rem 0 0' }}>
                    {p.errors[p.errors.length - 1].slice(0, 200)}
                  </p>
                ) : null}
                {stuckPending ? (
                  <p className="muted" style={{ color: 'var(--warn)', fontSize: '0.8rem', margin: '0.3rem 0 0' }}>
                    2 dakikadan uzun süredir PENDING — worker çalışmıyor olabilir (
                    <code>npm run worker</code>) veya aşağıdan elle işleyin.
                  </p>
                ) : null}
                <div className="row" style={{ marginTop: '0.4rem' }}>
                  {p.status === 'PENDING' || p.status === 'FAILED' ? (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => processPipelineNow(p.id)}
                    >
                      Şimdi işle
                    </button>
                  ) : null}
                  <button type="button" className="danger" disabled={busy} onClick={() => deletePipeline(p.id)}>
                    Sil
                  </button>
                </div>
              </li>
            )
          })}
          {!pipelines.length ? (
            <li className="empty-state">
              <strong>Pipeline yok</strong>
              Kaynak seçip Start Pipeline ile X + YouTube türevlerini üret.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  )
}
