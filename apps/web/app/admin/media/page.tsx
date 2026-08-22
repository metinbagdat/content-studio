'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@/lib/adminKey'
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

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
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
  const [ttsMode, setTtsMode] = useState('')
  const [derivedId, setDerivedId] = useState('')
  const [contentType, setContentType] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!adminKey) return
    const q = derivedId ? `?derivedContentId=${encodeURIComponent(derivedId)}` : ''
    const res = await fetch(`/api/media${q}`, { headers: headers(adminKey), cache: 'no-store' })
    if (!res.ok) {
      setMsg('Yetkisiz')
      return
    }
    const data = await res.json()
    setItems(data.items || [])
    setTtsMode(data.ttsMode || '')
    if (derivedId && data.items?.[0]?.derivedContent?.contentType) {
      setContentType(data.items[0].derivedContent.contentType)
    }
  }, [adminKey, derivedId])

  useEffect(() => {
    const saved = localStorage.getItem('cs_admin_key')
    if (saved) setAdminKey(saved)
    else setAdminKey(DEFAULT_ADMIN_API_KEY)

    const params = new URLSearchParams(window.location.search)
    const derived = params.get('derived')
    if (derived) setDerivedId(derived)
  }, [])

  useEffect(() => {
    if (adminKey) load()
  }, [adminKey, load])

  async function generate(force = false) {
    if (!derivedId.trim()) {
      setMsg('Derived content ID gir')
      return
    }
    setBusy(true)
    const kind =
      contentType === 'MARCH_LYRICS'
        ? 'march'
        : contentType === 'SONG_LYRICS'
          ? 'song'
          : 'podcast'
    setMsg(
      force
        ? 'Yeniden üretiliyor…'
        : kind === 'podcast'
          ? 'Ses üretiliyor… (segment başına jingle dahil, 30–120 sn)'
          : 'Ses + müzik yatağı üretiliyor…',
    )
    const res = await fetch('/api/media/generate', {
      method: 'POST',
      headers: headers(adminKey, true),
      body: JSON.stringify({ derivedContentId: derivedId.trim(), kind, force }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setMsg(data.error || 'Üretim başarısız')
      return
    }
    setMsg(
      data.reused
        ? `Mevcut ses kullanıldı — yeniden üretmek için "Yeniden üret" butonuna bas`
        : kind === 'podcast'
          ? `Podcast hazır · ~${data.durationSec}s · ${data.partCount ?? '?'} bölüm · ${data.hasJingles ? `${data.jingleCount} jingle` : 'jingle yok (müzik kütüphanesi boş)'}`
          : `Ses hazır${data.hasMusicBed ? ' · müzik yatağı ile' : ''}`,
    )
    await load()
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
      <h1>Medya (Faz 2)</h1>
      <p className="lead">
        Podcast / marş / şarkı → MP3 · Görseller → platform export. TTS: <strong>{ttsMode || '…'}</strong>
      </p>
      <p className="muted">
        Onay kuyruğundan ID kopyala veya{' '}
        <Link href="/admin/review">/admin/review</Link> → Ses / AI görsel üret.
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
        <button type="button" className="secondary" onClick={load}>
          Yenile
        </button>
      </div>

      <section className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Ses üret</h2>
        <label>Derived ID (PODCAST_SCRIPT / MARCH_LYRICS / SONG_LYRICS)</label>
        <input
          value={derivedId}
          onChange={(e) => setDerivedId(e.target.value)}
          placeholder="uuid from /admin/review"
        />
        <button type="button" disabled={busy} onClick={() => generate(false)}>
          {busy ? 'Üretiliyor…' : 'MP3 üret'}
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={() => generate(true)} style={{ marginLeft: '0.5rem' }}>
          Yeniden üret
        </button>
        {msg ? <p className="muted" style={{ marginBottom: 0 }}>{msg}</p> : null}
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
                  <a href={`/api/media/${m.id}/image`} target="_blank" rel="noreferrer" className="secondary btn" style={{ textDecoration: 'none', padding: '0.4rem 0.7rem' }}>
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
        <h2>Üretilmiş dosyalar</h2>
        <HoverExpandList>
          {items.map((m) => (
            <HoverExpandRow
              key={m.id}
              summary={
                <>
                  <span className="badge">{m.mediaType}</span>
                  <span className={`badge ${m.processingStatus === 'COMPLETED' ? 'ok' : m.processingStatus === 'FAILED' ? 'danger' : 'warn'}`}>
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
          {!items.length ? <li className="muted hover-row" style={{ border: 'none', boxShadow: 'none' }}>Henüz medya dosyası yok</li> : null}
        </HoverExpandList>
      </section>
    </div>
  )
}
