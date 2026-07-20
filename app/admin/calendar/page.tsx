'use client'

import { useCallback, useEffect, useState } from 'react'

function headers(key: string): HeadersInit {
  return { 'x-admin-key': key }
}

export default function CalendarPage() {
  const [adminKey, setAdminKey] = useState('')
  const [posts, setPosts] = useState<any[]>([])

  const load = useCallback(async () => {
    if (!adminKey) return
    const res = await fetch('/api/social', { headers: headers(adminKey) })
    if (!res.ok) return
    const data = await res.json()
    const sorted = (data.posts || []).slice().sort((a: any, b: any) => {
      const ta = a.scheduledAt || a.publishedAt || a.createdAt
      const tb = b.scheduledAt || b.publishedAt || b.createdAt
      return new Date(ta).getTime() - new Date(tb).getTime()
    })
    setPosts(sorted)
  }, [adminKey])

  useEffect(() => {
    const saved = localStorage.getItem('cs_admin_key')
    if (saved) setAdminKey(saved)
  }, [])

  useEffect(() => {
    if (adminKey) load()
  }, [adminKey, load])

  return (
    <div>
      <h1>Takvim</h1>
      <p className="lead">Haftalık 3–5 slot hedefi — planlanan ve yayınlanan postlar.</p>
      <div className="keybar">
        <div style={{ flex: 1 }}>
          <label>Admin API key</label>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
          />
        </div>
        <button type="button" className="secondary" onClick={load}>
          Yenile
        </button>
      </div>

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
