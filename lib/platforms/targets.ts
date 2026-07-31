export type PlatformId =
  | 'TWITTER'
  | 'YOUTUBE'
  | 'LINKEDIN'
  | 'INSTAGRAM'
  | 'TIKTOK'
  | 'FACEBOOK'

export type PlatformTarget = {
  id: PlatformId
  label: string
  short: string
  /** Generation priority (lower = first) */
  priority: number
  /** Shown as primary in UI */
  featured?: boolean
}

/** Canonical SM targets for egitim.today promotion. X + YouTube lead. */
export const PLATFORM_TARGETS: PlatformTarget[] = [
  { id: 'TWITTER', label: 'X (Twitter)', short: 'X', priority: 1, featured: true },
  { id: 'YOUTUBE', label: 'YouTube', short: 'YT', priority: 2, featured: true },
  { id: 'LINKEDIN', label: 'LinkedIn', short: 'LI', priority: 3 },
  { id: 'INSTAGRAM', label: 'Instagram', short: 'IG', priority: 4 },
  { id: 'TIKTOK', label: 'TikTok', short: 'TT', priority: 5 },
  { id: 'FACEBOOK', label: 'Facebook', short: 'FB', priority: 6 },
]

export const DEFAULT_PIPELINE_PLATFORMS: PlatformId[] = [
  'TWITTER',
  'YOUTUBE',
  'LINKEDIN',
  'INSTAGRAM',
  'TIKTOK',
]

export function normalizePlatforms(input: unknown): PlatformId[] {
  const allowed = new Set(PLATFORM_TARGETS.map((p) => p.id))
  const list = (Array.isArray(input) ? input : DEFAULT_PIPELINE_PLATFORMS)
    .map((p) => String(p) as PlatformId)
    .filter((p) => allowed.has(p))
  const order = new Map(PLATFORM_TARGETS.map((p) => [p.id, p.priority]))
  const unique = [...new Set(list.length ? list : DEFAULT_PIPELINE_PLATFORMS)]
  return unique.sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
}

export function platformWants(selected: PlatformId[] | undefined, platform: PlatformId): boolean {
  if (!selected?.length) return true
  return selected.includes(platform)
}
