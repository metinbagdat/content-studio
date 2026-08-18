'use client'

import { platformLabel, platformProfileUrl } from '@/lib/social/platformLinks'

type Props = {
  platform: string
  username?: string | null
  profileUrl?: string | null
  className?: string
  title?: string
}

/** Platform badge — opens profile in a new tab when URL is known. */
export function PlatformIconLink({ platform, username, profileUrl, className = '', title }: Props) {
  const label = platformLabel(platform)
  const href = platformProfileUrl(platform, username, profileUrl)
  const baseClass = `badge plat-${platform} sm-icon-link ${className}`.trim()

  if (!href) {
    return <span className={baseClass}>{label}</span>
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={baseClass}
      title={title || `${label} profilini yeni sekmede aç`}
    >
      {label}
    </a>
  )
}
