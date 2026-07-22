/** Relative path for admin img src (works regardless of NEXT_PUBLIC_APP_URL). */
export function toImagePreviewPath(url?: string | null): string | null {
  if (!url?.trim()) return null
  const trimmed = url.trim()
  const match = trimmed.match(/\/api\/media\/([0-9a-f-]{36})\/image/i)
  if (match) return `/api/media/${match[1]}/image`
  if (trimmed.startsWith('/api/media/')) return trimmed
  return trimmed
}

export function isDefaultOgImage(url: string): boolean {
  return url.includes('opengraph-image')
}

export function isGeneratedImageUrl(url: string): boolean {
  return /\/api\/media\/[0-9a-f-]{36}\/image/i.test(url)
}
