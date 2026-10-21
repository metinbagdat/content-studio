/**
 * Keyword research row on the existing ContentSource shape.
 * No new table. Social output stays a human review draft.
 */

export const VOLUME_SOURCES = ['unverified', 'ahrefs-third-party', 'gsc', 'keyword_planner'] as const

export type VolumeSource = (typeof VOLUME_SOURCES)[number]

export const PUBLISH_QUALITY_MIN = 90

export type KeywordResearchInput = {
  keyword: string
  group: string
  volumeSource: VolumeSource
  intent: string
  targetUrl: string
  /** Third-party figure. Never a verified egitim.today volume by itself. */
  claimedVolume?: number | null
}

export type KeywordSourceDraft = {
  title: string
  category: 'seo-keyword'
  tags: string[]
  content: string
}

export type SocialDerivativePlan =
  | { create: false; reason: 'human_approval_required' | 'quality_below_90'; status: null; autoPublish: false }
  | { create: true; status: 'IN_REVIEW'; autoPublish: false; contentType: 'SOCIAL_CAPTION' }

const VERIFIED_SOURCES = new Set<VolumeSource>(['gsc', 'keyword_planner'])

export function volumeIsVerified(source: VolumeSource): boolean {
  return VERIFIED_SOURCES.has(source)
}

export function buildKeywordSource(input: KeywordResearchInput): KeywordSourceDraft {
  const keyword = input.keyword.trim()
  const group = input.group.trim()
  const intent = input.intent.trim()
  const targetUrl = input.targetUrl.trim()
  if (!keyword || !group || !intent || !targetUrl) {
    throw new Error('keyword, grup, intent ve hedef URL gerekli')
  }
  if (!VOLUME_SOURCES.includes(input.volumeSource)) {
    throw new Error('volume_source geçersiz')
  }
  if (input.claimedVolume != null && input.volumeSource === 'unverified') {
    throw new Error('Doğrulanmamış kayda hacim rakamı yazılmaz')
  }
  if (input.claimedVolume != null && !volumeIsVerified(input.volumeSource) && input.volumeSource !== 'ahrefs-third-party') {
    throw new Error('Hacim rakamı volume_source olmadan doğrulanmış yazılmaz')
  }

  const record = {
    keyword,
    group,
    volumeSource: input.volumeSource,
    verified: volumeIsVerified(input.volumeSource),
    intent,
    targetUrl,
    claimedVolume: input.claimedVolume ?? null,
  }

  return {
    title: keyword,
    category: 'seo-keyword',
    tags: [`volume:${input.volumeSource}`, `group:${group}`, `intent:${intent}`],
    content: JSON.stringify(record),
  }
}

export function readKeywordRecord(content: string) {
  const parsed = JSON.parse(content) as {
    keyword: string
    group: string
    volumeSource: VolumeSource
    verified?: boolean
    intent: string
    targetUrl: string
    claimedVolume?: number | null
  }
  const verified = volumeIsVerified(parsed.volumeSource)
  if (parsed.verified === true && !verified) {
    throw new Error('Ahrefs veya doğrulanmamış hacim, doğrulanmış yazılamaz')
  }
  return { ...parsed, verified }
}

/** Human approval opens review. It never publishes. Quality under 90 stays unpublished. */
export function planSocialDerivative(opts: { humanApproved: boolean; quality: number }): SocialDerivativePlan {
  if (!opts.humanApproved) {
    return { create: false, reason: 'human_approval_required', status: null, autoPublish: false }
  }
  if (opts.quality < PUBLISH_QUALITY_MIN) {
    return { create: false, reason: 'quality_below_90', status: null, autoPublish: false }
  }
  return { create: true, status: 'IN_REVIEW', autoPublish: false, contentType: 'SOCIAL_CAPTION' }
}

export const YKS_STUDY_PLAN_KEYWORD: KeywordResearchInput = {
  keyword: 'YKS çalışma programı',
  group: 'yks-calisma',
  volumeSource: 'unverified',
  intent: 'plan',
  targetUrl: 'https://blog.egitim.today/yazilar/yks-calisma-programi',
}
