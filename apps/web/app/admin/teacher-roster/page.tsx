'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@content-studio/core/adminKey'

type PackView = {
  segment?: string
  sampleMeta?: { classLabel: string; exam: string; studentCount: number }
  columnsByExam?: Record<string, Array<{ header: string; required: boolean }>>
}

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

async function downloadWithKey(url: string, key: string, filename: string) {
  const res = await fetch(url, { headers: headers(key) })
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

export default function TeacherRosterPage() {
  const [adminKey, setAdminKey] = useState('')
  const [pack, setPack] = useState<PackView | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setAdminKey(localStorage.getItem('cs_admin_key') || DEFAULT_ADMIN_API_KEY)
  }, [])

  const load = useCallback(async (key: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/teacher-roster', { headers: headers(key) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setPack(data.item?.pack || null)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!adminKey) return
    void load(adminKey)
  }, [adminKey, load])

  async function seed() {
    setBusy(true)
    try {
      const res = await fetch('/api/teacher-roster', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'seed' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setPack(data.item?.pack || null)
      setMsg(data.upserted ? 'Şablon güncellendi' : 'Şablon yüklendi')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Öğretmen Excel şablonu</h1>
        <p className="text-sm text-neutral-600">
          CS-TCH-01 — TYT/AYT/LGS CSV + örnek doldurulmuş dosya + Noto Sans rehber PDF HTML.
        </p>
      </header>

      <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
        Admin API key
        <input
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 font-mono text-sm"
          type="password"
          value={adminKey}
          onChange={(e) => {
            setAdminKey(e.target.value)
            localStorage.setItem('cs_admin_key', e.target.value)
          }}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void load(adminKey)}
          className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Yenile
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void seed()}
          className="rounded bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Seed yükle
        </button>
        {(['TYT', 'AYT', 'LGS'] as const).map((exam) => (
          <button
            key={exam}
            type="button"
            disabled={busy}
            className="rounded border border-neutral-400 px-3 py-2 text-sm disabled:opacity-50"
            onClick={() =>
              void downloadWithKey(
                `/api/teacher-roster?format=csv&kind=sample&exam=${exam}`,
                adminKey,
                `roster-${exam}-sample.csv`,
              )
            }
          >
            {exam} örnek CSV
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          className="rounded border border-neutral-400 px-3 py-2 text-sm disabled:opacity-50"
          onClick={() =>
            void (async () => {
              const res = await fetch('/api/teacher-roster?format=guide', {
                headers: headers(adminKey),
              })
              const html = await res.text()
              window.open(
                URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })),
                '_blank',
              )
            })()
          }
        >
          Rehber PDF HTML
        </button>
      </div>

      {msg ? <p className="text-sm text-neutral-800">{msg}</p> : null}

      {pack ? (
        <section className="space-y-3 rounded border border-neutral-200 p-4 text-sm">
          <div>
            Segment: <strong>{pack.segment}</strong> · {pack.sampleMeta?.classLabel} ·{' '}
            {pack.sampleMeta?.studentCount} örnek öğrenci
          </div>
          {(['TYT', 'AYT', 'LGS'] as const).map((exam) => (
            <div key={exam}>
              <h2 className="font-semibold">{exam} sütunları</h2>
              <p className="text-neutral-600">
                {(pack.columnsByExam?.[exam] || []).map((c) => c.header).join(' · ')}
              </p>
            </div>
          ))}
        </section>
      ) : (
        <p className="text-sm text-neutral-500">Seed yükleyin.</p>
      )}
    </div>
  )
}
