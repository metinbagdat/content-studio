'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@content-studio/core/adminKey'

type ReportView = {
  student?: { displayName: string; gradeLabel: string }
  headline?: { netDelta: number; percentImprovement: number; summary: string }
  conversationSuggestion?: { title: string; script: string }
  chart?: { title: string; series: Array<{ label: string; before: number; after: number }> }
}

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export default function ParentReportSamplePage() {
  const [adminKey, setAdminKey] = useState('')
  const [report, setReport] = useState<ReportView | null>(null)
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
      const res = await fetch('/api/parent-report', { headers: headers(key) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setReport(data.item?.report || null)
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
    setMsg('')
    try {
      const res = await fetch('/api/parent-report', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'seed' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setReport(data.item?.report || null)
      setMsg(data.upserted ? 'Örnek rapor güncellendi' : 'Örnek rapor yüklendi')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function exportLearnCon() {
    setBusy(true)
    try {
      const res = await fetch('/api/parent-report?format=learncon', { headers: headers(adminKey) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setExportJson(JSON.stringify(data, null, 2))
      setMsg('LEARNCON-PAR-V3 export hazır')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Örnek veli raporu</h1>
        <p className="text-sm text-neutral-600">
          CS-PAR-01 — Ali, 11. sınıf, +3 net / %38. Statik; LearnCon `/veli/rapor-ornegi`.
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
          Ali örneğini seed yükle
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void exportLearnCon()}
          className="rounded border border-neutral-400 px-3 py-2 text-sm disabled:opacity-50"
        >
          LearnCon JSON export
        </button>
        <a
          className="rounded border border-neutral-400 px-3 py-2 text-sm"
          href="/api/parent-report?format=html"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            // browser needs admin key header — open via fetch blob instead
            e.preventDefault()
            void (async () => {
              const res = await fetch('/api/parent-report?format=html', {
                headers: headers(adminKey),
              })
              const html = await res.text()
              const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
              window.open(URL.createObjectURL(blob), '_blank')
            })()
          }}
        >
          PDF HTML önizleme
        </a>
      </div>

      {msg ? <p className="text-sm text-neutral-800">{msg}</p> : null}

      {report ? (
        <section className="space-y-3 rounded border border-neutral-200 p-4 text-sm">
          <div className="text-lg font-semibold">
            {report.student?.displayName} · {report.student?.gradeLabel}
          </div>
          <div className="text-2xl font-bold">
            +{report.headline?.netDelta} net · %{report.headline?.percentImprovement}
          </div>
          <p className="text-neutral-700">{report.headline?.summary}</p>
          <h2 className="pt-2 font-semibold">{report.conversationSuggestion?.title}</h2>
          <p className="rounded bg-neutral-50 p-3 text-neutral-800">
            {report.conversationSuggestion?.script}
          </p>
          {report.chart ? (
            <div>
              <h2 className="font-semibold">{report.chart.title}</h2>
              <ul className="mt-1 list-inside list-disc text-neutral-600">
                {report.chart.series.map((s) => (
                  <li key={s.label}>
                    {s.label}: {s.before} → {s.after}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-neutral-500">Seed yükleyin veya yenileyin.</p>
      )}

      {exportJson ? (
        <pre className="max-h-80 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-3 text-xs">
          {exportJson}
        </pre>
      ) : null}
    </div>
  )
}
