'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Item = {
  id: string
  title: string
  content: string
  contentType: string
  status: string
  approvedAt?: string | null
  source?: { id: string; title: string }
}

const CONTENT_TYPES = [
  'SOCIAL_CAPTION',
  'BLOG_POST',
  'VIDEO_SCRIPT',
  'PODCAST_SCRIPT',
  'MARCH_LYRICS',
  'SONG_LYRICS',
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

function sortItems(items: Item[]): Item[] {
  const rank: Record<string, number> = {
    IN_REVIEW: 0,
    APPROVED: 1,
    PUBLISHED: 1,
    REJECTED: 2,
    DRAFT: 3,
  }
  return [...items].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9))
}

export default function ReviewPage() {
  const [adminKey, setAdminKey] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [sources, setSources] = useState<{ id: string; title: string }[]>([])
  const [msg, setMsg] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newSourceId, setNewSourceId] = useState('')
  const [newType, setNewType] = useState<string>('SOCIAL_CAPTION')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')

  const counts = useMemo(() => {
    const pending = items.filter((i) => i.status === 'IN_REVIEW').length
    const approved = items.filter((i) => i.status === 'APPROVED' || i.status === 'PUBLISHED').length
    const rejected = items.filter((i) => i.status === 'REJECTED').length
    return { pending, approved, rejected }
  }, [items])

  const visibleItems = useMemo(() => {
    const filtered = showAll ? items : items.filter((i) => i.status === 'IN_REVIEW')
    return sortItems(filtered)
  }, [items, showAll])

  const load = useCallback(async () => {
    if (!adminKey.trim()) {
      setMsg('Admin API key gir — .env içindeki ADMIN_API_KEY ile aynı olmalı (varsayılan: dev-admin-change-me)')
      setItems([])
      return
    }
    const [cRes, sRes] = await Promise.all([
      fetch('/api/content', { headers: adminHeaders(adminKey), cache: 'no-store' }),
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
    if (!all.length) {
      setMsg('Kayıt yok — pipeline çalıştır veya elle türev ekle')
    } else if (showAll) {
      setMsg(`${pending} onay bekliyor · ${approved} onaylı · ${rejected} reddedildi`)
    } else if (pending) {
      setMsg(`${pending} onay bekliyor`)
    } else {
      setMsg('Onay bekleyen yok — geçmiş için "Tümünü göster"i aç')
    }
  }, [adminKey, showAll])

  useEffect(() => {
    const saved = localStorage.getItem('cs_admin_key')
    if (saved) setAdminKey(saved)
    else setAdminKey('dev-admin-change-me')
  }, [])

  useEffect(() => {
    if (adminKey) {
      localStorage.setItem('cs_admin_key', adminKey)
      load()
    }
  }, [adminKey, showAll, load])

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

  async function act(id: string, action: 'approve' | 'reject') {
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
      body: JSON.stringify({ id, action }),
    })
    setBusyId(null)
    if (!res.ok) {
      setMsg('İşlem başarısız — yenile ve tekrar dene')
      await load()
      return
    }
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
      <h1>Onay kuyruğu</h1>
      <p className="lead">Düzenle, onayla, reddet veya sil — yayın öncesi tam CRUD.</p>
      <div className="keybar">
        <div style={{ flex: 1 }}>
          <label>Admin API key</label>
          <input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} />
        </div>
        <button type="button" className="secondary" onClick={load}>
          Yenile
        </button>
        <button type="button" className="secondary" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'İptal' : '+ Elle ekle'}
        </button>
        <label className="row muted" style={{ marginBottom: 0 }} title="Kapalıyken sadece onay bekleyenler görünür">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Tümünü göster
        </label>
      </div>
      {msg ? <p className="muted">{msg}</p> : null}
      {!showAll && counts.approved + counts.rejected > 0 ? (
        <p className="muted" style={{ marginTop: '-0.5rem' }}>
          {counts.approved} onaylı, {counts.rejected} reddedildi — geçmiş için &quot;Tümünü göster&quot;
        </p>
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
        {visibleItems.map((item) => (
          <li key={item.id} className={panelClass(item.status)} style={{ marginBottom: '0.75rem' }}>
            <div className="row">
              {editingId === item.id ? (
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ flex: 1, marginBottom: 0 }}
                />
              ) : (
                <strong>{item.title}</strong>
              )}
              <span className="badge">{item.contentType}</span>
              <span className={statusBadgeClass(item.status)}>{statusLabel(item.status)}</span>
              <span className="muted">{item.source?.title}</span>
            </div>
            {editingId === item.id ? (
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} style={{ marginTop: '0.5rem' }} />
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
                      <button type="button" className="ok" disabled={busyId === item.id} onClick={() => act(item.id, 'approve')}>
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
                  {item.status !== 'PUBLISHED' ? (
                    <button type="button" className="danger" disabled={busyId === item.id} onClick={() => remove(item.id)}>
                      Sil
                    </button>
                  ) : null}
                </>
              )}
            </div>
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
