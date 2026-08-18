'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@/lib/adminKey'

type EnvCheck = {
  X_CLIENT_ID: boolean
  X_CLIENT_SECRET: boolean
  LINKEDIN_CLIENT_ID: boolean
  LINKEDIN_CLIENT_SECRET: boolean
  ready: boolean
}

function Row({ label, ok }: { label: string; ok: boolean | null }) {
  return (
    <div className="row" style={{ marginBottom: '0.3rem' }}>
      <code style={{ fontSize: '0.82rem' }}>{label}</code>
      {ok === null ? (
        <span className="badge">kontrol ediliyor…</span>
      ) : ok ? (
        <span className="badge ok">tanımlı</span>
      ) : (
        <span className="badge danger">eksik</span>
      )}
    </div>
  )
}

/** Live check against the running server's actual .env — the code block above this is just an example, not your data. */
export function EnvStatusCheck() {
  const [envCheck, setEnvCheck] = useState<EnvCheck | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const adminKey = localStorage.getItem('cs_admin_key') || DEFAULT_ADMIN_API_KEY
    fetch('/api/social', { headers: { 'x-admin-key': adminKey }, cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`API ${res.status}`)
        return res.json()
      })
      .then((data) => setEnvCheck(data.envCheck || null))
      .catch(() => setError('Kontrol edilemedi — admin key veya sunucu hatası'))
  }, [])

  return (
    <section className="panel" style={{ marginTop: '1rem' }}>
      <h2>Gerçek .env durumu (canlı)</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: '0.88rem' }}>
        Yukarıdaki kod bloğu sadece <strong>örnek</strong> — <code>&quot;...&quot;</code> gerçek bir boşluk değil,
        doldurmanız gereken şablon. Sunucunuzda gerçekte ne tanımlı, aşağıda görünür (değerler asla gösterilmez).
      </p>
      {error ? (
        <p className="muted" style={{ color: 'var(--danger)' }}>{error}</p>
      ) : (
        <>
          <Row label="X_CLIENT_ID" ok={envCheck ? envCheck.X_CLIENT_ID : null} />
          <Row label="X_CLIENT_SECRET" ok={envCheck ? envCheck.X_CLIENT_SECRET : null} />
          <Row label="LINKEDIN_CLIENT_ID" ok={envCheck ? envCheck.LINKEDIN_CLIENT_ID : null} />
          <Row label="LINKEDIN_CLIENT_SECRET" ok={envCheck ? envCheck.LINKEDIN_CLIENT_SECRET : null} />
          {envCheck ? (
            <p className="row" style={{ marginTop: '0.6rem' }}>
              {envCheck.ready ? (
                <span className="badge ok">Tüm anahtarlar tanımlı — OAuth bağlanabilir</span>
              ) : (
                <span className="badge warn">Bazı anahtarlar eksik — .env&apos;i kontrol edin ve npm run dev&apos;i yeniden başlatın</span>
              )}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
