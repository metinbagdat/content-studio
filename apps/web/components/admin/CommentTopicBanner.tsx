'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { DigestTopicSummary, EngagementDigest } from '@/lib/social/engagementDigest'

export const ENGAGEMENT_DIGEST_CACHE_KEY = 'cs_engagement_digest_v1'

function readCachedTopic(): { topic: DigestTopicSummary; fetchedAt: string } | null {
  try {
    const raw = localStorage.getItem(ENGAGEMENT_DIGEST_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as EngagementDigest
    if (!parsed?.topic?.title || !parsed.fetchedAt) return null
    return { topic: parsed.topic, fetchedAt: parsed.fetchedAt }
  } catch {
    return null
  }
}

/** Compact CS-08 strip: consolidated comment themes while approving captions. */
export function CommentTopicBanner({ adminKey }: { adminKey: string }) {
  const [topic, setTopic] = useState<DigestTopicSummary | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const cached = readCachedTopic()
    if (cached) {
      setTopic(cached.topic)
      setFetchedAt(cached.fetchedAt)
    }
  }, [])

  const refreshLight = useCallback(async () => {
    if (!adminKey) return
    setBusy(true)
    setErr('')
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'engagement-digest',
          syncFirst: false,
          fetchCommentText: false,
        }),
      })
      const data = (await res.json()) as { digest?: EngagementDigest; error?: string }
      if (!res.ok || !data.digest?.topic) {
        setErr(data.error || `Derleme ${res.status}`)
        return
      }
      setTopic(data.digest.topic)
      setFetchedAt(data.digest.fetchedAt)
      try {
        localStorage.setItem(ENGAGEMENT_DIGEST_CACHE_KEY, JSON.stringify(data.digest))
      } catch {
        /* ignore */
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [adminKey])

  if (!topic && !busy && !err) {
    return (
      <section className="panel digest-topic-banner" style={{ marginBottom: '1rem' }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            Yorum özeti henüz yok — onaylarken hangi temayı güçlendireceğini görmek için derle.
          </p>
          <div className="row" style={{ gap: '0.5rem' }}>
            <button type="button" className="secondary" disabled={busy || !adminKey} onClick={() => void refreshLight()}>
              Özeti çek
            </button>
            <Link href="/admin/comments" className="admin-nav-link">
              Yorumlar →
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="panel digest-topic-banner" style={{ marginBottom: '1rem' }} aria-label="Yorum özet konusu">
      <div className="row" style={{ justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="digest-topic-kicker" style={{ margin: 0 }}>
            Yorumlardan gelen özet konusu
          </p>
          {topic ? (
            <>
              <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.05rem' }}>{topic.title}</h2>
              <p className="muted" style={{ margin: '0.3rem 0 0', fontSize: '0.84rem' }}>
                {topic.headline}
                {fetchedAt ? ` · ${new Date(fetchedAt).toLocaleString('tr-TR')}` : ''}
              </p>
              {topic.changeChecklist.length ? (
                <ul className="digest-banner-checklist">
                  {topic.changeChecklist.slice(0, 3).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: '0.45rem 0 0', fontSize: '0.86rem' }}>{topic.body}</p>
              )}
            </>
          ) : null}
          {err ? <p className="flash" style={{ marginTop: '0.5rem' }}>{err}</p> : null}
        </div>
        <div className="row" style={{ gap: '0.5rem', flexShrink: 0 }}>
          <button type="button" className="secondary" disabled={busy || !adminKey} onClick={() => void refreshLight()}>
            {busy ? '…' : 'Yenile'}
          </button>
          <Link href="/admin/comments">Tam derleme →</Link>
        </div>
      </div>
    </section>
  )
}
