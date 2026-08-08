'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { socialPostPublicUrl } from '@/lib/social/postUrl'
import { SocialPlatformDashboard } from '@/components/admin/SocialPlatformDashboard'
import { PublishedPostsPanel } from '@/components/admin/PublishedPostsPanel'
import { DraftDiagnosticsPanel, type DraftDiagnostics } from '@/components/admin/DraftDiagnosticsPanel'
import { TopPerformersPanel, type TopPerformingPost } from '@/components/admin/TopPerformersPanel'
import { PlatformIconLink } from '@/components/admin/PlatformIconLink'
import { DEFAULT_ADMIN_API_KEY } from '@/lib/adminKey'

type OAuthStatus = {
  twitter: { configured: boolean; callbackUrl: string; clientIdSet?: boolean; clientSecretSet?: boolean }
  linkedin: {
    configured: boolean
    callbackUrl: string
    organizationId: string | null
    orgPostEnabled?: boolean
    clientIdSet?: boolean
    clientSecretSet?: boolean
  }
  youtube?: {
    configured: boolean
    callbackUrl: string
    clientIdSet?: boolean
    clientSecretSet?: boolean
    scopes?: string
  }
}

type EnvCheck = {
  X_CLIENT_ID: boolean
  X_CLIENT_SECRET: boolean
  LINKEDIN_CLIENT_ID: boolean
  LINKEDIN_CLIENT_SECRET: boolean
  YOUTUBE_CLIENT_ID: boolean
  YOUTUBE_CLIENT_SECRET: boolean
  META_APP_ID: boolean
  META_APP_SECRET: boolean
  ready: boolean
}

type AccountStats = {
  username?: string | null
  displayName?: string | null
  profileUrl?: string | null
  followers?: number | null
  following?: number | null
  postsCount?: number | null
  impressions?: number | null
  engagement?: number | null
  likes?: number | null
  comments?: number | null
  shares?: number | null
  clicks?: number | null
  fetchedAt?: string | null
  error?: string
}

