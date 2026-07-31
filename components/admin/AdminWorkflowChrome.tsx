'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ADMIN_API_KEY } from '@/lib/adminKey'
import type { WorkflowSnapshot } from '@/lib/workflow/status'

const NAV = [
  { href: '/admin', label: 'Pipeline', step: 'pipeline' },
  { href: '/admin/review', label: 'Onay', step: 'review', highlight: true },
  { href: '/admin/media', label: 'Medya', step: 'media' },
  { href: '/admin/social', label: 'Sosyal', step: 'social' },
  { href: '/admin/calendar', label: 'Takvim', step: 'calendar' },
  { href: '/admin/discovery', label: 'Discovery', step: 'discovery' },
]

function adminHeaders(key: string): HeadersInit {
  return { 'x-admin-key': key }
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
    const t = setInterval(loadWorkflow, 30_000)
    return () => clearInterval(t)
  }, [loadWorkflow])

  const stepMap = new Map(workflow?.steps.map((s) => [s.id, s]) ?? [])

  return (
    <>
      <nav className="admin-subnav" aria-label="Admin">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
          const step = stepMap.get(item.step as WorkflowSnapshot['steps'][0]['id'])
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
          <div className="workflow-next">
            <strong>Sıradaki:</strong>
            <ul>
              {workflow.nextActions.slice(0, 3).map((a) => (
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
