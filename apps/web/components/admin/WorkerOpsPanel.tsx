'use client'

import { useCallback, useEffect, useState } from 'react'
import { BtnInfoMark } from '@/components/admin/BtnInfoMark'

type WorkerTickProfile = 'quick' | 'daily' | 'full'

type WorkerStatus = {
  mode?: string
  cronEnabled?: boolean
  cronNote?: string
  appUrl?: string
}

async function readApiJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    const trimmed = text.replace(/\s+/g, ' ').trim()
    if (/FUNCTION_INVOCATION_TIMEOUT/i.test(trimmed) || res.status === 504) {
      return {
        error:
          'Zaman aşımı (Vercel ~60s) — «Zamanlanmışları yayınla» veya birkaç kez «Sıradaki adım»; günlük/discovery yerelde',
      }
    }
    if (/An error occurred with your deployment/i.test(trimmed)) {
      return { error: `Sunucu hatası (${res.status}): ${trimmed.slice(0, 160)}` }
    }
    return { error: `Yanıt JSON değil (${res.status}): ${trimmed.slice(0, 200)}` }
  }
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
      const data = await readApiJson(res)
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
      const data = await readApiJson(res)
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
        Senaryo A — worker sürekli açık değil. Günlük ilerleme: <strong>Sıradaki adım</strong> (tekrarlayın).
        Hover = ne zaman kullanılır. Arı (video) otomatik onayı engellemez.
      </p>
      {status ? (
        <p className="muted workflow-worker-meta">
          Mod: {status.mode === 'serverless' ? 'Vercel (serverless)' : 'yerel'} · cron:{' '}
          {status.cronEnabled ? 'aktif' : 'kapalı (manuel)'}
          {status.cronNote ? ` · ${status.cronNote}` : ''}
        </p>
      ) : null}
      <div className="row workflow-worker-actions">
        <button
          type="button"
          className="ok has-info"
          disabled={Boolean(busy)}
          title="Asıl akış butonu. Temiz Onay yoksa: taslak sync + en dolu platformdan ~10 yayın (X hariç). Onay/Medya gerekirse oraya yönlendirir. Arı engellemez — birkaç kez tıklayın."
          onClick={runContinue}
        >
          {busy === 'continue' ? '…' : 'Sıradaki adım'}
          <BtnInfoMark />
        </button>
        <button
          type="button"
          className="secondary has-info"
          disabled={Boolean(busy)}
          title="Sadece zamanı gelmiş SCHEDULED postları yayınlar (~birkaç sn). Cron yokken veya «şu an yayınlansın» için. Taslak/onay işi yapmaz."
          onClick={() => runTick('quick')}
        >
          {busy === 'quick' ? '…' : 'Zamanlanmışları yayınla'}
          <BtnInfoMark />
        </button>
        <button
          type="button"
          className="secondary has-info"
          disabled={Boolean(busy)}
          title="Hafif bakım: kuyruk + taslak onarım. Vercel’de discovery/HPV/analytics atlanır (Hobby 60s). Ağır keşif için yerelde npm run worker veya local daily."
          onClick={() => runTick('daily')}
        >
          {busy === 'daily' ? '…' : 'Günlük bakım'}
          <BtnInfoMark />
        </button>
        <button
          type="button"
          className="secondary has-info"
          disabled={Boolean(busy)}
          title="Yalnızca yerelde / PC worker. Autopilot + daha fazla kuyruk; video/ffmpeg burada değil (Medya veya local generate). Prod Vercel’de timeout riski — tercih etmeyin."
          onClick={() => runTick('full')}
        >
          {busy === 'full' ? '…' : 'Tam tur (ağır)'}
          <BtnInfoMark />
        </button>
      </div>
      {msg ? (
        <p className={`workflow-worker-msg ${msgOk ? 'is-ok' : 'is-err'}`}>{msg}</p>
      ) : null}
    </div>
  )
}
