'use client'

import { useCallback, useEffect, useState } from 'react'

type Item = {
  id: string
  title: string
  content: string
  contentType: string
  status: string
  source?: { title: string }
}

function adminHeaders(key: string): HeadersInit {
  return { 'x-admin-key': key }
}

export default function ReviewPage() {
  const [adminKey, setAdminKey] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [msg, setMsg] = useState('')
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    if (!adminKey.trim()) {
      setMsg('Admin API key gir — .env içindeki ADMIN_API_KEY ile aynı olmalı (varsayılan: dev-admin-change-me)')
      setItems([])
      return
    }
    const q = showAll ? '' : '?status=IN_REVIEW'
    const res = await fetch(`/api/content${q}`, { headers: adminHeaders(adminKey), cache: 'no-store' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setMsg(`API hatası ${res.status}: ${err.error || 'Yetkisiz — key yanlış veya npm run dev yeniden başlat'}`)
      setItems([])
      return
    }
    const data = await res.json()
    setItems(data.items || [])
    setMsg(data.items?.length ? `${data.items.length} kayıt` : 'IN_REVIEW kayıt yok (Tümünü göster dene veya pipeline tekrar çalıştır)')
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

  async function act(id: string, action: 'approve' | 'reject') {
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ id, action }),
    })
    if (!res.ok) {
      setMsg('İşlem başarısız')
      return
    }
    await load()
  }

  return (
    <div>
      <h1>Onay kuyruğu</h1>
      <p className="lead">IN_REVIEW türev içerikler — onay olmadan yayın yok.</p>
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
        <label className="row muted" style={{ marginBottom: 0 }}>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Tümünü göster
        </label>
      </div>
      {msg ? <p className="muted">{msg}</p> : null}

      <ul className="list">
        {items.map((item) => (
          <li key={item.id} className="panel" style={{ marginBottom: '0.75rem' }}>
            <div className="row">
              <strong>{item.title}</strong>
              <span className="badge warn">{item.contentType}</span>
              <span className="muted">{item.source?.title}</span>
            </div>
            <div className="pre">{item.content}</div>
            <div className="row" style={{ marginTop: '0.5rem' }}>
              <button type="button" className="ok" onClick={() => act(item.id, 'approve')}>
                Onayla
              </button>
              <button type="button" className="danger" onClick={() => act(item.id, 'reject')}>
                Reddet
              </button>
            </div>
          </li>
        ))}
        {!items.length ? <li className="muted">Onay bekleyen yok</li> : null}
      </ul>
    </div>
  )
}
