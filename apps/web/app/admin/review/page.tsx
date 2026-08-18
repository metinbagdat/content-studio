'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@/lib/adminKey'
import { PodcastTimeline } from '@/components/admin/PodcastTimeline'
import { CommentTopicBanner } from '@/components/admin/CommentTopicBanner'
import { AUDIENCE_SEGMENTS, SEGMENT_LABELS, isAudienceSegment, parseSegmentFromTags, type AudienceSegment } from '@/lib/audience/segments'

type Item = {
  id: string
  title: string
  content: string
  contentType: string
  status: string
  approvedAt?: string | null
  metadata?: Record<string, unknown> | null
  source?: { id: string; title: string; tags?: string[] }
}

type PlatformFilter = 'ALL' | 'LINKEDIN' | 'TWITTER' | 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK' | 'FACEBOOK'
type SegmentFilter = 'ALL' | AudienceSegment

const CONTENT_TYPES = [
  'SOCIAL_CAPTION',
  'TWITTER_THREAD',
  'LINKEDIN_CAROUSEL',
  'SHORT_VIDEO_SCRIPT',
  'BLOG_POST',
  'VIDEO_SCRIPT',
  'PODCAST_SCRIPT',
  'MARCH_LYRICS',
  'SONG_LYRICS',
  'INFOGRAPHIC_TEXT',
] as const

function adminHeaders(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

function statusLabel(status: string): string {
  switch (status) {
    case 'IN_REVIEW':
      return 'Onay bekliyor'
    case 'APPROVED':
      return 'Onaylandı'
    case 'REJECTED':
      return 'Reddedildi'
    case 'PUBLISHED':
      return 'Yayında'
    default:
      return status
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'IN_REVIEW':
      return 'badge warn'
    case 'APPROVED':
    case 'PUBLISHED':
      return 'badge ok'
    case 'REJECTED':
      return 'badge danger'
    default:
      return 'badge'
  }
}

function panelClass(status: string): string {
  if (status === 'APPROVED' || status === 'PUBLISHED') return 'panel approved'
  if (status === 'REJECTED') return 'panel rejected'
  return 'panel'
}

function formatWhen(iso?: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('tr-TR')
  } catch {
    return null
  }
}

function sortItems(items: Item[], prioritySourceId?: string, customOrder?: string[]): Item[] {
  const rank: Record<string, number> = {
    IN_REVIEW: 0,
    APPROVED: 1,
    PUBLISHED: 1,
    REJECTED: 2,
    DRAFT: 3,
  }
  const orderIndex = new Map((customOrder || []).map((id, idx) => [id, idx]))
  return [...items].sort((a, b) => {
    const statusDiff = (rank[a.status] ?? 9) - (rank[b.status] ?? 9)
    if (statusDiff !== 0) return statusDiff
    // Manual per-item reordering (drag-free: up/down/to-top buttons) wins over the
    // bulk "bring this source to front" dropdown.
    const aIdx = orderIndex.has(a.id) ? orderIndex.get(a.id)! : Infinity
    const bIdx = orderIndex.has(b.id) ? orderIndex.get(b.id)! : Infinity
    if (aIdx !== bIdx) return aIdx - bIdx
    if (prioritySourceId) {
      const aPriority = a.source?.id === prioritySourceId ? 0 : 1
      const bPriority = b.source?.id === prioritySourceId ? 0 : 1
      if (aPriority !== bPriority) return aPriority - bPriority
    }
    return 0
  })
}

function itemPlatform(item: Item): string | null {
  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  if (typeof meta.platform === 'string') return meta.platform
  if (item.contentType === 'LINKEDIN_CAROUSEL') return 'LINKEDIN'
  if (item.contentType === 'TWITTER_THREAD') return 'TWITTER'
  if (item.contentType === 'SHORT_VIDEO_SCRIPT' || item.contentType === 'VIDEO_SCRIPT') {
    return typeof meta.platform === 'string' ? meta.platform : null
  }
  return null
}

function itemSegment(item: Item): AudienceSegment | null {
  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  if (isAudienceSegment(meta.segment)) return meta.segment
  return parseSegmentFromTags(item.source?.tags)
}

