'use client'

import { useCallback, useEffect, useState } from 'react'

function headers(key: string): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-admin-key': key }
}

export default function SocialPage() {
  const [adminKey, setAdminKey] = useState('')
  const [accounts, setAccounts] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    if (!adminKey) return
    const res = await fetch('/api/social', { headers: headers(adminKey) })
    if (!res.ok) {
      setMsg('Yetkisiz')
      return
    }
    const data = await res.json()
    setAccounts(data.accounts || [])
    setPosts(data.posts || [])
  }, [adminKey])

  useEffect(() => {
    const saved = localStorage.getItem('cs_admin_key')
    if (saved) setAdminKey(saved)
  }, [])

  useEffect(() => {
    if (adminKey) load()
  }, [adminKey, load])

  async function dryConnect(platform: 'TWITTER' | 'LINKEDIN') {
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: headers(adminKey),
      body: JSON.stringify({ action: 'dry-run-connect', platform }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg(data.error || 'fail')
      return
    }
    setMsg(`${platform} dry-run bağlı`)
    await load()
  }

  async function publishNow(postId: string) {
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: headers(adminKey),
      body: JSON.stringify({ action: 'publish-now', postId }),
    })
    const data = await res.json()
    setMsg(res.ok ? `Published: ${data.platformPostId}` : data.error || 'fail')
    await load()
  }

  async function schedule(postId: string) {
    const when = new Date(Date.now() + 5 * 60_000).toISOString()
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: headers(adminKey),
      body: JSON.stringify({ action: 'schedule', postId, scheduledAt: when }),
    })
    setMsg(res.ok ? `Scheduled ${when}` : 'schedule fail')
    await load()
  }

  return (
    <div>
      <h1>Sosyal hesaplar</h1>
      <p className="lead">X + LinkedIn. OAuth env yoksa dry-run hesap kullan.</p>
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
      {msg ? <p className="muted">{msg}</p> : null}

      <div className="row" style={{ marginBottom: '1rem' }}>
        <button type="button" onClick={() => dryConnect('TWITTER')}>
          Dry-run X bağla
        </button>
        <button type="button" onClick={() => dryConnect('LINKEDIN')}>
          Dry-run LinkedIn bağla
        </button>
      </div>

      <section className="panel">
        <h2>Hesaplar</h2>
        <ul className="list">
          {accounts.map((a) => (
            <li key={a.id}>
              <span className="badge">{a.platform}</span> {a.accountName}{' '}
              {a.isActive ? <span className="badge ok">active</span> : null}
            </li>
          ))}
          {!accounts.length ? <li className="muted">Hesap yok</li> : null}
        </ul>
      </section>

      <section className="panel" style={{ marginTop: '1rem' }}>
        <h2>Post taslakları</h2>
        <ul className="list">
          {posts.map((p) => (
            <li key={p.id}>
              <div className="row">
                <span className="badge">{p.platform}</span>
                <span className={`badge ${p.status === 'PUBLISHED' ? 'ok' : 'warn'}`}>{p.status}</span>
              </div>
              <div className="pre">{p.postContent}</div>
              <div className="row">
                <button type="button" className="ok" onClick={() => publishNow(p.id)}>
                  Şimdi yayınla
                </button>
                <button type="button" className="secondary" onClick={() => schedule(p.id)}>
                  +5 dk schedule
                </button>
              </div>
            </li>
          ))}
          {!posts.length ? (
            <li className="muted">Önce SOCIAL_CAPTION onayla (hesap bağlıysa taslak oluşur)</li>
          ) : null}
        </ul>
      </section>
    </div>
  )
}
