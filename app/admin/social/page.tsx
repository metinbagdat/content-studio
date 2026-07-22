'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { socialPostPublicUrl } from '@/lib/social/postUrl'

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

async function parseApiJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  if (!text.trim()) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { error: text.slice(0, 300) || res.statusText }
  }
}

function PostImagePreview({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--danger)' }}>
        Görsel yüklenemedi — &quot;Görselleri senkronize et&quot; deneyin
      </p>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      style={{ marginTop: '0.5rem', maxWidth: '320px', maxHeight: '180px', borderRadius: '8px', border: '1px solid var(--border)' }}
      onError={() => setFailed(true)}
    />
  )
}

export default function SocialPage() {
  const [adminKey, setAdminKey] = useState('')
  const [oauth, setOauth] = useState<OAuthStatus | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [imagesSynced, setImagesSynced] = useState(false)

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

  useEffect(() => {
    if (!adminKey || imagesSynced) return
    ;(async () => {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'sync-images' }),
      })
      if (res.ok) {
        setImagesSynced(true)
        await load()
      }
    })()
  }, [adminKey, imagesSynced, load])

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

  async function syncImages() {
    setBusyId('sync-images')
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: headers(adminKey, true),
      body: JSON.stringify({ action: 'sync-images' }),
    })
    const data = await parseApiJson(res)
    setBusyId(null)
    if (!res.ok) {
      setMsg(String(data.error || 'Görsel senkron başarısız'))
      return
    }
    setMsg(`${String(data.postsUpdated ?? 0)} posta görsel bağlandı`)
    await load()
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

  async function publishNow(postId: string, replace = false) {
    setBusyId(postId)
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: headers(adminKey, true),
      body: JSON.stringify({ action: 'publish-now', postId, replace, force: replace }),
    })
    const data = await parseApiJson(res)
    setBusyId(null)
    if (res.ok) {
      if (data.skipped) {
        setMsg(String(data.reason || 'Değişiklik yok — çift paylaşım engellendi'))
      } else if (data.imageError) {
        setMsg(`Yayınlandı ama görsel hatası: ${String(data.imageError)}`)
      } else if (data.replaced) {
        setMsg(`Platformda güncellendi (eski silindi): ${String(data.platformPostId || 'ok')}`)
      } else {
        setMsg(`Yayınlandı: ${String(data.platformPostId || 'ok')}`)
      }
    } else {
      setMsg(String(data.error || `Yayın başarısız (${res.status})`))
    }
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

  function startEdit(post: { id: string; postContent: string; mediaUrls?: string[] }) {
    setEditingId(post.id)
    setEditContent(post.postContent)
    setEditImageUrl(post.mediaUrls?.[0] || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditContent('')
    setEditImageUrl('')
  }

  async function saveEdit(postId: string) {
    setBusyId(postId)
    const mediaUrls = editImageUrl.trim() ? [editImageUrl.trim()] : []
    const res = await fetch(`/api/social/posts/${postId}`, {
      method: 'PATCH',
      headers: headers(adminKey, true),
      body: JSON.stringify({ postContent: editContent, mediaUrls }),
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

  async function updateOnPlatform(postId: string) {
    if (!confirm('Eski paylaşım platformdan silinir, güncel içerik+görsel ile tek post kalır. Devam?')) return
    setBusyId(postId)
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: headers(adminKey, true),
      body: JSON.stringify({ action: 'update-on-platform', postId }),
    })
    const data = await parseApiJson(res)
    setBusyId(null)
    if (!res.ok) {
      setMsg(String(data.error || 'Güncelleme başarısız'))
      return
    }
    if (data.imageError) {
      setMsg(`Güncellendi ama görsel hatası: ${String(data.imageError)}`)
    } else {
      setMsg(`Platformda güncellendi: ${String(data.platformPostId || 'ok')}`)
    }
    await load()
  }

  async function publishCaptionAll(derivedContentId: string) {
    setBusyId(derivedContentId)
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: headers(adminKey, true),
      body: JSON.stringify({ action: 'publish-caption', derivedContentId }),
    })
    const data = await parseApiJson(res)
    setBusyId(null)
    if (!res.ok) {
      setMsg(String(data.error || 'Yayın başarısız'))
      return
    }
    setMsg(
      `Görsel + ${String(data.published ?? 0)} yayın, ${String(data.skipped ?? 0)} atlandı (değişmedi)`,
    )
    await load()
  }

  const draftCaptionIds = [
    ...new Set(
      posts
        .filter((p) => canMutate(p.status))
        .map((p) => p.derivedContentId as string)
        .filter(Boolean),
    ),
  ]

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
        <button type="button" className="secondary" disabled={busyId === 'sync-images'} onClick={syncImages}>
          Görselleri senkronize et
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
        {draftCaptionIds.length ? (
          <div className="row" style={{ marginBottom: '0.75rem' }}>
            {draftCaptionIds.map((cid) => (
              <button
                key={cid}
                type="button"
                className="ok"
                disabled={busyId === cid}
                onClick={() => publishCaptionAll(cid)}
              >
                Otomatik görsel + platformda yayınla / güncelle
              </button>
            ))}
          </div>
        ) : null}
        <ul className="list">
          {posts.map((p) => (
            <li key={p.id}>
              <div className="row">
                <span className="badge">{p.platform}</span>
                <span className={`badge ${p.status === 'PUBLISHED' ? 'ok' : p.status === 'FAILED' ? 'danger' : 'warn'}`}>
                  {p.status}
                </span>
                {p.status === 'PUBLISHED' && p.imageAttached === true ? (
                  <span className="badge ok">görsel OK</span>
                ) : null}
                {p.imageError ? (
                  <span className="badge danger" title={String(p.imageError)}>
                    görsel hata
                  </span>
                ) : null}
                {p.scheduledAt ? (
                  <span className="muted">{new Date(p.scheduledAt).toLocaleString('tr-TR')}</span>
                ) : null}
              </div>
              {editingId === p.id ? (
                <>
                  <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} style={{ marginTop: '0.5rem' }} />
                  <div style={{ marginTop: '0.5rem' }}>
                    <label className="muted" style={{ display: 'block', marginBottom: '0.25rem' }}>
                      Görsel URL (LinkedIn paylaşımı)
                    </label>
                    <input
                      type="url"
                      value={editImageUrl}
                      onChange={(e) => setEditImageUrl(e.target.value)}
                      placeholder="https://www.egitim.today/opengraph-image.png"
                      style={{ width: '100%' }}
                    />
                    {editImageUrl.trim() ? (
                      <img
                        src={editImageUrl.trim()}
                        alt="Önizleme"
                        style={{ marginTop: '0.5rem', maxWidth: '280px', maxHeight: '160px', borderRadius: '6px' }}
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.82rem' }}>
                        Boş bırakılırsa içeriğe uygun otomatik kart görseli üretilir.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="pre">{p.postContent}</div>
                  {p.imagePreviewUrl ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <PostImagePreview src={p.imagePreviewUrl} alt="Post görseli" />
                      <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.78rem' }}>
                        {p.mediaUrls?.[0] || p.imagePreviewUrl}
                      </p>
                    </div>
                  ) : (
                    <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.82rem' }}>
                      Görsel henüz yok — &quot;Görselleri senkronize et&quot; veya yayınla
                    </p>
                  )}
                </>
              )}
              {p.status === 'PUBLISHED' && p.platformPostId ? (
                <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.82rem' }}>
                  {socialPostPublicUrl(p.platform, p.platformPostId) ? (
                    <a href={socialPostPublicUrl(p.platform, p.platformPostId)!} target="_blank" rel="noreferrer">
                      LinkedIn&apos;de aç
                    </a>
                  ) : (
                    <>ID: {p.platformPostId} (dry-run — gerçek link yok)</>
                  )}
                </p>
              ) : null}
              {p.imageError ? (
                <p className="muted" style={{ margin: '0.35rem 0 0', color: 'var(--danger)', fontSize: '0.82rem' }}>
                  Görsel: {String(p.imageError).slice(0, 240)}
                </p>
              ) : null}
              {p.status === 'FAILED' && p.error ? (
                <p className="muted" style={{ margin: '0.35rem 0 0', color: 'var(--danger)', fontSize: '0.82rem' }}>
                  {String(p.error).slice(0, 200)}
                </p>
              ) : null}
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
                    {p.status === 'PUBLISHED' && p.platform === 'LINKEDIN' && p.account?.accountName && !String(p.platformPostId || '').startsWith('mock_') ? (
                      <button type="button" className="secondary" disabled={busyId === p.id} onClick={() => updateOnPlatform(p.id)}>
                        Platformda güncelle (eski sil)
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
