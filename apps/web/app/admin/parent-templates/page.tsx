'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@content-studio/core/adminKey'

type PackView = {
  segment?: string
  toneGuide?: { voice: string; focus: string }
  v1?: {
    igCarousel: Array<{ index: number; headline: string }>
    youtube: { title: string; durationMinutes: { min: number; max: number } }
    facebookAd: { headline: string; audienceHint: string }
  }
  emails?: Array<{ id: string; trigger: string; subject: string }>
}

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export default function ParentTemplatesPage() {
  const [adminKey, setAdminKey] = useState('')
  const [pack, setPack] = useState<PackView | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [exportJson, setExportJson] = useState('')

  useEffect(() => {
    setAdminKey(localStorage.getItem('cs_admin_key') || DEFAULT_ADMIN_API_KEY)
  }, [])

  const load = useCallback(async (key: string) => {
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/parent-templates', { headers: headers(key) })
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
      const res = await fetch('/api/parent-templates', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'seed' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setPack(data.item?.pack || null)
      setMsg(data.upserted ? 'Şablonlar güncellendi' : 'Şablonlar yüklendi')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function exportLearnCon() {
    setBusy(true)
    try {
      const res = await fetch('/api/parent-templates?format=learncon', {
        headers: headers(adminKey),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setExportJson(JSON.stringify(data, null, 2))
      setMsg('LEARNCON-PAR-V1-VE export hazır')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function previewEmail(id: string) {
    const res = await fetch(`/api/parent-templates?format=email&id=${encodeURIComponent(id)}`, {
      headers: headers(adminKey),
    })
    const html = await res.text()
    if (!res.ok) {
      setMsg(html)
      return
    }
    window.open(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), '_blank')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Veli şablonları</h1>
        <p className="text-sm text-neutral-600">
          CS-PAR-02 — V1 (IG / YouTube / FB) + V-E1…E8. Segment <code>veli</code>, ton resmi + sonuç
          odaklı.
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
          V1 + V-E seed yükle
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void exportLearnCon()}
          className="rounded border border-neutral-400 px-3 py-2 text-sm disabled:opacity-50"
        >
          LearnCon JSON export
        </button>
      </div>

      {msg ? <p className="text-sm text-neutral-800">{msg}</p> : null}

      {pack ? (
        <section className="space-y-4 rounded border border-neutral-200 p-4 text-sm">
          <div>
            Segment: <strong>{pack.segment}</strong> · Ton: {pack.toneGuide?.voice} /{' '}
            {pack.toneGuide?.focus}
          </div>
          <div>
            <h2 className="font-semibold">V1a IG carousel ({pack.v1?.igCarousel.length ?? 0})</h2>
            <ol className="mt-1 list-decimal pl-5 text-neutral-700">
              {pack.v1?.igCarousel.map((s) => (
                <li key={s.index}>{s.headline}</li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="font-semibold">V1b YouTube</h2>
            <p className="text-neutral-700">
              {pack.v1?.youtube.title} ({pack.v1?.youtube.durationMinutes.min}–
              {pack.v1?.youtube.durationMinutes.max} dk)
            </p>
          </div>
          <div>
            <h2 className="font-semibold">V1c Facebook</h2>
            <p className="text-neutral-700">
              {pack.v1?.facebookAd.headline} · {pack.v1?.facebookAd.audienceHint}
            </p>
          </div>
          <div>
            <h2 className="font-semibold">V-E1…E8</h2>
            <ul className="mt-1 space-y-1">
              {pack.emails?.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{e.id}</span>
                  <span className="text-neutral-500">{e.trigger}</span>
                  <span>{e.subject}</span>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => void previewEmail(e.id)}
                  >
                    HTML
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <p className="text-sm text-neutral-500">Seed yükleyin.</p>
      )}

      {exportJson ? (
        <pre className="max-h-80 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-3 text-xs">
          {exportJson}
        </pre>
      ) : null}
    </div>
  )
}
