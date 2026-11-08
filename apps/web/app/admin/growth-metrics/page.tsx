'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@content-studio/core/adminKey'

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export default function GrowthMetricsPage() {
  const [adminKey, setAdminKey] = useState('')
  const [pack, setPack] = useState<{
    titleTr?: string
    metrics?: Array<{ key: string; nameTr: string; nameEn: string }>
    roleActivations?: unknown[]
    loops?: Array<{ key: string; labelTr: string; targetK: number }>
  } | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setAdminKey(localStorage.getItem('cs_admin_key') || DEFAULT_ADMIN_API_KEY)
  }, [])

  const load = useCallback(async (key: string) => {
    const res = await fetch('/api/growth-metrics', { headers: headers(key) })
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
        <h1 className="text-2xl font-semibold tracking-tight">Growth OS metrik sözlüğü</h1>
        <p className="text-sm text-neutral-600">
          CS-OS-01 — WLAS, Family WAU, Active Class, K-factor · 4 rol · 4 döngü · TR+EN. Ürün UI
          LearnCon `/admin/growth`.
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
                const res = await fetch('/api/growth-metrics', {
                  method: 'POST',
                  headers: headers(adminKey, true),
                  body: JSON.stringify({ action: 'seed' }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || res.statusText)
                setPack(data.item?.pack || null)
                setMsg(data.upserted ? 'Sözlük güncellendi' : 'Sözlük yüklendi')
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
              const res = await fetch('/api/growth-metrics?format=html', {
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
          Sözlük HTML
        </button>
      </div>

      {msg ? <p className="text-sm">{msg}</p> : null}

      {pack ? (
        <section className="space-y-3 rounded border border-neutral-200 p-4 text-sm">
          <div className="font-semibold">{pack.titleTr}</div>
          <ul className="list-disc pl-5 text-neutral-700">
            {pack.metrics?.map((m) => (
              <li key={m.key}>
                <code className="text-xs">{m.key}</code> — {m.nameTr} / {m.nameEn}
              </li>
            ))}
          </ul>
          <p className="text-neutral-600">
            Aktivasyon: {pack.roleActivations?.length ?? 0} rol · Döngü:{' '}
            {pack.loops?.map((l) => `${l.labelTr}(K≥${l.targetK})`).join(' · ')}
          </p>
        </section>
      ) : null}
    </div>
  )
}
