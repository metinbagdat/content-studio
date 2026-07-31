'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { socialPostPublicUrl } from '@/lib/social/postUrl'
import { DEFAULT_ADMIN_API_KEY } from '@/lib/adminKey'

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

type AccountSlot = {
  platform: string
  label: string
  status: string
  detail: string
  failedPosts: number
  oauthConfigured: boolean
}

type AccountHealth = {
  slots: AccountSlot[]
  missingCount: number
  brokenCount: number
  repaired: string[]
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
  const [accountHealth, setAccountHealth] = useState<AccountHealth | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [imagesSynced, setImagesSynced] = useState(false)
  const [hideDryRun, setHideDryRun] = useState(true)

  const load = useCallback(async () => {
    if (!adminKey) return
    const res = await fetch('/api/social', { headers: headers(adminKey), cache: 'no-store' })
    if (!res.ok) {
      setMsg('Yetkisiz')
      return
    }
    const data = await res.json()
    setOauth(data.oauth || null)
    setAccountHealth(data.accountHealth || null)
    setAccounts(data.accounts || [])
    setPosts(data.posts || [])
  }, [adminKey])

  useEffect(() => {
    const saved = localStorage.getItem('cs_admin_key')
    if (saved) setAdminKey(saved)
    else setAdminKey(DEFAULT_ADMIN_API_KEY)

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

  async function repairAccounts() {
    setBusyId('repair')
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: headers(adminKey, true),
      body: JSON.stringify({ action: 'repair-accounts' }),
    })
    const data = await res.json()
    setBusyId(null)
    if (!res.ok) {
      setMsg(data.error || 'Onarım başarısız')
      return
    }
    const repaired = data.accountHealth?.repaired?.join(', ') || ''
    setMsg(
      repaired
        ? `Eksik hesaplar eklendi: ${repaired} · ${data.sync?.draftsCreated ?? 0} taslak`
        : 'Tüm hesaplar tamam — eksik yok',
    )
    await load()
  }

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
  const canDeletePost = (p: { status: string; isDryRun?: boolean; isMockPost?: boolean }) =>
    canMutate(p.status) || Boolean(p.isDryRun || p.isMockPost)

  const visiblePosts = hideDryRun ? posts.filter((p) => !p.isDryRun) : posts

  const captionGroups = useMemo(() => {
    const map = new Map<string, typeof visiblePosts>()
    for (const p of visiblePosts) {
      const key = String(p.derivedContentId || p.id)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return [...map.entries()]
  }, [visiblePosts])

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
        LinkedIn/X taslakları burada görünür — önce <Link href="/admin/review">Onay</Link>’da türevleri
        onayla, hesap bağla (OAuth veya dry-run), gerekirse “Taslakları senkronize et”. Rehber:{' '}
        <Link href="/docs/social-setup">SM kurulum</Link>
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
      {msg ? <p className="muted">{msg}</p> : null}

      {accountHealth ? (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <h2>Hesap durumu (X + LinkedIn)</h2>
          <ul className="list">
            {accountHealth.slots.map((slot) => (
              <li key={slot.platform}>
                <div className="row">
                  <span className={`badge plat-${slot.platform}`}>{slot.label}</span>
                  <span
                    className={
                      slot.status === 'oauth_ok' || slot.status === 'ok'
                        ? 'badge ok'
                        : slot.status === 'dry_run'
                          ? 'badge warn'
                          : 'badge danger'
                    }
                  >
                    {slot.status}
                  </span>
                  {slot.oauthConfigured ? <span className="badge ok">env OK</span> : <span className="badge warn">env yok</span>}
                </div>
                <p className="muted" style={{ margin: '0.35rem 0 0' }}>{slot.detail}</p>
              </li>
            ))}
          </ul>
          <div className="row" style={{ marginTop: '0.75rem' }}>
            <button type="button" className="ok" disabled={busyId === 'repair'} onClick={repairAccounts}>
              Eksik hesapları tamamla (dry-run)
            </button>
            {accountHealth.missingCount > 0 ? (
              <span className="badge danger">{accountHealth.missingCount} eksik</span>
            ) : (
              <span className="badge ok">hesaplar tamam</span>
            )}
            {accountHealth.brokenCount > 0 ? (
              <span className="badge warn">{accountHealth.brokenCount} sorunlu</span>
            ) : null}
          </div>
          <p className="muted" style={{ marginTop: '0.65rem', marginBottom: 0 }}>
            YouTube / Instagram / TikTok pipeline’da metin üretir; Faz 1 yayın yalnızca X ve LinkedIn.
            Gerçek yayın için OAuth bağla; test için dry-run yeterli.
          </p>
        </section>
      ) : null}

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
        <p className="muted" style={{ marginTop: 0, fontSize: '0.88rem' }}>
          Her onaylı caption için <strong>bağlı her hesaba ayrı satır</strong> oluşturulur (LinkedIn, X, dry-run).
          Aynı metin/görsel normal — farklı hesap hedefleri.
        </p>
        <label className="row" style={{ marginBottom: '0.75rem', fontSize: '0.88rem' }}>
          <input type="checkbox" checked={hideDryRun} onChange={(e) => setHideDryRun(e.target.checked)} />
          Dry-run / test satırlarını gizle
        </label>
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
          {captionGroups.map(([captionId, groupPosts]) => {
            const sample = groupPosts[0]
            const previewUrl = groupPosts.find((p) => p.imagePreviewUrl)?.imagePreviewUrl
            return (
              <li key={captionId} style={{ marginBottom: '1.25rem' }}>
                <div className="row" style={{ marginBottom: '0.5rem' }}>
                  <strong>Caption</strong>
                  <span className="badge">{groupPosts.length} hesap</span>
                  <span className="muted" style={{ fontSize: '0.78rem' }}>{captionId.slice(0, 8)}…</span>
                </div>
                {editingId && groupPosts.some((p) => p.id === editingId) ? (
                  groupPosts
                    .filter((p) => p.id === editingId)
                    .map((p) => (
                      <div key={p.id}>
                        <p className="muted" style={{ fontSize: '0.82rem' }}>
                          Düzenleniyor: <strong>{p.account?.accountName}</strong> ({p.platform})
                        </p>
                        <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} style={{ marginTop: '0.5rem' }} />
                        <div style={{ marginTop: '0.5rem' }}>
                          <label className="muted" style={{ display: 'block', marginBottom: '0.25rem' }}>
                            Görsel URL
                          </label>
                          <input type="url" value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} style={{ width: '100%' }} />
                        </div>
                        <div className="row" style={{ marginTop: '0.5rem' }}>
                          <button type="button" className="ok" disabled={busyId === p.id} onClick={() => saveEdit(p.id)}>
                            Kaydet
                          </button>
                          <button type="button" className="secondary" onClick={cancelEdit}>
                            İptal
                          </button>
                        </div>
                      </div>
                    ))
                ) : (
                  <>
                    <div className="pre" style={{ maxHeight: '120px', overflow: 'auto' }}>
                      {sample?.postContent}
                    </div>
                    {previewUrl ? (
                      <div style={{ marginTop: '0.5rem' }}>
                        <PostImagePreview src={previewUrl} alt="Caption görseli" />
                      </div>
                    ) : null}
                  </>
                )}
                <ul className="list" style={{ marginTop: '0.75rem', paddingLeft: '0.5rem' }}>
                  {groupPosts.map((p) => (
                    <li key={p.id} style={{ borderLeft: '3px solid var(--border)', paddingLeft: '0.75rem', marginTop: '0.5rem' }}>
                      <div className="row">
                        <strong>{p.account?.accountName || 'Hesap'}</strong>
                        <span className="badge">{p.platform}</span>
                        {p.isDryRun ? <span className="badge warn">dry-run</span> : null}
                        {!p.account?.isActive && !p.isDryRun ? <span className="badge">off</span> : null}
                        <span className={`badge ${p.status === 'PUBLISHED' ? 'ok' : p.status === 'FAILED' ? 'danger' : 'warn'}`}>
                          {p.status}
                        </span>
                        {p.imageAttached === true ? <span className="badge ok">görsel OK</span> : null}
                        {p.imageError ? <span className="badge danger">görsel hata</span> : null}
                      </div>
                      {p.imageError ? (
                        <p className="muted" style={{ margin: '0.25rem 0 0', color: 'var(--danger)', fontSize: '0.8rem' }}>
                          {String(p.imageError).slice(0, 180)}
                        </p>
                      ) : null}
                      {p.status === 'PUBLISHED' && p.platformPostId ? (
                        <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                          {socialPostPublicUrl(p.platform, p.platformPostId) ? (
                            <a href={socialPostPublicUrl(p.platform, p.platformPostId)!} target="_blank" rel="noreferrer">
                              LinkedIn&apos;de aç
                            </a>
                          ) : (
                            <>mock: {p.platformPostId}</>
                          )}
                        </p>
                      ) : null}
                      {!editingId || editingId !== p.id ? (
                        <div className="row" style={{ marginTop: '0.35rem' }}>
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
                          {p.status === 'PUBLISHED' &&
                          p.platform === 'LINKEDIN' &&
                          !p.isDryRun &&
                          !String(p.platformPostId || '').startsWith('mock_') ? (
                            <button type="button" className="secondary" disabled={busyId === p.id} onClick={() => updateOnPlatform(p.id)}>
                              Platformda güncelle
                            </button>
                          ) : null}
                          {canDeletePost(p) ? (
                            <button type="button" className="danger" disabled={busyId === p.id} onClick={() => removePost(p.id)}>
                              Sil
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
          {!visiblePosts.length ? (
            <li className="muted">Onaylı caption + bağlı hesap → taslak oluşur (veya senkronize et)</li>
          ) : null}
        </ul>
      </section>
    </div>
  )
}
