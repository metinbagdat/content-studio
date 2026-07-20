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

function headers(key: string): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-admin-key': key }
}

export default function ReviewPage() {
  const [adminKey, setAdminKey] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    if (!adminKey) return
    const res = await fetch('/api/content?status=IN_REVIEW', { headers: headers(adminKey) })
    if (!res.ok) {
      setMsg('Yetkisiz')
      return
    }
    const data = await res.json()
    setItems(data.items || [])
    setMsg('')
  }, [adminKey])

  useEffect(() => {
    const saved = localStorage.getItem('cs_admin_key')
    if (saved) setAdminKey(saved)
  }, [])

  useEffect(() => {
    if (adminKey) load()
  }, [adminKey, load])

  async function act(id: string, action: 'approve' | 'reject') {
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: headers(adminKey),
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
