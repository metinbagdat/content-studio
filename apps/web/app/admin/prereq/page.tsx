'use client'

import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@content-studio/core/adminKey'

type TreeNode = {
  code: string
  label: string
  examType: string
  subject: string
  unit: string | null
  children: TreeNode[]
}

type PrereqItem = {
  id: string
  title: string
  parseError?: string
  forest?: TreeNode[]
  graph?: { nodes: Array<{ code: string; prerequisites: string[] }> }
  export?: unknown
}

function headers(key: string, json = false): HeadersInit {
  const h: Record<string, string> = { 'x-admin-key': key }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

function Tree({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
  if (!nodes.length) return null
  return (
    <ul className={depth === 0 ? 'space-y-1' : 'mt-1 space-y-1 border-l border-neutral-200 pl-3'}>
      {nodes.map((n) => (
        <li key={n.code} className="text-sm">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium text-neutral-900">{n.label}</span>
            <span className="font-mono text-xs text-neutral-500">{n.code}</span>
            {n.unit ? <span className="text-xs text-neutral-400">{n.unit}</span> : null}
            <span className="text-xs text-neutral-400">{n.examType}</span>
          </div>
          <Tree nodes={n.children} depth={depth + 1} />
        </li>
      ))}
    </ul>
  )
}

export default function PrereqGraphPage() {
  const [adminKey, setAdminKey] = useState('')
  const [item, setItem] = useState<PrereqItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [exportJson, setExportJson] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('cs_admin_key') || DEFAULT_ADMIN_API_KEY
    setAdminKey(stored)
  }, [])

  const load = useCallback(async (key: string) => {
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/prereq', { headers: headers(key) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setItem((data.items && data.items[0]) || null)
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
      const res = await fetch('/api/prereq', {
        method: 'POST',
        headers: headers(adminKey, true),
        body: JSON.stringify({ action: 'seed' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setItem(data.item)
      setMsg(data.upserted ? 'Graf güncellendi' : 'Graf yüklendi')
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
      const res = await fetch('/api/prereq?format=learncon', { headers: headers(adminKey) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setExportJson(JSON.stringify(data, null, 2))
      setMsg(`LearnCon export: ${data.nodes?.length ?? 0} node`)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const logEdge =
    item?.graph?.nodes?.find((n) => n.code === '12.1.2.1.')?.prerequisites.includes('12.1.1.1.') ??
    false

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Önkoşul grafiği</h1>
        <p className="text-sm text-neutral-600">
          CS-STU-02 — TYT Matematik tam graph + AYT Logaritma → Üstel. LearnCon #1753 traversal bu
          export’u kullanır.
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
          TYT Mat seed yükle
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

      {item?.parseError ? (
        <p className="text-sm text-red-700">{item.parseError}</p>
      ) : item?.forest ? (
        <section className="space-y-3 rounded border border-neutral-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{item.title}</h2>
            <span
              className={`text-xs ${logEdge ? 'text-emerald-700' : 'text-amber-700'}`}
              title="12.1.2.1. → 12.1.1.1."
            >
              {logEdge ? 'Logaritma → Üstel bağlı' : 'Logaritma → Üstel eksik'}
            </span>
          </div>
          <Tree nodes={item.forest} />
        </section>
      ) : (
        <p className="text-sm text-neutral-500">Graf yok — seed yükleyin.</p>
      )}

      {exportJson ? (
        <pre className="max-h-96 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-3 text-xs">
          {exportJson}
        </pre>
      ) : null}
    </div>
  )
}
