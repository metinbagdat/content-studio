'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@content-studio/core/adminKey'

type DiagnosticListItem = {
  id: string
  title: string
  tags: string[]
  updatedAt: string
  parseError?: string
  question?: {
    slug: string
    examType: string
    topic: string
    difficulty: string
    learningOutcomeCode: string
    correctKey: string
  }
}

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export default function DiagnosticBankPage() {
  const [adminKey, setAdminKey] = useState('')
  const [items, setItems] = useState<DiagnosticListItem[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [exportJson, setExportJson] = useState('')
  const [editor, setEditor] = useState('')
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('cs_admin_key') || DEFAULT_ADMIN_API_KEY
    setAdminKey(stored)
  }, [])

  const load = useCallback(async (key: string) => {
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/diagnostic', { headers: headers(key) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setItems(data.items || [])
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
      const res = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'seed' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setMsg(`Seed: +${data.created} yeni, ${data.skipped} atlandı`)
      await load(adminKey)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function exportLearnCon() {
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/diagnostic?format=learncon', { headers: headers(adminKey) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setExportJson(JSON.stringify(data, null, 2))
      setMsg(`LearnCon export: ${data.count} soru`)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Bu diagnostic kaydını sil?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/diagnostic?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: headers(adminKey),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      await load(adminKey)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function openEdit(id: string) {
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/diagnostic', { headers: headers(adminKey) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      const row = (data.items || []).find((i: DiagnosticListItem) => i.id === id)
      if (!row?.question) throw new Error(row?.parseError || 'soru yok')
      setEditId(id)
      setEditor(JSON.stringify(row.question, null, 2))
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function openNew() {
    setEditId(null)
    setEditor(
      JSON.stringify(
        {
          slug: 'yeni-soru',
          examType: 'TYT',
          topic: 'Konu',
          difficulty: 'medium',
          stem: 'Soru metni?',
          options: [
            { key: 'A', text: 'A', misconception: 'çeldirici' },
            { key: 'B', text: 'B', misconception: null },
            { key: 'C', text: 'C', misconception: 'çeldirici' },
            { key: 'D', text: 'D', misconception: 'çeldirici' },
          ],
          correctKey: 'B',
          explanation: 'Açıklama',
          learningOutcomeCode: 'TYT.TR.9.1.',
          prerequisiteCode: null,
        },
        null,
        2,
      ),
    )
  }

  async function saveEditor() {
    setBusy(true)
    setMsg('')
    try {
      const question = JSON.parse(editor)
      const res = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'upsert', id: editId, question }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setMsg(editId ? 'Güncellendi' : 'Eklendi')
      setEditId(data.item?.id || editId)
      await load(adminKey)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Diagnostic soru bankası</h1>
        <p className="text-sm text-neutral-600">
          CS-STU-01 — TYT / AYT / LGS / OKUL. LearnCon export sözleşmesi LEARNCON-STU-02.
        </p>
      </header>

      <label className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
        Admin API key
        <input
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 font-mono text-sm"
          type="password"
          value={adminKey}
          onChange={(e) => {
            const v = e.target.value
            setAdminKey(v)
            localStorage.setItem('cs_admin_key', v)
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
          8 soruluk seed yükle
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void exportLearnCon()}
          className="rounded border border-neutral-400 px-3 py-2 text-sm disabled:opacity-50"
        >
          LearnCon JSON export
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => openNew()}
          className="rounded border border-neutral-400 px-3 py-2 text-sm disabled:opacity-50"
        >
          Yeni soru
        </button>
      </div>

      {msg ? <p className="text-sm text-neutral-800">{msg}</p> : null}

      <ul className="divide-y divide-neutral-200 rounded border border-neutral-200">
        {items.length === 0 ? (
          <li className="p-4 text-sm text-neutral-500">Kayıt yok — seed yükleyin.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 p-3 text-sm">
              <div>
                <div className="font-medium">{item.title}</div>
                {item.question ? (
                  <div className="mt-1 text-neutral-600">
                    {item.question.examType} · {item.question.difficulty} ·{' '}
                    {item.question.learningOutcomeCode} · doğru {item.question.correctKey}
                  </div>
                ) : (
                  <div className="mt-1 text-red-700">{item.parseError || 'parse hatası'}</div>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  disabled={busy || Boolean(item.parseError)}
                  onClick={() => void openEdit(item.id)}
                  className="text-xs text-neutral-800 underline disabled:opacity-50"
                >
                  Düzenle
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(item.id)}
                  className="text-xs text-red-700 underline disabled:opacity-50"
                >
                  Sil
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      {editor ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{editId ? 'Düzenle' : 'Yeni soru'}</h2>
          <textarea
            className="h-64 w-full rounded border border-neutral-300 p-2 font-mono text-xs"
            value={editor}
            onChange={(e) => setEditor(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveEditor()}
              className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Kaydet
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditor('')
                setEditId(null)
              }}
              className="rounded border border-neutral-400 px-3 py-2 text-sm disabled:opacity-50"
            >
              Kapat
            </button>
          </div>
        </section>
      ) : null}

      {exportJson ? (
        <pre className="max-h-96 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-3 text-xs">
          {exportJson}
        </pre>
      ) : null}
    </div>
  )
}
