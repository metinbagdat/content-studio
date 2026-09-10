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

  const isServerless = status?.mode === 'serverless'

  return (
    <div className="workflow-worker-ops">
      <strong className="has-info" title="Prod Vercel’de worker/cron kapalı. İlerleme: bu butonlar veya yerelde npm run ops:daily. Hobby egress: günlük Docker localhost:5434; Supabase yalnız kısa one-shot (CS_ALLOW).">
        Arka plan işlemleri
        <BtnInfoMark />
      </strong>
      <p className="muted workflow-worker-lead">
        Senaryo A — sürekli worker yok. Panelde: <strong>Sıradaki adım</strong>. Ağır video / toplu sosyal:{' '}
        <code className="has-info" title="Yerel terminal checklist. status/social = prod HTTP (ADMIN_API_KEY, CS_ALLOW yok). video = child process’te CS_ALLOW=1 + .env.prod.pull; parent shell’de flag kalmaz. worker:loop+Supabase kullanma.">
          npm run ops:daily
          <BtnInfoMark />
        </code>
        . Hover = ne zaman. Arı onayı engellemez.
      </p>
      {status ? (
        <p className="muted workflow-worker-meta">
          Mod: {isServerless ? 'Vercel (serverless)' : 'yerel'} · cron:{' '}
          {status.cronEnabled ? 'aktif' : 'kapalı (manuel)'}
          {status.cronNote ? ` · ${status.cronNote}` : ''}
        </p>
      ) : null}

      <ol className="workflow-ops-daily muted">
        <li
          className="has-info"
          title="studio.egitim.today /admin/review — temiz Onay. Arı (video fault) bu adımı bloklamaz; video yerelde ops:daily video ile üretilir."
        >
          Onay (prod UI)
          <BtnInfoMark />
        </li>
        <li
          className="has-info"
          title="Laptop: npm run ops:daily -- video -- --limit=10 --type=SHORT_VIDEO_SCRIPT --approve. ffmpeg→Blob. CS_ALLOW yalnız child’ta; bitince .env’i localhost:5434’e bırak."
        >
          Arı video (yerel one-shot)
          <BtnInfoMark />
        </li>
        <li
          className="has-info"
          title="npm run ops:daily -- social — sync-drafts + LI/FB bulk via studio API. Egress yok (CS_ALLOW gerekmez). X kredi / Pinterest Trial ayrı."
        >
          Sosyal drain (prod HTTP)
          <BtnInfoMark />
        </li>
        <li
          className="has-info"
          title="npm run ops:daily -- youtube-seo — Blob URL’li long-form. generateVideo=false; Vercel’de ffmpeg yok."
        >
          YouTube SEO (Blob hazırsa)
          <BtnInfoMark />
        </li>
      </ol>

      <div className="row workflow-worker-actions">
        <button
          type="button"
          className="ok has-info"
          disabled={Boolean(busy)}
          title="Asıl panel akışı. Temiz Onay yoksa: taslak sync + en dolu platformdan ~10 yayın (X hariç). Onay/Medya gerekirse yönlendirir. Arı engellemez. Ağır video için yerelde ops:daily video."
          onClick={runContinue}
        >
          {busy === 'continue' ? '…' : 'Sıradaki adım'}
          <BtnInfoMark />
        </button>
        <button
          type="button"
          className="secondary has-info"
          disabled={Boolean(busy)}
          title="Sadece zamanı gelmiş SCHEDULED postları yayınlar (~birkaç sn). Cron yokken veya «şu an yayınlansın» için. Taslak/onay/video üretmez."
          onClick={() => runTick('quick')}
        >
          {busy === 'quick' ? '…' : 'Zamanlanmışları yayınla'}
          <BtnInfoMark />
        </button>
        <button
          type="button"
          className="secondary has-info"
          disabled={Boolean(busy)}
          title="Hafif bakım: kuyruk + taslak onarım. Vercel’de discovery/HPV/analytics atlanır (Hobby 60s). Tam checklist: yerelde npm run ops:daily."
          onClick={() => runTick('daily')}
        >
          {busy === 'daily' ? '…' : 'Günlük bakım'}
          <BtnInfoMark />
        </button>
        <button
          type="button"
          className="secondary has-info"
          disabled={Boolean(busy)}
          title="Yalnızca yerelde / PC. Autopilot + kuyruk; ffmpeg burada değil. Prod Vercel’de timeout — tercih etme. Sistematik drain: npm run ops:daily (video/social)."
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
