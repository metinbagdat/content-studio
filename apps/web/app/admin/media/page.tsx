'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@content-studio/core/adminKey'
import { HoverExpandList, HoverExpandRow } from '@/components/admin/HoverExpandList'

type MediaItem = {
  id: string
  mediaType: string
  fileUrl: string
  duration: number | null
  fileSize: number | null
  format: string
  processingStatus: string
  derivedContent?: { id: string; title: string; contentType: string; status: string }
}

type PendingAudio = {
  id: string
  title: string
  contentType: string
  status: string
  createdAt: string
}

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

function kindForContentType(contentType: string): 'podcast' | 'march' | 'song' {
  if (contentType === 'MARCH_LYRICS') return 'march'
  if (contentType === 'SONG_LYRICS') return 'song'
  return 'podcast'
}

function AdminAudio({ mediaId, adminKey }: { mediaId: string; adminKey: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let objectUrl: string | null = null
    if (!adminKey) return
    fetch(`/api/media/${mediaId}/file`, { headers: headers(adminKey) })
      .then(async (res) => {
        if (!res.ok) throw new Error('Ses yüklenemedi')
        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => setErr('Oynatıcı yüklenemedi'))
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [mediaId, adminKey])

  if (err) return <p className="muted">{err}</p>
  if (!src) return <p className="muted">Yükleniyor…</p>
  return (
    <audio controls style={{ width: '100%', marginTop: '0.5rem' }} src={src}>
      <track kind="captions" />
    </audio>
  )
}

export default function MediaPage() {
  const [adminKey, setAdminKey] = useState('')
  const [items, setItems] = useState<MediaItem[]>([])
  const [pendingAudio, setPendingAudio] = useState<PendingAudio[]>([])
  const [ttsMode, setTtsMode] = useState('')
  const [derivedId, setDerivedId] = useState('')
  const [contentType, setContentType] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadPending = useCallback(async (key: string) => {
    const res = await fetch('/api/media?needsAudio=1', {
      headers: headers(key),
      cache: 'no-store',
    })
    if (!res.ok) return
    const data = await res.json()
    setPendingAudio(data.pending || [])
    if (data.ttsMode) setTtsMode(data.ttsMode)
  }, [])

  const loadFiles = useCallback(async (key: string, filterDerivedId?: string) => {
    const q = filterDerivedId ? `?derivedContentId=${encodeURIComponent(filterDerivedId)}` : ''
    const res = await fetch(`/api/media${q}`, { headers: headers(key), cache: 'no-store' })
    if (!res.ok) {
      setMsg('Yetkisiz')
      return
    }
    const data = await res.json()
    setItems(data.items || [])
    setTtsMode(data.ttsMode || '')
  }, [])

  const load = useCallback(async () => {
    if (!adminKey) return
    await Promise.all([loadFiles(adminKey), loadPending(adminKey)])
  }, [adminKey, loadFiles, loadPending])

  useEffect(() => {
    const saved = localStorage.getItem('cs_admin_key')
    if (saved) setAdminKey(saved)
    else setAdminKey(DEFAULT_ADMIN_API_KEY)

    const params = new URLSearchParams(window.location.search)
    const derived = params.get('derived')
    if (derived) setDerivedId(derived)
  }, [])

  useEffect(() => {
    if (adminKey) {
      localStorage.setItem('cs_admin_key', adminKey)
      load()
    }
  }, [adminKey, load])

  // Formdaki Derived ID değişince dosya listesini filtreleme — tüm COMPLETED sesler görünsün.

  async function generateFor(
    id: string,
    type: string,
    force = false,
  ): Promise<boolean> {
    const kind = kindForContentType(type)
    setBusy(true)
    setBusyId(id)
    setDerivedId(id)
    setContentType(type)
    setMsg(
      force
        ? `Yeniden üretiliyor… ${id.slice(0, 8)}…`
        : kind === 'podcast'
          ? `Ses üretiliyor… ${id.slice(0, 8)}… (30–120 sn)`
          : `Ses + müzik yatağı… ${id.slice(0, 8)}…`,
    )
    try {
      const res = await fetch('/api/media/generate', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ derivedContentId: id, kind, force }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(data.error || 'Üretim başarısız')
        return false
      }
      setMsg(
        data.reused
          ? `Mevcut ses kullanıldı — ${id.slice(0, 8)}…`
          : kind === 'podcast'
            ? `Podcast hazır · ~${data.durationSec}s · ${data.partCount ?? '?'} bölüm`
            : `Ses hazır${data.hasMusicBed ? ' · müzik yatağı ile' : ''}`,
      )
      return true
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Bağlantı hatası')
      return false
    } finally {
      setBusy(false)
      setBusyId(null)
    }
  }

  async function generate(force = false) {
    if (!derivedId.trim()) {
      setMsg('Derived content ID gir veya aşağıdaki listeden seç')
      return
    }
    const type =
      contentType ||
      pendingAudio.find((p) => p.id === derivedId.trim())?.contentType ||
      'PODCAST_SCRIPT'
    const ok = await generateFor(derivedId.trim(), type, force)
    if (ok) await load()
  }

  async function generateOne(row: PendingAudio) {
    const ok = await generateFor(row.id, row.contentType, false)
    if (ok) await load()
  }

  async function generateAllPending() {
    if (!pendingAudio.length) return
    if (!confirm(`${pendingAudio.length} ses üretilecek (sırayla, uzun sürebilir). Devam?`)) return
    const queue = [...pendingAudio]
    for (let i = 0; i < queue.length; i++) {
      const row = queue[i]
      setMsg(`${i + 1}/${queue.length}: ${row.title.slice(0, 50)}…`)
      const ok = await generateFor(row.id, row.contentType, false)
      if (!ok) {
        setMsg(`Durdu (${i + 1}/${queue.length}): ${row.title.slice(0, 40)}`)
        await load()
        return
      }
    }
    await load()
    setMsg(`${queue.length} ses üretildi`)
  }

  async function batchResize(masterMediaId: string) {
    setBusy(true)
    setMsg('Platform boyutlarına export…')
    const res = await fetch('/api/media/generate', {
      method: 'POST',
      headers: headers(adminKey, true),
      body: JSON.stringify({ kind: 'resize-batch', masterMediaId, format: 'jpeg', quality: 85 }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setMsg(data.error || 'Export başarısız')
      return
    }
    setMsg(`${(data.exports || []).length} platform boyutu oluşturuldu`)
    await load()
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return '—'
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const imageMasters = items.filter((m) => m.mediaType === 'IMAGE' && m.processingStatus === 'COMPLETED')

  return (
    <div>
      <h1>Medya</h1>
      <p className="lead">
        <strong>Ses Drenajı</strong> — podcast / marş / şarkı → MP3 · görseller → platform export. TTS:{' '}
        <strong>{ttsMode || '…'}</strong>
      </p>
      <p className="muted">
        Sesi olmayanlar otomatik listelenir (tek tık / hepsini üret). Elle ID veya{' '}
        <Link href="/admin/review">/admin/review</Link>.
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
        <button type="button" className="secondary" onClick={load} disabled={busy}>
          Yenile
        </button>
      </div>

      {msg ? <p className="flash">{msg}</p> : null}

      <section className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Sesi olmayan ({pendingAudio.length})</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Onaylı / incelemede podcast · marş · şarkı — tamamlanmış AUDIO yok.
        </p>
        {pendingAudio.length ? (
          <div className="row" style={{ marginBottom: '0.75rem', gap: '0.5rem' }}>
            <button type="button" className="ok" disabled={busy} onClick={generateAllPending}>
              {busy ? 'Üretiliyor…' : `Hepsini üret (${pendingAudio.length})`}
            </button>
          </div>
        ) : (
          <p className="muted">Bekleyen yok — tüm podcast/marş/şarkı sesleri hazır.</p>
        )}
        <HoverExpandList>
          {pendingAudio.map((row) => (
            <HoverExpandRow
              key={row.id}
              summary={
                <>
                  <span className="badge warn">{row.contentType}</span>
                  <span className="badge">{row.status}</span>
                  <strong className="hover-row-title">{row.title}</strong>
                  <code className="muted hover-row-chip" title={row.id}>
                    {row.id.slice(0, 8)}…
                  </code>
                </>
              }
            >
              <p className="muted" style={{ margin: '0.35rem 0' }}>
                <code>{row.id}</code>
              </p>
              <div className="row" style={{ gap: '0.5rem' }}>
                <button
                  type="button"
                  className="ok"
                  disabled={busy}
                  onClick={() => generateOne(row)}
                >
                  {busyId === row.id ? 'Üretiliyor…' : 'MP3 üret'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setDerivedId(row.id)
                    setContentType(row.contentType)
                    setMsg(`Seçildi: ${row.title.slice(0, 60)}`)
                  }}
                >
                  ID’yi forma al
                </button>
              </div>
            </HoverExpandRow>
          ))}
        </HoverExpandList>
      </section>

      <section className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Elle / yeniden üret</h2>
        <label>Derived ID</label>
        <input
          value={derivedId}
          onChange={(e) => setDerivedId(e.target.value)}
          placeholder="listeden seç veya uuid yapıştır"
        />
        <button type="button" disabled={busy || !derivedId.trim()} onClick={() => generate(false)}>
          {busy ? 'Üretiliyor…' : 'MP3 üret'}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy || !derivedId.trim()}
          onClick={() => generate(true)}
          style={{ marginLeft: '0.5rem' }}
        >
          Yeniden üret
        </button>
      </section>

      {imageMasters.length ? (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <h2>Görsel → platform export</h2>
          <p className="muted">Master görselden LinkedIn, X, IG, Pinterest vb. JPEG boyutları (sharp crop).</p>
          <HoverExpandList>
            {imageMasters.map((m) => (
              <HoverExpandRow
                key={m.id}
                summary={
                  <>
                    <strong className="hover-row-title">{m.derivedContent?.title || m.id}</strong>
                    <span className="muted hover-row-chip">
                      {formatSize(m.fileSize)} · {m.format}
                    </span>
                  </>
                }
              >
                <div className="row" style={{ marginTop: '0.35rem', gap: '0.5rem' }}>
                  <a
                    href={`/api/media/${m.id}/image`}
                    target="_blank"
                    rel="noreferrer"
                    className="secondary btn"
                    style={{ textDecoration: 'none', padding: '0.4rem 0.7rem' }}
                  >
                    Önizle
                  </a>
                  <button type="button" className="secondary" disabled={busy} onClick={() => batchResize(m.id)}>
                    Tüm platform boyutları
                  </button>
                </div>
              </HoverExpandRow>
            ))}
          </HoverExpandList>
        </section>
      ) : null}

      <section className="panel">
        <h2>Üretilmiş dosyalar (son {items.length})</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          FAILED kayıtlar gizli (ffmpeg denemesi artıkları). Filtre:{' '}
          <button
            type="button"
            className="secondary"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
            disabled={!derivedId.trim() || busy}
            onClick={() => loadFiles(adminKey, derivedId.trim())}
          >
            Bu ID’ye filtrele
          </button>{' '}
          <button
            type="button"
            className="secondary"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
            disabled={busy}
            onClick={() => loadFiles(adminKey)}
          >
            Tümünü göster
          </button>
        </p>
        <HoverExpandList>
          {items.map((m) => (
            <HoverExpandRow
              key={m.id}
              summary={
                <>
                  <span className="badge">{m.mediaType}</span>
                  <span
                    className={`badge ${m.processingStatus === 'COMPLETED' ? 'ok' : m.processingStatus === 'FAILED' ? 'danger' : 'warn'}`}
                  >
                    {m.processingStatus}
                  </span>
                  <strong className="hover-row-title">{m.derivedContent?.title || m.id}</strong>
                  <span className="muted hover-row-chip">{m.derivedContent?.contentType}</span>
                </>
              }
            >
              <div className="muted">
                {m.duration ? `~${m.duration}s` : ''} · {formatSize(m.fileSize)} · {m.format}
              </div>
              {m.processingStatus === 'COMPLETED' && m.mediaType === 'AUDIO' ? (
                <AdminAudio mediaId={m.id} adminKey={adminKey} />
              ) : null}
              {m.processingStatus === 'COMPLETED' && m.mediaType === 'IMAGE' ? (
                <img
                  src={`/api/media/${m.id}/image`}
                  alt=""
                  style={{ maxWidth: 200, marginTop: '0.5rem', borderRadius: 8 }}
                />
              ) : null}
            </HoverExpandRow>
          ))}
          {!items.length ? (
            <li className="muted hover-row" style={{ border: 'none', boxShadow: 'none' }}>
              Henüz medya dosyası yok
            </li>
          ) : null}
        </HoverExpandList>
      </section>
    </div>
  )
}
