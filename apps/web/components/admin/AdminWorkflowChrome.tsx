'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@/lib/adminKey'
import type { WorkflowSnapshot } from '@/lib/workflow/status'
import { PlatformIconLink } from '@/components/admin/PlatformIconLink'
import { WorkerOpsPanel } from '@/components/admin/WorkerOpsPanel'
import { DeployParityBanner } from '@/components/admin/DeployParityBanner'
import { SEGMENT_LABELS, isAudienceSegment } from '@/lib/audience/segments'

const NAV = [
  { href: '/admin', label: 'Pipeline', step: 'pipeline' },
  { href: '/admin/review', label: 'Onay', step: 'review', highlight: true },
  { href: '/admin/media', label: 'Medya', step: 'media' },
  { href: '/admin/social', label: 'Sosyal', step: 'social' },
  { href: '/admin/comments', label: 'Yorumlar' },
  { href: '/admin/calendar', label: 'Takvim', step: 'calendar' },
  { href: '/admin/discovery', label: 'Discovery', step: 'discovery' },
  { href: '/admin/analytics', label: 'Performans' },  // step yok — badge/workflow mant\u0131\u011f\u0131na hi\u00e7 girmiyor
  { href: '/admin/email', label: 'E-posta' },
]

function adminHeaders(key: string): HeadersInit {
  return { 'x-admin-key': key }
}

function formatPublishedWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR')
  } catch {
    return iso
  }
}

function accountStatusBadge(status: string): string {
  switch (status) {
    case 'oauth_ok':
    case 'ok':
      return 'badge ok'
    case 'dry_run':
      return 'badge warn'
    case 'missing':
    case 'expired':
    case 'failed_posts':
      return 'badge danger'
    default:
      return 'badge'
  }
}

export function AdminWorkflowChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [adminKey, setAdminKey] = useState('')
  const [workflow, setWorkflow] = useState<WorkflowSnapshot | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('cs_admin_key')
    setAdminKey(saved || DEFAULT_ADMIN_API_KEY)
  }, [])

  const loadWorkflow = useCallback(async () => {
    if (!adminKey) return
    try {
      const res = await fetch('/api/workflow', { headers: adminHeaders(adminKey), cache: 'no-store' })
      if (res.ok) setWorkflow(await res.json())
    } catch {
      /* ignore */
    }
  }, [adminKey])

  useEffect(() => {
    loadWorkflow()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadWorkflow()
      }
    }, 30 * 60_000) // 30 dakika

    const onVisible = () => {
      if (document.visibilityState === 'visible') loadWorkflow()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadWorkflow])

  const stepMap = new Map(workflow?.steps.map((s) => [s.id, s]) ?? [])

  return (
    <>
      <nav className="admin-subnav" aria-label="Admin">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
          const step = item.step ? stepMap.get(item.step as WorkflowSnapshot['steps'][0]['id']) : undefined
          const badge =
            step?.count && (item.step === 'review' ? step.count > 0 : step.count > 0)
              ? step.count
              : null
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-link ${active ? 'active' : ''} ${item.highlight ? 'emph' : ''}`}
            >
              {item.label}
              {item.step === 'review' && workflow && workflow.counts.reviewPending > 0 ? (
                <span className="nav-pill warn">{workflow.counts.reviewPending}</span>
              ) : badge && item.step !== 'review' ? (
                <span className="nav-pill">{badge}</span>
              ) : null}
            </Link>
          )
        })}
        <Link href="/docs/social-setup" className="admin-nav-link muted-link">
          SM rehber
        </Link>
      </nav>

      {adminKey ? <DeployParityBanner adminKey={adminKey} /> : null}

      {workflow ? (
        <section className="workflow-track panel" aria-label="Süreç durumu">
          <div className="workflow-steps">
            {workflow.steps.map((step, i) => (
              <div key={step.id} className="workflow-step-wrap">
                <Link
                  href={step.href}
                  className={`workflow-step state-${step.state} ${pathname === step.href ? 'current-page' : ''}`}
                >
                  <span className="workflow-step-num">{i + 1}</span>
                  <span className="workflow-step-label">{step.label}</span>
                  <span className="workflow-step-detail">{step.detail}</span>
                </Link>
                {i < workflow.steps.length - 1 ? <span className="workflow-arrow" aria-hidden>→</span> : null}
              </div>
            ))}
          </div>

          {workflow.accountHealth?.slots?.length ? (
            <div className="workflow-accounts">
              <strong>SM hesapları</strong>
              <ul className="workflow-account-list">
                {workflow.accountHealth.slots.map((slot) => (
                  <li key={slot.platform}>
                    <PlatformIconLink platform={slot.platform} />
                    <span className={accountStatusBadge(slot.status)}>{slot.status.replace('_', ' ')}</span>
                    <span className="muted">{slot.detail}</span>
                  </li>
                ))}
              </ul>
              {workflow.accountHealth.repaired?.length ? (
                <p className="muted workflow-repair-note">
                  Otomatik eklendi: {workflow.accountHealth.repaired.join(', ')} (dry-run)
                </p>
              ) : null}
            </div>
          ) : null}

          {workflow.publishedFeed?.length ? (
            <div className="workflow-published">
              <strong>Yayınlanan (son {workflow.publishedFeed.length})</strong>
              <ul className="published-feed">
                {workflow.publishedFeed.map((item) => (
                  <li key={item.id} className="published-feed-item">
                    <div className="published-feed-head">
                      <PlatformIconLink platform={item.platform} username={item.accountName} />
                      <span
                        className={
                          item.segment && isAudienceSegment(item.segment)
                            ? 'published-post-chip'
                            : 'published-post-chip muted'
                        }
                        title="Hedef kitle segmenti"
                      >
                        {item.segment && isAudienceSegment(item.segment)
                          ? SEGMENT_LABELS[item.segment]
                          : 'Segment yok'}
                      </span>
                      <time className="muted">{formatPublishedWhen(item.publishedAt)}</time>
                      {item.isDryRun || item.isMockPost ? (
                        <span className="badge warn">dry-run / mock</span>
                      ) : null}
                    </div>
                    <p className="published-feed-preview">{item.preview}</p>
                    <div className="published-feed-meta muted">
                      {item.accountName}
                      {item.publicUrl ? (
                        <>
                          {' · '}
                          <a href={item.publicUrl} target="_blank" rel="noopener noreferrer">
                            Paylaşımı aç ↗
                          </a>
                        </>
                      ) : item.isMockPost ? (
                        ' · gerçek platformda görünmez'
                      ) : null}
                    </div>
                    {item.imagePreviewUrl ? (
                      <img
                        className="published-feed-thumb"
                        src={item.imagePreviewUrl}
                        alt=""
                        loading="lazy"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <WorkerOpsPanel adminKey={adminKey} onDone={loadWorkflow} />

          <div className="workflow-next">
            <strong>Sıradaki:</strong>
            <ul>
              {workflow.nextActions.slice(0, 4).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {children}
    </>
  )
}