type Account = {
  id: string
  platform: string
  accountName: string
  username?: string | null
  isActive: boolean
  dryRun?: boolean
  oauth?: boolean
  tokenExpiry?: string | null
  stats?: AccountStats | null
  lastSyncAt?: string | null
  organizationId?: string | null
  linkedinAuthorUrn?: string | null
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
  const [envCheck, setEnvCheck] = useState<EnvCheck | null>(null)
  const [accountHealth, setAccountHealth] = useState<AccountHealth | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [statsSynced, setStatsSynced] = useState(false)
  const [imagesSynced, setImagesSynced] = useState(false)
  const [hideDryRun, setHideDryRun] = useState(true)
  const [postView, setPostView] = useState<'published' | 'drafts'>('published')
  const [msgType, setMsgType] = useState<'info' | 'ok' | 'error'>('info')
  const [diagnostics, setDiagnostics] = useState<DraftDiagnostics | null>(null)
  const [topPerformers, setTopPerformers] = useState<TopPerformingPost[]>([])
  const [bulkPublishBusy, setBulkPublishBusy] = useState(false)
  const statusRef = useRef<HTMLParagraphElement>(null)

  // Any action can run from deep inside a platform card — always bring the result into view.
  useEffect(() => {
    if (msg) statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [msg])

  const load = useCallback(async () => {
    if (!adminKey) return
    let res: Response
    try {
      res = await fetch('/api/social', { headers: headers(adminKey), cache: 'no-store' })
    } catch (err) {
      setMsgType('error')
      setMsg(
        `Sunucuya ulaşılamadı — dev sunucu yeniden başlıyor olabilir, birkaç saniye sonra "Yenile" deneyin. (${err instanceof Error ? err.message : String(err)})`,
      )
      return
    }
    if (!res.ok) {
      const errData = await parseApiJson(res)
      setMsgType('error')
      setMsg(res.status === 401 ? 'Yetkisiz — admin key kontrol et' : String(errData.error || `API hatası (${res.status})`))
      return
    }
    const data = await res.json()
    setOauth(data.oauth || null)
    setEnvCheck(data.envCheck || null)
    setAccountHealth(data.accountHealth || null)
    setDiagnostics(data.diagnostics || null)
    setTopPerformers(data.topPerformers || [])
    setAccounts(data.accounts || [])
    setPosts(data.posts || [])
  }, [adminKey])

  async function bulkPublish(includeDryRun: boolean) {
    setBulkPublishBusy(true)
    setMsgType('info')
    setMsg('Toplu yayınlama çalışıyor…')
    const res = await fetch('/api/social', {
      method: 'POST',
      headers: headers(adminKey, true),
      body: JSON.stringify({ action: 'bulk-publish', includeDryRun }),
    })
    const data = await parseApiJson(res)
    setBulkPublishBusy(false)
    if (!res.ok) {
      setMsgType('error')
      setMsg(String(data.error || 'Toplu yayın başarısız'))
      return
    }
    const r = data.result as { attempted: number; published: number; skipped: number; failed: number; errors: string[] } | undefined
    setMsgType(r?.failed ? 'error' : 'ok')
    setMsg(
      `Toplu yayın: ${r?.published ?? 0} yayınlandı · ${r?.skipped ?? 0} atlandı · ${r?.failed ?? 0} başarısız` +
        (r?.errors?.length ? ` — ${r.errors[0]}` : ''),
    )
    setDiagnostics((data.diagnostics as DraftDiagnostics) || null)
    await load()
  }

  useEffect(() => {
    const saved = localStorage.getItem('cs_admin_key')
    if (saved) setAdminKey(saved)
    else setAdminKey(DEFAULT_ADMIN_API_KEY)

    if (window.location.hash === '#published') setPostView('published')

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
    if (!adminKey || statsSynced) return
    ;(async () => {
      try {
        const res = await fetch('/api/social', {
          method: 'POST',
          headers: headers(adminKey, true),
          body: JSON.stringify({ action: 'sync-stats' }),
        })
        if (res.ok) {
          setStatsSynced(true)
          await load()
        }
      } catch (err) {
        console.warn('[auto sync-stats]', err)
      }
    })()
  }, [adminKey, statsSynced, load])

  useEffect(() => {
    if (!adminKey || imagesSynced) return
    ;(async () => {
      try {
        const res = await fetch('/api/social', {
          method: 'POST',
          headers: headers(adminKey, true),
          body: JSON.stringify({ action: 'sync-images' }),
        })
        if (res.ok) {
          setImagesSynced(true)
          await load()
        }
      } catch (err) {
        console.warn('[auto sync-images]', err)
      }
    })()
  }, [adminKey, imagesSynced, load])

  async function syncStats() {
    setBusyId('sync-stats')
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'sync-stats' }),
      })
      const data = await parseApiJson(res)
      if (!res.ok) {
        setMsgType('error')
        setMsg(String(data.error || 'İstatistik senkron başarısız'))
        return
      }
      const accSynced = (data.accounts as { synced?: number; errors?: string[] })?.synced ?? 0
      const postSynced = (data.posts as { synced?: number; errors?: string[] })?.synced ?? 0
      const accErrors = (data.accounts as { errors?: string[] })?.errors || []
      setMsgType(accErrors.length ? 'error' : 'ok')
      setMsg(
        `Hesap: ${accSynced} · post: ${postSynced}` +
          (accErrors.length ? ` · ${accErrors[0]}` : ''),
      )
      await load()
    } catch (err) {
      setMsgType('error')
      setMsg(`İstatistik hatası: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  async function repairAccounts() {
    setBusyId('repair')
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'repair-accounts' }),
      })
      const data = await parseApiJson(res)
      if (!res.ok) {
        setMsgType('error')
        setMsg(String(data.error || 'Onarım başarısız'))
        return
      }
      const repaired = (data.accountHealth as { repaired?: string[] })?.repaired?.join(', ') || ''
      setMsgType('ok')
      setMsg(
        repaired
          ? `Eksik hesaplar eklendi: ${repaired} · ${(data.sync as { draftsCreated?: number })?.draftsCreated ?? 0} taslak`
          : 'Tüm hesaplar tamam — eksik yok',
      )
      await load()
    } catch (err) {
      setMsgType('error')
      setMsg(`Onarım hatası: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  async function youtubeTest() {
    setBusyId('youtube-test')
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'youtube-test' }),
      })
      const data = await parseApiJson(res)
      if (!res.ok) {
        setMsgType('error')
        setMsg(String(data.error || 'YouTube test başarısız'))
        return
      }
      const r = data.result as { ok?: boolean; channel?: { title?: string; id?: string }; error?: string; quotaNote?: string }
      if (r?.ok) {
        setMsgType('ok')
        setMsg(`YouTube OK — kanal: ${r.channel?.title || '?'} (${r.channel?.id || ''})`)
      } else {
        setMsgType('error')
        setMsg(r?.error || 'YouTube test başarısız')
      }
      await load()
    } catch (err) {
      setMsgType('error')
      setMsg(`YouTube test: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  async function youtubeSync(publishNow = false) {
    setBusyId('youtube-sync')
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'youtube-sync', limit: 5, publishNow }),
      })
      const data = await parseApiJson(res)
      if (!res.ok) {
        setMsgType('error')
        setMsg(String(data.error || 'YouTube senkron başarısız'))
        return
      }
      const r = data.result as {
        scanned?: number
        videosGenerated?: number
        draftsCreated?: number
        scheduled?: number
        published?: number
        errors?: string[]
      }
      const errTail = r.errors?.length ? ` · Hatalar: ${r.errors.slice(0, 2).join('; ')}` : ''
      setMsgType(r.errors?.length ? 'error' : 'ok')
      setMsg(
        `YouTube: ${r.scanned ?? 0} script · ${r.videosGenerated ?? 0} video · ${r.draftsCreated ?? 0} taslak · ${r.scheduled ?? 0} planlandı · ${r.published ?? 0} yayınlandı${errTail}`,
      )
      await load()
    } catch (err) {
      setMsgType('error')
      setMsg(`YouTube senkron: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  async function oauthConnect(platform: 'TWITTER' | 'LINKEDIN' | 'YOUTUBE' | 'FACEBOOK' | 'INSTAGRAM') {
    setBusyId(platform)
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'connect-url', platform }),
      })
      const data = await parseApiJson(res)
      if (!res.ok || !data.url) {
        setMsgType('error')
        setMsg(String(data.error || 'OAuth URL alınamadı — .env client ID/secret kontrol et'))
        return
      }
      window.location.href = String(data.url)
    } catch (err) {
      setBusyId(null)
      setMsgType('error')
      setMsg(`OAuth başlatılamadı: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function syncImages() {
    setBusyId('sync-images')
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'sync-images' }),
      })
      const data = await parseApiJson(res)
      if (!res.ok) {
        setMsgType('error')
        setMsg(String(data.error || 'Görsel senkron başarısız'))
        return
      }
      setMsgType('ok')
      setMsg(`${String(data.postsUpdated ?? 0)} posta görsel bağlandı`)
      await load()
    } catch (err) {
      setMsgType('error')
      setMsg(`Bağlantı hatası: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  async function syncDrafts() {
    setBusyId('sync-drafts')
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'sync-drafts' }),
      })
      const data = await parseApiJson(res)
      if (!res.ok) {
        setMsgType('error')
        setMsg(String(data.error || 'Senkron başarısız'))
        return
      }
      setMsgType('ok')
      setMsg(`${String(data.draftsCreated ?? 0)} taslak oluşturuldu (${String(data.captions ?? 0)} onaylı caption)`)
      if (data.diagnostics) setDiagnostics(data.diagnostics as DraftDiagnostics)
      await load()
    } catch (err) {
      setMsgType('error')
      setMsg(`Senkron hatası: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  async function dryConnect(platform: string) {
    setBusyId(`dry-${platform}`)
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'dry-run-connect', platform }),
      })
      const data = await parseApiJson(res)
      if (!res.ok) {
        setMsgType('error')
        setMsg(String(data.error || 'fail'))
        return
      }
      setMsgType('ok')
      setMsg(`${platform} dry-run bağlı · ${(data.sync as { draftsCreated?: number })?.draftsCreated ?? 0} taslak`)
      if (data.diagnostics) setDiagnostics(data.diagnostics as DraftDiagnostics)
      await load()
    } catch (err) {
      setMsgType('error')
      setMsg(`Dry-run hatası: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  async function disconnect(accountId: string) {
    if (!confirm('Hesap bağlantısı kapatılsın mı?')) return
    setBusyId(accountId)
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'disconnect', accountId }),
      })
      if (!res.ok) {
        setMsgType('error')
        setMsg('Bağlantı kesilemedi')
        return
      }
      setMsgType('info')
      setMsg('Hesap devre dışı')
      await load()
    } catch (err) {
      setMsgType('error')
      setMsg(`Bağlantı hatası: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  async function publishNow(postId: string, replace = false) {
    setBusyId(postId)
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'publish-now', postId, replace, force: replace }),
      })
      const data = await parseApiJson(res)
      if (res.ok) {
        if (data.skipped) {
          setMsgType('info')
          setMsg(String(data.reason || 'Değişiklik yok — çift paylaşım engellendi'))
        } else if (data.imageError) {
          setMsgType('error')
          setMsg(`Yayınlandı ama görsel hatası: ${String(data.imageError)}`)
        } else if (data.replaced) {
          setMsgType('ok')
          setMsg(`Platformda güncellendi (eski silindi): ${String(data.platformPostId || 'ok')}`)
        } else {
          setMsgType('ok')
          setMsg(`✓ Yayınlandı — "Yayınlanan postlar" bölümünde görünecek: ${String(data.platformPostId || 'ok')}`)
        }
      } else {
        setMsgType('error')
        setMsg(`✗ Yayın başarısız: ${String(data.error || `HTTP ${res.status}`)}`)
      }
      await load()
    } catch (err) {
      setMsgType('error')
      setMsg(`✗ Bağlantı hatası: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  async function schedule(postId: string) {
    const when = new Date(Date.now() + 5 * 60_000).toISOString()
    setBusyId(postId)
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'schedule', postId, scheduledAt: when }),
      })
      setMsgType(res.ok ? 'ok' : 'error')
      setMsg(res.ok ? `Scheduled ${when}` : 'schedule fail')
      await load()
    } catch (err) {
      setMsgType('error')
      setMsg(`Bağlantı hatası: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
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
    try {
      const res = await fetch(`/api/social/posts/${postId}`, {
        method: 'PATCH',
        headers: headers(adminKey, true),
        body: JSON.stringify({ postContent: editContent, mediaUrls }),
      })
      const data = await parseApiJson(res)
      if (!res.ok) {
        setMsgType('error')
        setMsg(String(data.error || 'Kaydetme başarısız'))
        return
      }
      setMsgType('ok')
      setMsg('Post güncellendi (caption ile senkron)')
      cancelEdit()
      await load()
    } catch (err) {
      setMsgType('error')
      setMsg(`Bağlantı hatası: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  async function cancelSchedule(postId: string) {
    setBusyId(postId)
    try {
      const res = await fetch(`/api/social/posts/${postId}`, {
        method: 'PATCH',
        headers: headers(adminKey, true),
        body: JSON.stringify({ cancelSchedule: true }),
      })
      const data = await parseApiJson(res)
      if (!res.ok) {
        setMsgType('error')
        setMsg(String(data.error || 'İptal başarısız'))
        return
      }
      setMsgType('info')
      setMsg('Zamanlama iptal — taslak')
      await load()
    } catch (err) {
      setMsgType('error')
      setMsg(`Bağlantı hatası: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  async function removePost(postId: string) {
    if (!confirm('Post taslağı silinsin mi?')) return
    setBusyId(postId)
    try {
      const res = await fetch(`/api/social/posts/${postId}`, { method: 'DELETE', headers: headers(adminKey) })
      const data = await parseApiJson(res)
      if (!res.ok) {
        setMsgType('error')
        setMsg(String(data.error || 'Silme başarısız'))
        return
      }
      setMsgType('info')
      setMsg('Post silindi')
      await load()
    } catch (err) {
      setMsgType('error')
      setMsg(`Bağlantı hatası: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  const canMutate = (status: string) => ['DRAFT', 'SCHEDULED', 'FAILED'].includes(status)
  const canDeletePost = (p: { status: string; isDryRun?: boolean; isMockPost?: boolean }) =>
    canMutate(p.status) || Boolean(p.isDryRun || p.isMockPost)

  const publishedPosts = useMemo(() => {
    const list = posts.filter((p) => p.status === 'PUBLISHED')
    return list.sort((a, b) => {
      const ta = a.publishedAt || a.createdAt
      const tb = b.publishedAt || b.createdAt
      return new Date(tb).getTime() - new Date(ta).getTime()
    })
  }, [posts])

  const readyDraftsByPlatform = useMemo(() => {
    const map: Record<string, Array<{ id: string; preview: string; accountName: string; isDryRun: boolean }>> = {}
    for (const p of posts) {
      if (p.status !== 'DRAFT' && p.status !== 'FAILED') continue
      if (!map[p.platform]) map[p.platform] = []
      map[p.platform].push({
        id: p.id,
        preview: String(p.postContent || '').slice(0, 90),
        accountName: p.account?.accountName || 'Hesap',
        isDryRun: Boolean(p.isDryRun),
      })
    }
    return map
  }, [posts])

  const recentPublishedByPlatform = useMemo(() => {
    const map: Record<string, Array<{ id: string; preview: string; publishedAt: string; url: string | null }>> = {}
    for (const p of publishedPosts) {
      if (!map[p.platform]) map[p.platform] = []
      if (map[p.platform].length >= 3) continue
      map[p.platform].push({
        id: p.id,
        preview: String(p.postContent || '').slice(0, 90),
        publishedAt: p.publishedAt || p.createdAt,
        url: socialPostPublicUrl(p.platform, p.platformPostId),
      })
    }
    return map
  }, [publishedPosts])

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
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'update-on-platform', postId }),
      })
      const data = await parseApiJson(res)
      if (!res.ok) {
        setMsgType('error')
        setMsg(String(data.error || 'Güncelleme başarısız'))
        return
      }
      if (data.imageError) {
        setMsgType('error')
        setMsg(`Güncellendi ama görsel hatası: ${String(data.imageError)}`)
      } else {
        setMsgType('ok')
        setMsg(`Platformda güncellendi: ${String(data.platformPostId || 'ok')}`)
      }
      await load()
    } catch (err) {
      setMsgType('error')
      setMsg(`Bağlantı hatası: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  async function publishCaptionAll(derivedContentId: string) {
    setBusyId(derivedContentId)
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'publish-caption', derivedContentId }),
      })
      const data = await parseApiJson(res)
      if (!res.ok) {
        setMsgType('error')
        setMsg(String(data.error || 'Yayın başarısız'))
        return
      }
      setMsgType('ok')
      setMsg(
        `Görsel + ${String(data.published ?? 0)} yayın, ${String(data.skipped ?? 0)} atlandı (değişmedi)`,
      )
      await load()
    } catch (err) {
      setMsgType('error')
      setMsg(`Bağlantı hatası: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusyId(null)
    }
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
        <strong>Yayınlanan postlar</strong> ve metrikler aşağıda — üst kartlarda hesap istatistikleri.
        Önce <Link href="/admin/review">Onay</Link>, sonra yayınla. Rehber:{' '}
        <Link href="/docs/social-setup">SM kurulum</Link>
      </p>
      <div className="row btn-group-tabs sm-view-tabs" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={`btn${postView === 'published' ? ' is-active' : ' secondary'}`}
          onClick={() => {
            setPostView('published')
            window.location.hash = 'published'
          }}
        >
          Yayınlanan ({publishedPosts.length})
        </button>
        <button
          type="button"
          className={`btn${postView === 'drafts' ? ' is-active' : ' secondary'}`}
          onClick={() => setPostView('drafts')}
        >
          Taslaklar
        </button>
        <button type="button" className="btn secondary" disabled={busyId === 'sync-stats'} onClick={syncStats}>
          Metrikleri yenile
        </button>
        <button type="button" className="btn secondary" disabled={busyId === 'repair'} onClick={repairAccounts}>
          Faz 2 dry-run tamamla
        </button>
        <button type="button" className="btn secondary" disabled={busyId === 'sync-drafts'} onClick={syncDrafts}>
          Taslakları senkronize et
        </button>
      </div>
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
      {msg ? <p ref={statusRef} className={`sm-status-bar sm-status-${msgType}`}>{msg}</p> : null}

      <SocialPlatformDashboard
        accounts={accounts}
        oauth={oauth}
        envCheck={envCheck}
        busyId={busyId}
        readyDraftsByPlatform={readyDraftsByPlatform}
        recentPublishedByPlatform={recentPublishedByPlatform}
        onOAuthConnect={oauthConnect}
        onDryConnect={dryConnect}
        onDisconnect={disconnect}
        onSyncStats={syncStats}
        onRepair={repairAccounts}
        onPublishDraft={(id) => publishNow(id)}
        onYoutubeTest={youtubeTest}
        onYoutubeSync={() => youtubeSync(false)}
      />

      {accountHealth && accountHealth.brokenCount > 0 ? (
        <p className="flash" style={{ marginBottom: '1rem' }}>
          {accountHealth.brokenCount} hesap/post sorunu — token veya başarısız yayınları kontrol edin.
        </p>
      ) : null}

      <div className="row" style={{ marginBottom: '1rem' }}>
        <button type="button" className="secondary" onClick={syncDrafts}>
          Taslakları senkronize et
        </button>
        <button type="button" className="secondary" disabled={busyId === 'sync-images'} onClick={syncImages}>
          Görselleri senkronize et
        </button>
        <button type="button" className="secondary" disabled={busyId === 'youtube-sync'} onClick={() => youtubeSync(false)}>
          YouTube video senkronize
        </button>
        <button type="button" className="secondary" disabled={busyId === 'sync-stats'} onClick={syncStats}>
          İstatistikleri yenile
        </button>
      </div>

      <DraftDiagnosticsPanel diagnostics={diagnostics} onBulkPublish={bulkPublish} bulkBusy={bulkPublishBusy} />

      <section id="published" className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Yayınlanan postlar</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.88rem' }}>
          OAuth yayınlarında <strong>Paylaşımı yeni sekmede aç ↗</strong> gerçek postu gösterir. Metrikler için
          «Metrikleri yenile». Workflow panelinde de «Yayınlanan» listesi var.
        </p>
        <PublishedPostsPanel posts={publishedPosts} />
      </section>

      <section className="panel" style={{ marginBottom: '1rem' }}>
        <h2>En çok etkileşim alanlar</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.88rem' }}>
          Hangi formatın işe yaradığını görüp sonraki içerikte ona ağırlık verin.
        </p>
        <TopPerformersPanel posts={topPerformers} />
      </section>

      {postView === 'drafts' ? (
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
                        <PlatformIconLink platform={p.platform} username={p.account?.accountName} />
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
                              Paylaşımı aç
                            </a>
                          ) : (
                            <>mock: {p.platformPostId}</>
                          )}
                        </p>
                      ) : null}
                      {p.status === 'PUBLISHED' && p.analytics ? (
                        <div className="sm-post-stats row" style={{ marginTop: '0.35rem', fontSize: '0.78rem' }}>
                          {p.analytics.impressions != null ? (
                            <span className="badge">gösterim {p.analytics.impressions}</span>
                          ) : null}
                          {p.analytics.likes != null ? <span className="badge">beğeni {p.analytics.likes}</span> : null}
                          {p.analytics.comments != null ? (
                            <span className="badge">yorum {p.analytics.comments}</span>
                          ) : null}
                          {p.analytics.shares != null ? (
                            <span className="badge">paylaşım {p.analytics.shares}</span>
                          ) : null}
                          {p.analytics.clicks != null ? (
                            <span className="badge">tıklama {p.analytics.clicks}</span>
                          ) : null}
                        </div>
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
      ) : null}
    </div>
  )
}
