'use client'

import { useCallback, useEffect, useState } from 'react'

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export default function SocialPage() {
  const [adminKey, setAdminKey] = useState('')
  const [accounts, setAccounts] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!adminKey) return
    const res = await fetch('/api/social', { headers: headers(adminKey), cache: 'no-store' })
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
    else setAdminKey('dev-admin-change-me')
  }, [])

  useEffect(() => {
    if (adminKey) load()
  }, [adminKey, load])

  async function syncDrafts() {
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: headers(adminKey, true),
      body: JSON.stringify({ action: 'sync-drafts' }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg(data.error || 'Senkron başarısız')
      return
    }
    setMsg(`${data.draftsCreated} taslak oluşturuldu (${data.captions} onaylı caption)`)
    await load()
  }

  async function dryConnect(platform: 'TWITTER' | 'LINKEDIN') {
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: headers(adminKey, true),
      body: JSON.stringify({ action: 'dry-run-connect', platform }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg(data.error || 'fail')
      return
    }
    setMsg(res.ok ? `${platform} dry-run bağlı · ${data.sync?.draftsCreated ?? 0} taslak` : data.error || 'fail')
    await load()
  }

  async function publishNow(postId: string) {
    setBusyId(postId)
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: headers(adminKey, true),
      body: JSON.stringify({ action: 'publish-now', postId }),
    })
    const data = await res.json()
    setBusyId(null)
    setMsg(res.ok ? `Published: ${data.platformPostId}` : data.error || 'fail')
    await load()
  }

  async function schedule(postId: string) {
    const when = new Date(Date.now() + 5 * 60_000).toISOString()
    setBusyId(postId)
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: headers(adminKey, true),
      body: JSON.stringify({ action: 'schedule', postId, scheduledAt: when }),
    })
    setBusyId(null)
    setMsg(res.ok ? `Scheduled ${when}` : 'schedule fail')
    await load()
  }

  function startEdit(post: { id: string; postContent: string }) {
    setEditingId(post.id)
    setEditContent(post.postContent)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditContent('')
  }

  async function saveEdit(postId: string) {
    setBusyId(postId)
    const res = await fetch(`/api/social/posts/${postId}`, {
      method: 'PATCH',
      headers: headers(adminKey, true),
      body: JSON.stringify({ postContent: editContent }),
    })
    setBusyId(null)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(data.error || 'Kaydetme başarısız')
      return
    }
    setMsg('Post güncellendi (caption ile senkron)')
    cancelEdit()
    await load()
  }

  async function cancelSchedule(postId: string) {
    setBusyId(postId)
    const res = await fetch(`/api/social/posts/${postId}`, {
      method: 'PATCH',
      headers: headers(adminKey, true),
      body: JSON.stringify({ cancelSchedule: true }),
    })
    setBusyId(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg(data.error || 'İptal başarısız')
      return
    }
    setMsg('Zamanlama iptal — taslak')
    await load()
  }

  async function removePost(postId: string) {
    if (!confirm('Post taslağı silinsin mi?')) return
    setBusyId(postId)
    const res = await fetch(`/api/social/posts/${postId}`, { method: 'DELETE', headers: headers(adminKey) })
    setBusyId(null)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(data.error || 'Silme başarısız')
      return
    }
    setMsg('Post silindi')
    await load()
  }

  const canMutate = (status: string) => ['DRAFT', 'SCHEDULED', 'FAILED'].includes(status)

  return (
    <div>
      <h1>Sosyal hesaplar</h1>
      <p className="lead">X + LinkedIn — post düzenle, zamanla, iptal et veya sil.</p>
      <div className="keybar">
        <div style={{ flex: 1 }}>
          <label>Admin API key</label>
          <input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} />
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
        <button type="button" className="secondary" onClick={syncDrafts}>
          Taslakları senkronize et
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
                <span className={`badge ${p.status === 'PUBLISHED' ? 'ok' : p.status === 'FAILED' ? 'danger' : 'warn'}`}>
                  {p.status}
                </span>
                {p.scheduledAt ? (
                  <span className="muted">{new Date(p.scheduledAt).toLocaleString('tr-TR')}</span>
                ) : null}
              </div>
              {editingId === p.id ? (
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} style={{ marginTop: '0.5rem' }} />
              ) : (
                <div className="pre">{p.postContent}</div>
              )}
              <div className="row" style={{ marginTop: '0.5rem' }}>
                {editingId === p.id ? (
                  <>
                    <button type="button" className="ok" disabled={busyId === p.id} onClick={() => saveEdit(p.id)}>
                      Kaydet
                    </button>
                    <button type="button" className="secondary" onClick={cancelEdit}>
                      İptal
                    </button>
                  </>
                ) : (
                  <>
                    {canMutate(p.status) ? (
                      <button type="button" className="secondary" disabled={busyId === p.id} onClick={() => startEdit(p)}>
                        Düzenle
                      </button>
                    ) : null}
                    {canMutate(p.status) ? (
                      <button type="button" className="ok" disabled={busyId === p.id} onClick={() => publishNow(p.id)}>
                        Şimdi yayınla
                      </button>
                    ) : null}
                    {canMutate(p.status) ? (
                      <button type="button" className="secondary" disabled={busyId === p.id} onClick={() => schedule(p.id)}>
                        +5 dk schedule
                      </button>
                    ) : null}
                    {p.status === 'SCHEDULED' ? (
                      <button type="button" className="secondary" disabled={busyId === p.id} onClick={() => cancelSchedule(p.id)}>
                        Zamanlamayı iptal
                      </button>
                    ) : null}
                    {canMutate(p.status) ? (
                      <button type="button" className="danger" disabled={busyId === p.id} onClick={() => removePost(p.id)}>
                        Sil
                      </button>
                    ) : null}
                  </>
                )}
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
