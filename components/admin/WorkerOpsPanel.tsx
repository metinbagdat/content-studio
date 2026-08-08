'use client'

import { useCallback, useEffect, useState } from 'react'

type WorkerTickProfile = 'quick' | 'daily' | 'full'

type WorkerStatus = {
  mode?: string
  cronEnabled?: boolean
  cronNote?: string
  appUrl?: string
}

export function WorkerOpsPanel({
  adminKey,
  onDone,
}: {
  adminKey: string
  onDone?: () => void
}) {
  const [busy, setBusy] = useState<WorkerTickProfile | 'continue' | null>(null)
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(true)
  const [status, setStatus] = useState<WorkerStatus | null>(null)

  const loadStatus = useCallback(async () => {
    if (!adminKey) return
    try {
      const res = await fetch('/api/worker/status', { headers: { 'x-admin-key': adminKey }, cache: 'no-store' })
      if (res.ok) setStatus(await res.json())
    } catch {
      /* ignore */
    }
  }, [adminKey])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  async function runContinue() {
    if (!adminKey) {
      setMsgOk(false)
      setMsg('Admin API key gerekli')
      return
    }
    setBusy('continue')
    setMsg('Sıradaki adım çalışıyor…')
    setMsgOk(true)
    try {
      const res = await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) {
        setMsgOk(false)
        setMsg(String(data.error || 'İşlem başarısız'))
        return
      }
      setMsgOk(true)
      setMsg(
        String(data.summary || 'Tamamlandı') +
          (data.manual ? ` · ${data.manual}` : ''),
      )
      onDone?.()
    } catch (err) {
      setMsgOk(false)
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function runTick(profile: WorkerTickProfile) {
    if (!adminKey) {
      setMsgOk(false)
      setMsg('Admin API key gerekli')
      return
    }
    setBusy(profile)
    setMsg(profile === 'quick' ? 'Zamanlanmış yayınlar kontrol ediliyor…' : 'İşlem çalışıyor…')
    setMsgOk(true)
    try {
      const res = await fetch('/api/worker/tick', {
        method: 'POST',
        headers: {
          'x-admin-key': adminKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profile }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsgOk(false)
        setMsg(String(data.error || 'İşlem başarısız'))
        return
      }
      setMsgOk(Boolean(data.ok))
      setMsg(String(data.summary || 'Tamamlandı'))
      onDone?.()
    } catch (err) {
      setMsgOk(false)
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="workflow-worker-ops">
      <strong>Arka plan işlemleri</strong>
      <p className="muted workflow-worker-lead">
        Senaryo A — worker sürekli açık değil. Akışı ilerletmek için{' '}
        <strong>Sıradaki adım</strong> (taslak sync + en dolu platformdan 10 yayın) — tekrarlayarak devam edin.
      </p>
      {status ? (
        <p className="muted workflow-worker-meta">
          Mod: {status.mode === 'serverless' ? 'Vercel (serverless)' : 'yerel'} · cron:{' '}
          {status.cronEnabled ? 'aktif' : 'CRON_SECRET yok — yalnızca manuel'}
          {status.cronNote ? ` · ${status.cronNote}` : ''}
        </p>
      ) : null}
      <div className="row workflow-worker-actions">
        <button type="button" className="ok" disabled={Boolean(busy)} onClick={runContinue}>
          {busy === 'continue' ? '…' : 'Sıradaki adım'}
        </button>
        <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => runTick('quick')}>
          {busy === 'quick' ? '…' : 'Zamanlanmışları yayınla'}
        </button>
        <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => runTick('daily')}>
          {busy === 'daily' ? '…' : 'Günlük bakım'}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={Boolean(busy)}
          title="Video/görsel üretimi — yerelde veya PC worker ile"
          onClick={() => runTick('full')}
        >
          {busy === 'full' ? '…' : 'Tam tur (ağır)'}
        </button>
      </div>
      {msg ? (
        <p className={`workflow-worker-msg ${msgOk ? 'is-ok' : 'is-err'}`}>{msg}</p>
      ) : null}
    </div>
  )
}
