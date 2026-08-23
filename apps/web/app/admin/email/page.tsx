'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@content-studio/core/adminKey'
import { HoverExpandList, HoverExpandRow } from '@/components/admin/HoverExpandList'

type ReachContact = {
  uuid?: string
  email: string
  name?: string
  surname?: string
  subscriptionStatus?: string
}

type ReachGroup = { uuid: string; title: string }

type ReachInfo = {
  configured: boolean
  profileScoped: boolean
  contacts: ReachContact[]
  groups: ReachGroup[]
  total: number | null
  error?: string | null
  contactsError?: string | null
  groupsError?: string | null
}

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export default function EmailReachPage() {
  const [adminKey, setAdminKey] = useState('')
  const [info, setInfo] = useState<ReachInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [note, setNote] = useState('content-studio admin')

  const load = useCallback(async () => {
    if (!adminKey) return
    const res = await fetch('/api/email/reach', { headers: headers(adminKey), cache: 'no-store' })
    if (!res.ok) {
      setMsg(`API hatası ${res.status} — ADMIN_API_KEY kontrol et`)
      setInfo(null)
      return
    }
    setInfo(await res.json())
    setMsg('')
  }, [adminKey])

  useEffect(() => {
    const saved = localStorage.getItem('cs_admin_key')
    setAdminKey(saved || DEFAULT_ADMIN_API_KEY)
  }, [])

  useEffect(() => {
    if (adminKey) load()
  }, [adminKey, load])

  async function addContact() {
    setBusy(true)
    setMsg('Kişi ekleniyor…')
    try {
      const res = await fetch('/api/email/reach', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'create-contact', email, name, surname, note }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setMsg('Reach’e eklendi (çift opt-in açıksa onay maili gider).')
      setEmail('')
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Kişi eklenemedi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1>E-posta (Hostinger Reach)</h1>
      <p className="lead">
        Blog / içerik listesi Reach’te durur. Kampanya yazımı ve gönderim Reach paneline aittir — API kampanya
        göndermez. LearnCon ders/ödeme mailleri buraya girmez.
      </p>

      <div className="keybar">
        <div style={{ flex: 1 }}>
          <label>Admin API key</label>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder={DEFAULT_ADMIN_API_KEY}
          />
        </div>
        <button type="button" className="secondary" onClick={load} disabled={busy}>
          Yenile
        </button>
      </div>
      {msg ? <p className="muted">{msg}</p> : null}

      <div className="grid two">
        <section className="panel">
          <h2>Durum</h2>
          <p className="muted">
            API: {info?.configured ? 'token var' : 'HOSTINGER_API_TOKEN yok'}
            {info?.profileScoped ? ' · profil UUID bağlı' : ''}
          </p>
          {info?.error || info?.contactsError ? (
            <p style={{ color: '#b91c1c', fontWeight: 600 }}>
              Reach API hata: {info.error || info.contactsError}
              {String(info.error || info.contactsError || '')
                .toLowerCase()
                .includes('unauth')
                ? ' — Token geçersiz. hPanel → API’den Bearer token üret.'
                : ''}
            </p>
          ) : null}
          {info?.groupsError ? (
            <p className="muted">
              Gruplar alınamadı ({info.groupsError}) — kişi listesi etkilenmez; Reach paneli grupları kullanır.
            </p>
          ) : null}
          <p className="muted">Kişi sayısı: {info?.total ?? info?.contacts?.length ?? '—'}</p>
          <p className="muted">
            Token: <strong>hPanel → API</strong> (Account Bearer). Vercel / <code>.env</code> →{' '}
            <code>HOSTINGER_API_TOKEN</code>
            {', '}
            isteğe bağlı <code>HOSTINGER_REACH_PROFILE_UUID</code>.
          </p>
          <p>
            <a href="https://hpanel.hostinger.com" target="_blank" rel="noreferrer">
              hPanel / Reach
            </a>
            {' · '}
            <a href="https://developers.hostinger.com" target="_blank" rel="noreferrer">
              API docs
            </a>
          </p>
        </section>

        <section className="panel">
          <h2>Kişi ekle</h2>
          <label>E-posta</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="veli@example.com" />
          <label>Ad</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <label>Soyad</label>
          <input value={surname} onChange={(e) => setSurname(e.target.value)} />
          <label>Not</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="button" disabled={busy || !adminKey || !info?.configured} onClick={addContact} style={{ marginTop: '1rem' }}>
            Reach’e ekle
          </button>
        </section>
      </div>

      <section className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Gruplar</h2>
        <HoverExpandList>
          {(info?.groups || []).map((g) => (
            <HoverExpandRow
              key={g.uuid}
              summary={
                <>
                  <strong className="hover-row-title">{g.title}</strong>
                  <span className="muted hover-row-chip">{g.uuid}</span>
                </>
              }
            />
          ))}
          {!info?.groups?.length ? (
            <li className="muted hover-row" style={{ border: 'none', boxShadow: 'none' }}>Grup yok veya API grupları döndürmedi</li>
          ) : null}
        </HoverExpandList>
      </section>

      <section className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Kişiler</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>E-posta</th>
              <th style={{ textAlign: 'left' }}>Ad</th>
              <th style={{ textAlign: 'left' }}>Durum</th>
            </tr>
          </thead>
          <tbody>
            {(info?.contacts || []).map((c) => (
              <tr key={c.uuid || c.email} style={{ borderTop: '1px solid #333' }}>
                <td>{c.email}</td>
                <td>
                  {[c.name, c.surname].filter(Boolean).join(' ') || '—'}
                </td>
                <td>{c.subscriptionStatus || '—'}</td>
              </tr>
            ))}
            {!info?.contacts?.length ? (
              <tr>
                <td colSpan={3} className="muted">
                  Liste boş
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  )
}
