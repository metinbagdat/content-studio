'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@/lib/adminKey'

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

  async function generate() {
    if (!derivedId.trim()) {
      setMsg('Podcast script ID gir (PODCAST_SCRIPT türevi)')
      return
    }
    setBusy(true)
    setMsg('Ses üretiliyor… (30–90 sn sürebilir)')
    const res = await fetch('/api/media/generate', {
      method: 'POST',
      headers: headers(adminKey, true),
      body: JSON.stringify({ derivedContentId: derivedId.trim() }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) {
      setMsg(data.error || 'Üretim başarısız')
      return
    }
    setMsg(
      data.reused
        ? `Mevcut ses kullanıldı (${data.mode})`
        : `Podcast hazır · ~${data.durationSec}s · ${data.mode}`,
    )
    await load()
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return '—'
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div>
      <h1>Medya (Faz 2a)</h1>
      <p className="lead">
        Podcast script → dinlenebilir MP3. TTS: <strong>{ttsMode || '…'}</strong>
      </p>
      <p className="muted">
        Onay kuyruğundan PODCAST_SCRIPT ID kopyala veya{' '}
        <Link href="/admin/review">/admin/review</Link> → &quot;Ses üret&quot;.
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
        <h2>Podcast ses üret</h2>
        <label>PODCAST_SCRIPT derived ID</label>
        <input
          value={derivedId}
          onChange={(e) => setDerivedId(e.target.value)}
          placeholder="uuid from /admin/review"
        />
        <button type="button" disabled={busy} onClick={generate}>
          {busy ? 'Üretiliyor…' : 'MP3 üret'}
        </button>
        {msg ? <p className="muted" style={{ marginBottom: 0 }}>{msg}</p> : null}
      </section>

      <section className="panel">
        <h2>Üretilmiş dosyalar</h2>
        <ul className="list">
          {items.map((m) => (
            <li key={m.id}>
              <div className="row">
                <span className="badge">{m.mediaType}</span>
                <span className={`badge ${m.processingStatus === 'COMPLETED' ? 'ok' : m.processingStatus === 'FAILED' ? 'danger' : 'warn'}`}>
                  {m.processingStatus}
                </span>
                <span className="muted">{m.derivedContent?.contentType}</span>
              </div>
              <strong>{m.derivedContent?.title || m.id}</strong>
              <div className="muted">
                {m.duration ? `~${m.duration}s` : ''} · {formatSize(m.fileSize)} · {m.format}
              </div>
              {m.processingStatus === 'COMPLETED' ? (
                <AdminAudio mediaId={m.id} adminKey={adminKey} />
              ) : null}
            </li>
          ))}
          {!items.length ? <li className="muted">Henüz ses dosyası yok</li> : null}
        </ul>
      </section>
    </div>
  )
}
