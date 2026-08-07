'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@/lib/adminKey'

type TopPost = {
  id: string
  platform: string
  postContent: string
  publishedAt: string | null
  score: number
  metrics: Record<string, number> | null
}

type PlatformSummary = {
  platform: string
  postCount: number
  avgScore: number
}

type AnalyticsData = {
  topPosts: TopPost[]
  platformSummary: PlatformSummary[]
}

function headers(key: string): HeadersInit {
  return { 'x-admin-key': key }
}

export default function AnalyticsPage() {
  const [adminKey, setAdminKey] = useState('')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    if (!adminKey) return
    const res = await fetch('/api/admin/post-performance', { headers: headers(adminKey), cache: 'no-store' })
    if (!res.ok) {
      setMsg(`API hatası ${res.status}`)
      setData(null)
      return
    }
    const json = await res.json()
    setData(json)
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

  return (
    <div>
      <h1>Performans</h1>
      <p className="lead">Yayınlanmış postların engagement skoru ve platform bazlı özet.</p>

      <div className="keybar">
        <div style={{ flex: 1 }}>
          <label>Admin API key</label>
          <input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} />
        </div>
        <button type="button" className="secondary" onClick={load}>
          Yenile
        </button>
      </div>
      {msg ? <p className="flash">{msg}</p> : null}

      <section className="panel" style={{ marginBottom: '1.5rem' }}>
        <h2>Platform özeti</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Platform</th>
              <th style={{ textAlign: 'left' }}>Post sayısı</th>
              <th style={{ textAlign: 'left' }}>Ort. skor</th>
            </tr>
          </thead>
          <tbody>
            {(data?.platformSummary || []).map((p) => (
              <tr key={p.platform}>
                <td>{p.platform}</td>
                <td>{p.postCount}</td>
                <td>{p.avgScore.toFixed(1)}</td>
              </tr>
            ))}
            {!data?.platformSummary?.length ? (
              <tr>
                <td colSpan={3} className="muted">
                  Henüz veri yok
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>En iyi performans gösteren postlar</h2>
        <ul className="list">
          {(data?.topPosts || []).map((post) => (
            <li key={post.id} className="panel" style={{ marginBottom: '0.5rem' }}>
              <div className="row">
                <span className={`badge plat-${post.platform}`}>{post.platform}</span>
                <span className="badge">skor: {post.score.toFixed(1)}</span>
                <span className="muted">
                  {post.publishedAt ? new Date(post.publishedAt).toLocaleString('tr-TR') : '—'}
                </span>
              </div>
              <div className="pre">{post.postContent.slice(0, 200)}</div>
            </li>
          ))}
          {!data?.topPosts?.length ? <li className="muted">Henüz veri yok</li> : null}
        </ul>
      </section>
    </div>
  )
}