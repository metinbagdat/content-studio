'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { DEFAULT_ADMIN_API_KEY } from '@/lib/adminKey'
import { EngagementDigestPanel } from '@/components/admin/EngagementDigestPanel'
import type { EngagementDigest } from '@/lib/social/engagementDigest'
import { ENGAGEMENT_DIGEST_CACHE_KEY } from '@/components/admin/CommentTopicBanner'

const CACHE_KEY = ENGAGEMENT_DIGEST_CACHE_KEY

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

async function parseApiJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

function readCachedDigest(): EngagementDigest | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as EngagementDigest
    if (!parsed?.topic || !parsed.fetchedAt) return null
    return parsed
  } catch {
    return null
  }
}

export default function CommentsPage() {
  const [adminKey, setAdminKey] = useState('')
  const [digest, setDigest] = useState<EngagementDigest | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [autoNote, setAutoNote] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('cs_admin_key')
    setAdminKey(saved || DEFAULT_ADMIN_API_KEY)
    const cached = readCachedDigest()
    if (cached) {
      setDigest(cached)
      setAutoNote(
        `Son kayıtlı özet · ${new Date(cached.fetchedAt).toLocaleString('tr-TR')} — arka planda yenileniyor…`,
      )
    }
  }, [])

  const refresh = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!adminKey) return
      setBusy(true)
      if (!opts?.quiet) setMsg('')
      try {
        const res = await fetch('/api/social', {
          method: 'POST',
          headers: headers(adminKey, true),
          body: JSON.stringify({ action: 'engagement-digest' }),
        })
        const data = await parseApiJson(res)
        if (!res.ok) {
          setMsg(String(data.error || `Derleme başarısız (${res.status})`))
          setAutoNote('')
          return
        }
        const next = data.digest as EngagementDigest
        setDigest(next)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(next))
        } catch {
          /* ignore quota */
        }
        setAutoNote(`Otomatik derleme · ${new Date(next.fetchedAt).toLocaleString('tr-TR')}`)
        setMsg(
          `${next.topic.title} — ${next.topic.stats.totalComments} yorum, ${next.posts.length} gönderi`,
        )
      } catch (err) {
        setMsg(`Derleme hatası: ${err instanceof Error ? err.message : String(err)}`)
        setAutoNote('')
      } finally {
        setBusy(false)
      }
    },
    [adminKey],
  )

  useEffect(() => {
    if (!adminKey) return
    localStorage.setItem('cs_admin_key', adminKey)
    void refresh({ quiet: true })
  }, [adminKey, refresh])

  return (
    <div>
      <h1>Yorumlar</h1>
      <p className="lead">
        Gelen yorum ve geri bildirimin konsolide özet konusu — otomatik derlenir, yanıt/DM yok. İçerik
        değişikliklerini buradan sistematik kontrol et. Sosyal yayın için{' '}
        <Link href="/admin/social">Sosyal</Link>.
      </p>

      <div className="keybar">
        <div style={{ flex: 1 }}>
          <label>Admin API key</label>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            autoComplete="off"
          />
        </div>
        <button type="button" className="secondary" disabled={busy} onClick={() => void refresh()}>
          {busy ? 'Derleniyor…' : 'Yenile'}
        </button>
      </div>
      {msg ? <p className="flash">{msg}</p> : null}

      <EngagementDigestPanel
        digest={digest}
        busy={busy}
        onRefresh={() => void refresh()}
        autoNote={autoNote}
      />
    </div>
  )
}
