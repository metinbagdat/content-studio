'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@content-studio/core/adminKey'

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

type Pack = {
  brand?: { institutionName: string; campusLabel: string }
  meetingMeta?: { title: string; studentCount: number }
  institutionSummary?: { headline: string; avgNet: number }
  studentPages?: Array<{ displayName: string; net: number }>
}

export default function InstitutionParentMeetingPage() {
  const [adminKey, setAdminKey] = useState('')
  const [pack, setPack] = useState<Pack | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setAdminKey(localStorage.getItem('cs_admin_key') || DEFAULT_ADMIN_API_KEY)
  }, [])

  const load = useCallback(async (key: string) => {
    const res = await fetch('/api/institution-parent-meeting', { headers: headers(key) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || res.statusText)
    setPack(data.item?.pack || null)
  }, [])

  useEffect(() => {
    if (!adminKey) return
    void load(adminKey).catch((e) => setMsg(String(e.message || e)))
  }, [adminKey, load])

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Veli toplantısı — kurumsal şablon</h1>
        <p className="text-sm text-neutral-600">
          CS-INST-04 — logo/çerçeve · kurum özeti · öğrenci başına sayfa · öğretmen W2 ile çakışmaz.
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
          className="rounded bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50"
          onClick={() =>
            void (async () => {
              setBusy(true)
              try {
                const res = await fetch('/api/institution-parent-meeting', {
                  method: 'POST',
                  headers: headers(adminKey, true),
                  body: JSON.stringify({ action: 'seed' }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || res.statusText)
                setPack(data.item?.pack || null)
                setMsg(data.upserted ? 'Paket güncellendi' : 'Paket yüklendi')
              } catch (e) {
                setMsg(e instanceof Error ? e.message : String(e))
              } finally {
                setBusy(false)
              }
            })()
          }
        >
          Seed yükle
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded border border-neutral-400 px-3 py-2 text-sm disabled:opacity-50"
          onClick={() =>
            void (async () => {
              const res = await fetch('/api/institution-parent-meeting?format=html', {
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
          PDF HTML
        </button>
      </div>

      {msg ? <p className="text-sm">{msg}</p> : null}

      {pack ? (
        <section className="space-y-2 rounded border border-neutral-200 p-4 text-sm">
          <div className="font-semibold">
            {pack.brand?.institutionName} · {pack.brand?.campusLabel}
          </div>
          <p className="text-neutral-700">{pack.institutionSummary?.headline}</p>
          <p className="text-neutral-600">
            {pack.meetingMeta?.studentCount ?? 0} öğrenci sayfası · ort. net{' '}
            {pack.institutionSummary?.avgNet}
          </p>
          <ul className="list-disc pl-5 text-neutral-700">
            {pack.studentPages?.slice(0, 5).map((s) => (
              <li key={s.displayName}>
                {s.displayName} — {s.net} net
              </li>
            ))}
            {(pack.studentPages?.length ?? 0) > 5 ? (
              <li>… +{(pack.studentPages?.length ?? 0) - 5} öğrenci</li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
