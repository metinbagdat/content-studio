'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

type OAuthStatus = {
  twitter: { configured: boolean; callbackUrl: string }
  linkedin: { configured: boolean; callbackUrl: string; organizationId: string | null }
}

type Account = {
  id: string
  platform: string
  accountName: string
  isActive: boolean
  dryRun?: boolean
  oauth?: boolean
  tokenExpiry?: string | null
}

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export default function SocialPage() {
  const [adminKey, setAdminKey] = useState('')
  const [oauth, setOauth] = useState<OAuthStatus | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
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
    setOauth(data.oauth || null)
    setAccounts(data.accounts || [])
    setPosts(data.posts || [])
  }, [adminKey])

  useEffect(() => {
    const saved = localStorage.getItem('cs_admin_key')
    if (saved) setAdminKey(saved)
    else setAdminKey('dev-admin-change-me')

    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    if (connected === 'oauth') setMsg('OAuth bağlantısı başarılı — taslaklar senkronize edildi')
    else if (connected === 'dry') setMsg('Dry-run hesap bağlandı (gerçek SM’de görünmez)')
    else if (connected === 'error') {
      const reason = params.get('reason')
      setMsg(`OAuth hatası${reason ? `: ${reason}` : ''}`)
    }
    if (connected) window.history.replaceState({}, '', '/admin/social')
  }, [])

  useEffect(() => {
    if (adminKey) load()
  }, [adminKey, load])

  async function oauthConnect(platform: 'TWITTER' | 'LINKEDIN') {
    setBusyId(platform)
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: headers(adminKey, true),
      body: JSON.stringify({ action: 'connect-url', platform }),
    })
    const data = await res.json()
    setBusyId(null)
    if (!res.ok || !data.url) {
      setMsg(data.error || 'OAuth URL alınamadı — .env client ID/secret kontrol et')
      return
    }
    window.location.href = data.url
  }

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
    setMsg(`${platform} dry-run bağlı · ${data.sync?.draftsCreated ?? 0} taslak`)
    await load()
  }

  async function disconnect(accountId: string) {
    if (!confirm('Hesap bağlantısı kapatılsın mı?')) return
    setBusyId(accountId)
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: headers(adminKey, true),
      body: JSON.stringify({ action: 'disconnect', accountId }),
    })
    setBusyId(null)
    if (!res.ok) {
      setMsg('Bağlantı kesilemedi')
      return
    }
    setMsg('Hesap devre dışı')
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
      <p className="lead">
        Gerçek OAuth veya dry-run test. Rehber: <Link href="/docs/social-setup">SM kurulum</Link>
      </p>
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

      <section className="panel" style={{ marginBottom: '1rem' }}>
        <h2>OAuth bağlantı</h2>
        <div className="row" style={{ marginBottom: '0.5rem' }}>
          <span className="badge">X</span>
          {oauth?.twitter.configured ? (
            <span className="badge ok">env OK</span>
          ) : (
            <span className="badge warn">X_CLIENT_ID yok</span>
          )}
          <button
            type="button"
            className="ok"
            disabled={!oauth?.twitter.configured || busyId === 'TWITTER'}
            onClick={() => oauthConnect('TWITTER')}
          >
            OAuth ile X bağla
          </button>
        </div>
        <div className="row">
          <span className="badge">LinkedIn</span>
          {oauth?.linkedin.configured ? (
            <span className="badge ok">env OK</span>
          ) : (
            <span className="badge warn">LINKEDIN_CLIENT_ID yok</span>
          )}
          {oauth?.linkedin.organizationId ? (
            <span className="badge ok">org {oauth.linkedin.organizationId}</span>
          ) : (
            <span className="muted">kişisel post (org ID opsiyonel)</span>
          )}
          <button
            type="button"
            className="ok"
            disabled={!oauth?.linkedin.configured || busyId === 'LINKEDIN'}
            onClick={() => oauthConnect('LINKEDIN')}
          >
            OAuth ile LinkedIn bağla
          </button>
        </div>
        <p className="muted" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          Callback: {oauth?.twitter.callbackUrl} · {oauth?.linkedin.callbackUrl}
        </p>
      </section>

      <div className="row" style={{ marginBottom: '1rem' }}>
        <button type="button" className="secondary" onClick={() => dryConnect('TWITTER')}>
          Dry-run X
        </button>
        <button type="button" className="secondary" onClick={() => dryConnect('LINKEDIN')}>
          Dry-run LinkedIn
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
              <div className="row">
                <span className="badge">{a.platform}</span> {a.accountName}
                {a.isActive ? <span className="badge ok">active</span> : <span className="badge">off</span>}
                {a.dryRun ? <span className="badge warn">dry-run</span> : null}
                {a.oauth ? <span className="badge ok">oauth</span> : null}
              </div>
              {a.isActive ? (
                <button type="button" className="secondary" style={{ marginTop: '0.35rem' }} disabled={busyId === a.id} onClick={() => disconnect(a.id)}>
                  Bağlantıyı kes
                </button>
              ) : null}
            </li>
          ))}
          {!accounts.length ? <li className="muted">Hesap yok — OAuth veya dry-run bağla</li> : null}
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
            <li className="muted">Onaylı caption + bağlı hesap → taslak oluşur (veya senkronize et)</li>
          ) : null}
        </ul>
      </section>
    </div>
  )
}
