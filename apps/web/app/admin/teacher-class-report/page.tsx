'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@content-studio/core/adminKey'

type ReportView = {
  classMeta?: { label: string; studentCount: number; exam: string; subject: string }
  summary?: { avgNet: number; medianNet: number; below8Count: number; headline: string }
  parentMeetingPage?: { title: string }
  charts?: unknown[]
}

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export default function TeacherClassReportPage() {
  const [adminKey, setAdminKey] = useState('')
  const [report, setReport] = useState<ReportView | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setAdminKey(localStorage.getItem('cs_admin_key') || DEFAULT_ADMIN_API_KEY)
  }, [])

  const load = useCallback(async (key: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/teacher-class-report', { headers: headers(key) })
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
    try {
      const res = await fetch('/api/teacher-class-report', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'seed' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setReport(data.item?.report || null)
      setMsg(data.upserted ? 'Sınıf raporu güncellendi' : 'Sınıf raporu yüklendi')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Örnek sınıf analizi</h1>
        <p className="text-sm text-neutral-600">
          CS-TCH-02 — 30 öğrenci TYT Matematik, grafik JSON, PDF HTML, veli toplantısı sayfası.
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
          30 öğrenci seed
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded border border-neutral-400 px-3 py-2 text-sm disabled:opacity-50"
          onClick={() =>
            void (async () => {
              const res = await fetch('/api/teacher-class-report?format=html', {
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
          PDF + veli toplantısı HTML
        </button>
      </div>

      {msg ? <p className="text-sm text-neutral-800">{msg}</p> : null}

      {report ? (
        <section className="space-y-2 rounded border border-neutral-200 p-4 text-sm">
          <div className="font-semibold">
            {report.classMeta?.label} · {report.classMeta?.studentCount} öğrenci ·{' '}
            {report.classMeta?.exam} {report.classMeta?.subject}
          </div>
          <p>{report.summary?.headline}</p>
          <p className="text-neutral-600">
            Ort. {report.summary?.avgNet} · medyan {report.summary?.medianNet} · &lt;8 net:{' '}
            {report.summary?.below8Count} · grafikler: {report.charts?.length ?? 0}
          </p>
          <p className="text-neutral-600">{report.parentMeetingPage?.title}</p>
        </section>
      ) : (
        <p className="text-sm text-neutral-500">Seed yükleyin.</p>
      )}
    </div>
  )
}
