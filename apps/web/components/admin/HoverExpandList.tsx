'use client'

import type { ReactNode } from 'react'

export function hoverSnippet(text: string, n = 72): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

export function HoverExpandList({
  className,
  as: Tag = 'ul',
  children,
}: {
  className?: string
  as?: 'ul' | 'ol'
  children: ReactNode
}) {
  return <Tag className={`hover-list list${className ? ` ${className}` : ''}`}>{children}</Tag>
}

export function HoverExpandRow({
  className,
  expanded,
  summary,
  children,
  tabIndex = 0,
}: {
  className?: string
  expanded?: boolean
  summary: ReactNode
  children?: ReactNode
  tabIndex?: number
}) {
  return (
    <li
      className={`hover-row${expanded ? ' is-expanded' : ''}${className ? ` ${className}` : ''}`}
      tabIndex={tabIndex}
    >
      <div className="hover-row-summary">{summary}</div>
      {children != null ? (
        <div className="hover-row-expand">
          <div className="hover-row-expand-inner">{children}</div>
        </div>
      ) : null}
    </li>
  )
}
