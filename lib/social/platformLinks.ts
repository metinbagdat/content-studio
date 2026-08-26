/** Default public profile / channel URLs when API did not return profileUrl. */
export function platformProfileUrl(
  platform: string,
  username?: string | null,
  statsProfileUrl?: string | null,
): string | null {
  if (statsProfileUrl?.trim()) return statsProfileUrl.trim()
  const u = username?.replace(/^@/, '').trim()
  if (platform === 'TWITTER' && u && u !== 'dry-run') {
    return `https://twitter.com/${u}`
  }
  if (platform === 'LINKEDIN' && u && !u.startsWith('org:') && u !== 'dry-run') {
    return `https://www.linkedin.com/in/${encodeURIComponent(u)}`
  }
  if (platform === 'YOUTUBE') return 'https://www.youtube.com'
  if (platform === 'INSTAGRAM') return 'https://www.instagram.com'
  if (platform === 'TIKTOK') return 'https://www.tiktok.com'
  if (platform === 'PINTEREST' && u && u !== 'dry-run') {
    return `https://www.pinterest.com/${encodeURIComponent(u)}/`
  }
  if (platform === 'PINTEREST') return 'https://www.pinterest.com'
  return null
}

export function platformLabel(platform: string): string {
  switch (platform) {
    case 'TWITTER':
      return 'X'
    case 'LINKEDIN':
      return 'LinkedIn'
    case 'YOUTUBE':
      return 'YouTube'
    case 'INSTAGRAM':
      return 'Instagram'
    case 'TIKTOK':
      return 'TikTok'
    case 'FACEBOOK':
      return 'Facebook'
    case 'PINTEREST':
      return 'Pinterest'
    default:
      return platform
  }
}
