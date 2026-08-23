import type { PlatformId } from '@content-studio/core/platforms/targets'
import { DEFAULT_PIPELINE_PLATFORMS } from '@content-studio/core/platforms/targets'

export const AUDIENCE_SEGMENTS = ['tyt', 'ayt', 'lgs', 'veli', 'egitimci', 'genel'] as const
export type AudienceSegment = (typeof AUDIENCE_SEGMENTS)[number]

export const SEGMENT_LABELS: Record<AudienceSegment, string> = {
  tyt: 'TYT',
  ayt: 'AYT',
  lgs: 'LGS',
  veli: 'Veli',
  egitimci: 'Eğitimci',
  genel: 'Genel',
}

const TAG_PREFIX = 'seg:'

export function segmentTag(segment: AudienceSegment): string {
  return `${TAG_PREFIX}${segment}`
}

export function parseSegmentFromTags(tags: string[] | undefined | null): AudienceSegment | null {
  for (const raw of tags || []) {
    const t = raw.toLowerCase()
    if (!t.startsWith(TAG_PREFIX)) continue
    const id = t.slice(TAG_PREFIX.length) as AudienceSegment
    if ((AUDIENCE_SEGMENTS as readonly string[]).includes(id)) return id
  }
  return null
}

export function withSegmentTag(tags: string[] | undefined | null, segment: AudienceSegment): string[] {
  const next = (tags || []).filter((t) => !t.toLowerCase().startsWith(TAG_PREFIX))
  next.push(segmentTag(segment))
  return next
}

function fold(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

/** Rule-based audience from title/body/tags (CS-SM-01). */
export function detectAudienceSegment(text: string, tags?: string[] | null): AudienceSegment {
  const fromTags = parseSegmentFromTags(tags)
  if (fromTags) return fromTags

  const hay = fold(`${text}\n${(tags || []).join(' ')}`)

  if (/\blgs\b|ortaokul|8\.\s*sinif|sekizinci sinif/.test(hay)) return 'lgs'
  if (/\bayt\b|\bydt\b|12\.\s*sinif|alan sinavi|sayisal ayt|esit agirlik/.test(hay)) return 'ayt'
  if (/\btyt\b|11\.\s*sinif|temel yeterlilik/.test(hay)) return 'tyt'
  if (/\bveli\b|ebeveyn|anne baba|cocugum|veliler/.test(hay)) return 'veli'
  if (/ogretmen|egitimci|rehber ogretmen|sinif ogretmeni/.test(hay)) return 'egitimci'
  if (/\byks\b|universite sinav/.test(hay)) return 'tyt'
  return 'genel'
}

export function segmentHashtags(segment: AudienceSegment): string[] {
  switch (segment) {
    case 'tyt':
      return ['#TYT', '#YKS', '#egitimtoday']
    case 'ayt':
      return ['#AYT', '#YKS', '#egitimtoday']
    case 'lgs':
      return ['#LGS', '#ortaokul', '#egitimtoday']
    case 'veli':
      return ['#veli', '#egitim', '#egitimtoday']
    case 'egitimci':
      return ['#ogretmen', '#egitim', '#egitimtoday']
    default:
      return ['#egitim', '#egitimtoday', '#ogrenme']
  }
}

export function segmentCtaHint(segment: AudienceSegment): string {
  switch (segment) {
    case 'tyt':
    case 'ayt':
    case 'lgs':
      return 'Sınav hazırlığı için egitim.today'
    case 'veli':
      return 'Çocuğunuzun çalışma planı: egitim.today'
    case 'egitimci':
      return 'Sınıf ve rehberlik kaynakları: egitim.today'
    default:
      return 'egitim.today'
  }
}

/** Preferred platform order — does not drop platforms, only reorders. */
export function platformsForSegment(segment: AudienceSegment): PlatformId[] {
  const order: Record<AudienceSegment, PlatformId[]> = {
    tyt: ['TWITTER', 'TIKTOK', 'INSTAGRAM', 'YOUTUBE', 'FACEBOOK', 'LINKEDIN'],
    ayt: ['YOUTUBE', 'LINKEDIN', 'TWITTER', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK'],
    lgs: ['TIKTOK', 'INSTAGRAM', 'YOUTUBE', 'FACEBOOK', 'TWITTER', 'LINKEDIN'],
    veli: ['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'TWITTER', 'TIKTOK'],
    egitimci: ['LINKEDIN', 'FACEBOOK', 'TWITTER', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK'],
    genel: [...DEFAULT_PIPELINE_PLATFORMS],
  }
  return order[segment]
}

export function appendSegmentHashtags(content: string, segment: AudienceSegment): string {
  const tags = segmentHashtags(segment)
  const lower = content.toLowerCase()
  const missing = tags.filter((t) => !lower.includes(t.toLowerCase()))
  if (!missing.length) return content
  return `${content.trim()}\n\n${missing.join(' ')}`
}

export function isAudienceSegment(value: unknown): value is AudienceSegment {
  return typeof value === 'string' && (AUDIENCE_SEGMENTS as readonly string[]).includes(value)
}