function platformLabel(platform: string | null): string {
  switch (platform) {
    case 'TWITTER':
      return 'X'
    case 'YOUTUBE':
      return 'YouTube'
    case 'LINKEDIN':
      return 'LinkedIn'
    case 'INSTAGRAM':
      return 'Instagram'
    case 'TIKTOK':
      return 'TikTok'
    case 'FACEBOOK':
      return 'Facebook'
    case 'PINTEREST':
      return 'Pinterest'
    default:
      return platform || '—'
  }
}

export default function ReviewPage() {
  const [adminKey, setAdminKey] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [sources, setSources] = useState<{ id: string; title: string }[]>([])
  const [msg, setMsg] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('ALL')
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>('ALL')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newSourceId, setNewSourceId] = useState('')
  const [newType, setNewType] = useState<string>('SOCIAL_CAPTION')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [autoMedia, setAutoMedia] = useState(true)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [prioritySourceId, setPrioritySourceId] = useState('')
type AiImageState = { msg: string; urls: string[]; mediaIds?: string[] }
  const [aiImageState, setAiImageState] = useState<Record<string, AiImageState>>({})
  const [customOrder, setCustomOrder] = useState<string[]>([])
  const pendingItems = useMemo(() => items.filter((i) => i.status === 'IN_REVIEW'), [items])

  const counts = useMemo(() => {
    const pending = items.filter((i) => i.status === 'IN_REVIEW').length
    const approved = items.filter((i) => i.status === 'APPROVED' || i.status === 'PUBLISHED').length
    const rejected = items.filter((i) => i.status === 'REJECTED').length
    const linkedin = items.filter((i) => itemPlatform(i) === 'LINKEDIN').length
    return { pending, approved, rejected, linkedin }
  }, [items])

  const visibleItems = useMemo(() => {
    let filtered = showAll ? items : items.filter((i) => i.status === 'IN_REVIEW')
    if (platformFilter !== 'ALL') {
      filtered = filtered.filter((i) => itemPlatform(i) === platformFilter)
    }
    if (segmentFilter !== 'ALL') {
      filtered = filtered.filter((i) => itemSegment(i) === segmentFilter)
    }
    return sortItems(filtered, prioritySourceId, customOrder)
  }, [items, showAll, platformFilter, segmentFilter, prioritySourceId, customOrder])

  const visiblePendingIds = useMemo(
    () => visibleItems.filter((i) => i.status === 'IN_REVIEW').map((i) => i.id),
    [visibleItems],
  )

  const allVisibleSelected =
    visiblePendingIds.length > 0 && visiblePendingIds.every((id) => selectedIds.has(id))

  const load = useCallback(async () => {
    if (!adminKey.trim()) {
      setMsg(`Admin API key gir — .env içindeki ADMIN_API_KEY ile aynı olmalı (varsayılan: ${DEFAULT_ADMIN_API_KEY})`)
      setItems([])
      return
    }
    const q = new URLSearchParams({ take: '300' })
    if (platformFilter !== 'ALL') q.set('platform', platformFilter)
    if (segmentFilter !== 'ALL') q.set('segment', segmentFilter)
    const [cRes, sRes] = await Promise.all([
      fetch(`/api/content?${q}`, { headers: adminHeaders(adminKey), cache: 'no-store' }),
      fetch('/api/sources', { headers: adminHeaders(adminKey), cache: 'no-store' }),
    ])
    if (!cRes.ok) {
      const err = await cRes.json().catch(() => ({}))
      setMsg(`API hatası ${cRes.status}: ${err.error || 'Yetkisiz — key yanlış veya npm run dev yeniden başlat'}`)
      setItems([])
      return
    }
    const data = await cRes.json()
    const all: Item[] = data.items || []
    setItems(all)
    if (sRes.ok) {
      const sData = await sRes.json()
      setSources((sData.sources || []).map((s: { id: string; title: string }) => ({ id: s.id, title: s.title })))
    }
    const pending = all.filter((i) => i.status === 'IN_REVIEW').length
    const approved = all.filter((i) => i.status === 'APPROVED' || i.status === 'PUBLISHED').length
    const rejected = all.filter((i) => i.status === 'REJECTED').length
    const linkedin = all.filter((i) => itemPlatform(i) === 'LINKEDIN').length
    if (!all.length) {
      setMsg('Kayıt yok — Pipeline’da LinkedIn seçili çalıştır veya Discovery ile kaynak ekle')
    } else if (showAll) {
      setMsg(`${pending} onay bekliyor · ${approved} onaylı · ${rejected} reddedildi · ${linkedin} LinkedIn`)
    } else if (pending) {
      setMsg(`${pending} onay bekliyor · ${linkedin} LinkedIn türev (filtre: ${platformFilter})`)
    } else {
      setMsg('Onay bekleyen yok — "Tümünü göster" veya LinkedIn filtresi ile geçmişe bak')
    }
  }, [adminKey, showAll, platformFilter, segmentFilter])

  useEffect(() => {
    const saved = localStorage.getItem('cs_admin_key')
    if (saved) setAdminKey(saved)
    else setAdminKey(DEFAULT_ADMIN_API_KEY)

    const savedPriority = localStorage.getItem('cs_review_priority_source')
    if (savedPriority) setPrioritySourceId(savedPriority)

    const savedOrder = localStorage.getItem('cs_review_custom_order')
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder)
        if (Array.isArray(parsed)) setCustomOrder(parsed.map(String))
      } catch {
        /* ignore */
      }
    }
  }, [])

  function updatePrioritySource(id: string) {
    setPrioritySourceId(id)
    if (id) localStorage.setItem('cs_review_priority_source', id)
    else localStorage.removeItem('cs_review_priority_source')
  }

  function persistCustomOrder(order: string[]) {
    setCustomOrder(order)
    localStorage.setItem('cs_review_custom_order', JSON.stringify(order))
  }

  function moveToTop(id: string) {
    const current = visibleItems.map((i) => i.id)
    persistCustomOrder([id, ...current.filter((x) => x !== id)])
  }

  function moveBy(id: string, delta: -1 | 1) {
    const current = visibleItems.map((i) => i.id)
    const idx = current.indexOf(id)
    const target = idx + delta
    if (idx < 0 || target < 0 || target >= current.length) return
    const next = [...current]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    persistCustomOrder(next)
  }

  function resetCustomOrder() {
    setCustomOrder([])
    localStorage.removeItem('cs_review_custom_order')
  }

  useEffect(() => {
    if (adminKey) {
      localStorage.setItem('cs_admin_key', adminKey)
      load()
    }
  }, [adminKey, showAll, platformFilter, load])

  function startEdit(item: Item) {
    setEditingId(item.id)
    setEditTitle(item.title)
    setEditContent(item.content)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditTitle('')
    setEditContent('')
  }

  async function saveEdit(id: string) {
    setBusyId(id)
    const res = await fetch(`/api/content/${id}`, {
      method: 'PATCH',
      headers: adminHeaders(adminKey, true),
      body: JSON.stringify({ title: editTitle, content: editContent }),
    })
    setBusyId(null)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(data.error || 'Kaydetme başarısız')
      return
    }
    setMsg('Kaydedildi' + (data.item?.status === 'IN_REVIEW' ? ' — tekrar onay bekliyor' : ''))
    cancelEdit()
    await load()
  }

  async function act(id: string, action: 'approve' | 'reject', withAutoMedia = false) {
    const nextStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
    setBusyId(id)
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: nextStatus, approvedAt: action === 'approve' ? new Date().toISOString() : null } : i,
      ),
    )
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: adminHeaders(adminKey, true),
      body: JSON.stringify({
        id,
        action,
        ...(action === 'approve' && withAutoMedia ? { autoMedia: true } : {}),
      }),
    })
    setBusyId(null)
    if (!res.ok) {
      setMsg('İşlem başarısız — yenile ve tekrar dene')
      await load()
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    await load()
  }

  async function generateAiImage(id: string) {
    setBusyId(id)
    setAiImageState((prev) => ({ ...prev, [id]: { msg: 'Üretiliyor…', urls: prev[id]?.urls || [] } }))
    try {
      const res = await fetch('/api/media/generate', {
        method: 'POST',
        headers: adminHeaders(adminKey, true),
        body: JSON.stringify({ derivedContentId: id, kind: 'ai-image', count: 2 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAiImageState((prev) => ({ ...prev, [id]: { msg: data.error || 'Başarısız', urls: [] } }))
        return
      }
      const variations = (data.variations || []) as Array<{ publicUrl: string; mediaId: string }>
      const urls = variations.map((v) => v.publicUrl)
      setAiImageState((prev) => ({
        ...prev,
        [id]: { msg: `${urls.length} varyasyon · batch export için mediaId kullan`, urls, mediaIds: variations.map((v) => v.mediaId) },
      }))
    } catch {
      setAiImageState((prev) => ({ ...prev, [id]: { msg: 'Bağlantı hatası', urls: prev[id]?.urls || [] } }))
    } finally {
      setBusyId(null)
    }
  }

  async function generateSong(id: string, kind: 'song' | 'march') {
    setBusyId(id)
    setMsg(`${kind === 'march' ? 'Marş' : 'Şarkı'} sesi üretiliyor…`)
    try {
      const res = await fetch('/api/media/generate', {
        method: 'POST',
        headers: adminHeaders(adminKey, true),
        body: JSON.stringify({ derivedContentId: id, kind }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Başarısız')
      setMsg(
        data.reused
          ? 'Mevcut ses kullanıldı'
          : `Ses hazır${data.hasMusicBed ? ' (müzik yatağı ile)' : ' (sadece ses)'}`,
      )
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ses üretimi başarısız')
    } finally {
      setBusyId(null)
    }
  }

  async function sendToWordPress(id: string) {
    setBusyId(id)
    setMsg('WordPress draft gönderiliyor…')
    try {
      const res = await fetch('/api/wordpress', {
        method: 'POST',
        headers: adminHeaders(adminKey, true),
        body: JSON.stringify({ action: 'send-derived', derivedId: id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok && !data.skipped) {
        throw new Error(data.error || data.publish?.errorMessage || 'WP gönderimi başarısız')
      }
      if (data.skipped || !data.publish?.success) {
        setMsg(
          `WP atlandı: ${data.validation?.reason || data.publish?.errorMessage || 'bilinmeyen'}`,
        )
        return
      }
      const link = data.publish?.editLink as string | undefined
      setMsg(
        link
          ? `WP draft #${data.publish.wpPostId} — düzenle: ${link}`
          : `WP draft #${data.publish.wpPostId} kaydedildi`,
      )
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'WP gönderimi başarısız')
    } finally {
      setBusyId(null)
    }
  }

  async function batchResizeImage(masterMediaId: string, derivedId: string) {
    setBusyId(derivedId)
    setMsg('Platform boyutlarına export ediliyor…')
    try {
      const res = await fetch('/api/media/generate', {
        method: 'POST',
        headers: adminHeaders(adminKey, true),
        body: JSON.stringify({ kind: 'resize-batch', masterMediaId, format: 'jpeg', quality: 85 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Export başarısız')
      setMsg(`${(data.exports || []).length} platform boyutu oluşturuldu`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Export hatası')
    } finally {
      setBusyId(null)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        visiblePendingIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        visiblePendingIds.forEach((id) => next.add(id))
        return next
      })
    }
  }

  async function bulkAct(action: 'bulkApprove' | 'bulkReject') {
    const ids = Array.from(selectedIds).filter((id) => {
      const item = items.find((i) => i.id === id)
      return item?.status === 'IN_REVIEW'
    })
    if (!ids.length) {
      setMsg('Önce onay bekleyen öğeleri seç')
      return
    }
    if (action === 'bulkReject' && !confirm(`${ids.length} öğe reddedilsin mi?`)) return

    setBulkBusy(true)
    setMsg(`${ids.length} öğe işleniyor…`)
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: adminHeaders(adminKey, true),
      body: JSON.stringify({
        action,
        ids,
        autoMedia: action === 'bulkApprove' && autoMedia,
      }),
    })
    setBulkBusy(false)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(data.error || 'Toplu işlem başarısız')
      return
    }
    const r = data.result || {}
    setSelectedIds(new Set())
    setMsg(
      `Toplu: ${r.processed ?? ids.length} işlendi · ${r.approved ?? 0} onay · ${r.rejected ?? 0} red` +
        (r.draftsCreated ? ` · ${r.draftsCreated} taslak` : '') +
        (r.mediaGenerated ? ` · ${r.mediaGenerated} medya` : '') +
        (r.errors?.length ? ` · hata: ${r.errors.length}` : ''),
    )
    await load()
  }

  async function reopen(id: string) {
    setBusyId(id)
    const res = await fetch(`/api/content/${id}`, {
      method: 'PATCH',
      headers: adminHeaders(adminKey, true),
      body: JSON.stringify({ reopen: true }),
    })
    setBusyId(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg(data.error || 'Geri alma başarısız')
      return
    }
    setMsg('Tekrar incelemeye alındı')
    await load()
  }

  async function remove(id: string) {
    if (!confirm('Bu türev içeriği silinsin mi?')) return
    setBusyId(id)
    const res = await fetch(`/api/content/${id}`, { method: 'DELETE', headers: adminHeaders(adminKey) })
    setBusyId(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg(data.error || 'Silme başarısız')
      return
    }
    if (editingId === id) cancelEdit()
    setMsg('Silindi')
    await load()
  }

  async function createManual() {
    if (!newSourceId || !newTitle.trim() || !newContent.trim()) {
      setMsg('Kaynak, başlık ve içerik gerekli')
      return
    }
    setBusyId('create')
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: adminHeaders(adminKey, true),
      body: JSON.stringify({
        action: 'create',
        sourceId: newSourceId,
        contentType: newType,
        title: newTitle,
        content: newContent,
      }),
    })
    setBusyId(null)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(data.error || 'Oluşturma başarısız')
      return
    }
    setShowCreate(false)
    setNewTitle('')
    setNewContent('')
    setMsg('Yeni türev eklendi — onay kuyruğunda')
    await load()
  }

  return (
    <div>
      <section className="hero-panel">
        <h1>Onay kuyruğu</h1>
        <p className="lead" style={{ marginBottom: '0.65rem' }}>
          Otomatik üretilen LinkedIn / X / YouTube metinleri ve podcast scriptleri önce burada. Toplu onayla →
          <a href="/admin/social">Sosyal</a> taslakları; podcast MP3 için{' '}
          <a href="/admin/media">Medya</a> veya aşağıdaki otomatik ses üretimi.
        </p>
        <div className="row">
          <span className="badge warn">{counts.pending} bekliyor</span>
          <span className="badge plat-TWITTER">X</span>
          <span className="badge" style={{ borderColor: 'rgba(10,102,194,0.5)' }}>
            LinkedIn · {counts.linkedin}
          </span>
          <span className="badge plat-YOUTUBE">YouTube</span>
        </div>
      </section>

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
        <div>
          <label>Platform</label>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as PlatformFilter)}
            style={{ marginBottom: 0, minWidth: '9rem' }}
          >
            <option value="ALL">Tümü</option>
            <option value="LINKEDIN">LinkedIn</option>
            <option value="TWITTER">X</option>
            <option value="YOUTUBE">YouTube</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="TIKTOK">TikTok</option>
            <option value="FACEBOOK">Facebook</option>
          </select>
        </div>
        <div>
          <label>Segment</label>
          <select
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value as SegmentFilter)}
            style={{ marginBottom: 0, minWidth: '8rem' }}
          >
            <option value="ALL">Tümü</option>
            {AUDIENCE_SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {SEGMENT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Öne çıkar</label>
          <select
            value={prioritySourceId}
            onChange={(e) => updatePrioritySource(e.target.value)}
            style={{ marginBottom: 0, minWidth: '11rem' }}
          >
            <option value="">Yok (varsayılan sıra)</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="secondary" onClick={load}>
          Yenile
        </button>
        {customOrder.length ? (
          <button type="button" className="secondary" onClick={resetCustomOrder} title="Elle yapılan sıralamayı temizle">
            Sırayı sıfırla
          </button>
        ) : null}
        <button type="button" className="secondary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'İptal' : '+ Elle ekle'}
        </button>
        <label className="row muted" style={{ marginBottom: 0 }} title="Kapalıyken sadece onay bekleyenler görünür">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Tümünü göster
        </label>
      </div>
      {msg ? <p className="flash">{msg}</p> : null}
      {adminKey ? <CommentTopicBanner adminKey={adminKey} /> : null}
      {!showAll && counts.approved + counts.rejected > 0 ? (
        <p className="muted" style={{ marginTop: '-0.5rem' }}>
          {counts.approved} onaylı, {counts.rejected} reddedildi — geçmiş için &quot;Tümünü göster&quot;
        </p>
      ) : null}

      {counts.pending > 0 ? (
        <div className="bulk-bar">
          <label className="row muted" style={{ marginBottom: 0 }}>
            <input
              type="checkbox"
              className="review-check"
              checked={allVisibleSelected}
              onChange={toggleSelectAllVisible}
              disabled={bulkBusy || !visiblePendingIds.length}
            />
            Görünenleri seç ({visiblePendingIds.length})
          </label>
          <span className="muted">{selectedIds.size} seçili</span>
          <label className="row muted" style={{ marginBottom: 0 }} title="Podcast script → MP3, caption → görsel">
            <input
              type="checkbox"
              className="review-check"
              checked={autoMedia}
              onChange={(e) => setAutoMedia(e.target.checked)}
            />
            Onayda otomatik medya (podcast ses + görsel)
          </label>
          <button
            type="button"
            className="ok"
            disabled={bulkBusy || selectedIds.size === 0}
            onClick={() => bulkAct('bulkApprove')}
          >
            {bulkBusy ? 'İşleniyor…' : 'Toplu onayla'}
          </button>
          <button
            type="button"
            className="danger"
            disabled={bulkBusy || selectedIds.size === 0}
            onClick={() => bulkAct('bulkReject')}
          >
            Toplu reddet
          </button>
          <button
            type="button"
            className="secondary"
            disabled={bulkBusy}
            onClick={() => {
              setSelectedIds(new Set(pendingItems.map((i) => i.id)))
            }}
          >
            Tüm bekleyenleri seç
          </button>
        </div>
      ) : null}

      {showCreate ? (
        <section className="panel" style={{ marginBottom: '1rem' }}>
          <h2>Elle türev ekle</h2>
          <label>Kaynak</label>
          <select value={newSourceId} onChange={(e) => setNewSourceId(e.target.value)}>
            <option value="">Seç…</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <label>Tür</label>
          <select value={newType} onChange={(e) => setNewType(e.target.value)}>
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label>Başlık</label>
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <label>İçerik</label>
          <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} />
          <button type="button" disabled={busyId === 'create'} onClick={createManual}>
            Kuyruğa ekle
          </button>
        </section>
      ) : null}

      <ul className="list">
        {visibleItems.map((item, index) => (
          <li key={item.id} className={panelClass(item.status)} style={{ marginBottom: '0.75rem' }}>
            <div className="row">
              <span className="badge seq-badge" title="Listedeki sırası">#{index + 1}</span>
              {item.status === 'IN_REVIEW' ? (
                <>
                  <input
                    type="checkbox"
                    className="review-check"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    disabled={bulkBusy}
                    aria-label="Seç"
                  />
                  <span className="row reorder-controls">
                    <button
                      type="button"
                      className="secondary reorder-btn"
                      title="Yukarı taşı"
                      disabled={index === 0}
                      onClick={() => moveBy(item.id, -1)}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="secondary reorder-btn"
                      title="Aşağı taşı"
                      disabled={index === visibleItems.length - 1}
                      onClick={() => moveBy(item.id, 1)}
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      className="secondary reorder-btn"
                      title="En üste taşı"
                      disabled={index === 0}
                      onClick={() => moveToTop(item.id)}
                    >
                      ⤒
                    </button>
                  </span>
                </>
              ) : null}
              {editingId === item.id ? (
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ flex: 1, marginBottom: 0 }}
                />
              ) : (
                <strong>{item.title}</strong>
              )}
              <span className={`badge plat-${itemPlatform(item) || 'NONE'}`}>
                {platformLabel(itemPlatform(item))}
              </span>
              {itemSegment(item) ? (
                <span className="badge">{SEGMENT_LABELS[itemSegment(item)!]}</span>
              ) : null}
              <span className="badge">{item.contentType}</span>
              <span className={statusBadgeClass(item.status)}>{statusLabel(item.status)}</span>
              {prioritySourceId && item.source?.id === prioritySourceId ? (
                <span className="badge ok">↑ öncelikli</span>
              ) : null}
              <span className="muted">{item.source?.title}</span>
            </div>
            {editingId === item.id ? (
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} style={{ marginTop: '0.5rem' }} />
            ) : item.contentType === 'PODCAST_SCRIPT' ? (
              <PodcastTimeline
                content={item.content}
                episodeIndex={typeof item.metadata?.episodeIndex === 'number' ? item.metadata.episodeIndex : undefined}
                episodeTotal={typeof item.metadata?.episodeTotal === 'number' ? item.metadata.episodeTotal : undefined}
              />
            ) : (
              <div className="pre">{item.content}</div>
            )}
            <div className="row" style={{ marginTop: '0.5rem' }}>
              {editingId === item.id ? (
                <>
                  <button type="button" className="ok" disabled={busyId === item.id} onClick={() => saveEdit(item.id)}>
                    Kaydet
                  </button>
                  <button type="button" className="secondary" onClick={cancelEdit}>
                    İptal
                  </button>
                </>
              ) : (
                <>
                  {item.status !== 'PUBLISHED' ? (
                    <button type="button" className="secondary" disabled={busyId === item.id} onClick={() => startEdit(item)}>
                      Düzenle
                    </button>
                  ) : null}
                  {item.status === 'IN_REVIEW' ? (
                    <>
                      <button
                        type="button"
                        className="ok"
                        disabled={busyId === item.id || bulkBusy}
                        onClick={() => act(item.id, 'approve', autoMedia)}
                      >
                        Onayla
                      </button>
                      <button type="button" className="danger" disabled={busyId === item.id} onClick={() => act(item.id, 'reject')}>
                        Reddet
                      </button>
                    </>
                  ) : null}
                  {item.status === 'APPROVED' || item.status === 'REJECTED' ? (
                    <button type="button" className="secondary" disabled={busyId === item.id} onClick={() => reopen(item.id)}>
                      Tekrar incelemeye al
                    </button>
                  ) : null}
                  {item.status === 'APPROVED' &&
                  ['BLOG_POST', 'PODCAST_SCRIPT', 'VIDEO_SCRIPT', 'SHORT_VIDEO_SCRIPT', 'MARCH_LYRICS', 'SONG_LYRICS'].includes(
                    item.contentType,
                  ) ? (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busyId === item.id}
                      onClick={() => sendToWordPress(item.id)}
                      title="Safe samurAI + WP draft (blog.egitim.today)"
                    >
                      WP draft gönder
                    </button>
                  ) : null}
                  {item.contentType === 'PODCAST_SCRIPT' ? (
                    <a className="btn secondary" href={`/admin/media?derived=${item.id}`} style={{ textDecoration: 'none', padding: '0.55rem 0.9rem', borderRadius: 8 }}>
                      Ses üret
                    </a>
                  ) : null}
                  {item.contentType === 'SOCIAL_CAPTION' ? (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busyId === item.id}
                      onClick={() => generateAiImage(item.id)}
                    >
                      AI görsel üret
                    </button>
                  ) : null}
                  {item.contentType === 'MARCH_LYRICS' ? (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busyId === item.id}
                      onClick={() => generateSong(item.id, 'march')}
                    >
                      Marş sesi üret
                    </button>
                  ) : null}
                  {item.contentType === 'SONG_LYRICS' ? (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busyId === item.id}
                      onClick={() => generateSong(item.id, 'song')}
                    >
                      Şarkı sesi üret
                    </button>
                  ) : null}
                  {item.status !== 'PUBLISHED' ? (
                    <button type="button" className="danger" disabled={busyId === item.id} onClick={() => remove(item.id)}>
                      Sil
                    </button>
                  ) : null}
                </>
              )}
            </div>
            {aiImageState[item.id] ? (
              <div style={{ margin: '0.5rem 0 0' }}>
                <p className="muted" style={{ margin: '0 0 0.4rem' }}>{aiImageState[item.id].msg}</p>
                {aiImageState[item.id].urls.length ? (
                  <div className="row" style={{ gap: '0.5rem' }}>
                    {aiImageState[item.id].urls.map((url, i) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        <img
                          src={url}
                          alt={`AI görsel ${i + 1}`}
                          style={{
                            width: 120,
                            height: 120,
                            objectFit: 'cover',
                            borderRadius: 8,
                            border: '1px solid rgba(0,0,0,0.15)',
                          }}
                        />
                      </a>
                    ))}
                    {aiImageState[item.id].mediaIds?.[0] ? (
                      <button
                        type="button"
                        className="secondary"
                        disabled={busyId === item.id}
                        onClick={() => batchResizeImage(aiImageState[item.id].mediaIds![0], item.id)}
                      >
                        Tüm platform boyutları
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            {item.status !== 'IN_REVIEW' && editingId !== item.id ? (
              <p className="muted" style={{ margin: '0.35rem 0 0' }}>
                {item.status === 'APPROVED' || item.status === 'PUBLISHED'
                  ? `Onaylandı${formatWhen(item.approvedAt) ? ` · ${formatWhen(item.approvedAt)}` : ''}`
                  : item.status === 'REJECTED'
                    ? 'Reddedildi'
                    : null}
              </p>
            ) : null}
          </li>
        ))}
        {!visibleItems.length ? (
          <li className="muted">
            {showAll ? 'Kayıt yok' : 'Onay bekleyen yok — tümü onaylandıysa "Tümünü göster" ile geçmişe bak'}
          </li>
        ) : null}
      </ul>
    </div>
  )
}