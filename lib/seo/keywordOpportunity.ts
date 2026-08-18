import {
  bestVolumeRow,
  dataForSeoConfigured,
  fetchDataForSeoSearchVolume,
  hpvFromSearchVolume,
} from './dataForSeo'
import { fetchGscQueries, gscBoostForTitle, gscConfigured } from './gscQueries'

export const HPV_MIN = 75
export const VOLUME_MIN = 500

export type KeywordMetrics = {
  keyword: string
  hpv: number
  volume: number
  source: 'api' | 'fallback' | 'none'
}

export type TopicOpportunity = KeywordMetrics & {
  wpCandidate: boolean
  reason: string
}

/** Education-topic fallback when DataForSEO / GSC API is not configured. Not Soro. */
export const FALLBACK_KEYWORDS: Array<{ keyword: string; hpv: number; volume: number }> = [
  { keyword: 'tyt', hpv: 88, volume: 12000 },
  { keyword: 'ayt', hpv: 86, volume: 9000 },
  { keyword: 'lgs', hpv: 84, volume: 8000 },
  { keyword: 'yks', hpv: 85, volume: 7000 },
  { keyword: 'tyt matematik', hpv: 90, volume: 6500 },
  { keyword: 'ayt matematik', hpv: 89, volume: 5200 },
  { keyword: 'tyt turkce', hpv: 82, volume: 4100 },
  { keyword: 'calisma teknikleri', hpv: 80, volume: 2400 },
  { keyword: 'nasil calisilir', hpv: 78, volume: 1800 },
  { keyword: 'motivasyon', hpv: 76, volume: 3200 },
  { keyword: 'universite tercih', hpv: 81, volume: 2700 },
  { keyword: 'tercih robotu', hpv: 79, volume: 1600 },
  { keyword: 'yks puan hesaplama', hpv: 83, volume: 3500 },
  { keyword: 'deneme sinavi', hpv: 77, volume: 2100 },
  { keyword: 'pomodoro', hpv: 74, volume: 1900 },
  { keyword: 'zaman yonetimi', hpv: 73, volume: 1400 },
  { keyword: 'not tutma', hpv: 72, volume: 1100 },
  { keyword: 'ezber', hpv: 70, volume: 900 },
  { keyword: 'odaklanma', hpv: 71, volume: 800 },
  { keyword: 'stres yonetimi', hpv: 68, volume: 700 },
]

function fold(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function keywordCandidatesFromTitle(title: string): string[] {
  const hay = ` ${fold(title)} `
  const hits = FALLBACK_KEYWORDS.map((row) => row.keyword)
    .filter((kw) => {
      const needle = fold(kw)
      return needle && (hay.includes(` ${needle} `) || hay.includes(needle))
    })
    .sort((a, b) => b.length - a.length)
  const phrase = fold(title).slice(0, 80)
  const out = [...hits]
  if (phrase && !out.includes(phrase)) out.push(phrase)
  return out.slice(0, 8)
}

function matchFallback(text: string): KeywordMetrics | null {
  const hay = ` ${fold(text)} `
  let best: KeywordMetrics | null = null
  for (const row of FALLBACK_KEYWORDS) {
    const needle = fold(row.keyword)
    if (!needle) continue
    if (!hay.includes(` ${needle} `) && !hay.includes(needle)) continue
    const score = { keyword: row.keyword, hpv: row.hpv, volume: row.volume, source: 'fallback' as const }
    if (!best || score.hpv > best.hpv || (score.hpv === best.hpv && score.volume > best.volume)) {
      best = score
    }
  }
  return best
}

async function fetchFromGenericSeoApi(text: string): Promise<KeywordMetrics | null> {
  const base = (process.env.SEO_API_BASE_URL || '').replace(/\/$/, '')
  const key = process.env.SEO_API_KEY?.trim() || ''
  if (!base || !key || dataForSeoConfigured()) return null

  try {
    const q = encodeURIComponent(text.slice(0, 180))
    const res = await fetch(`${base}/keywords?q=${q}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const data = (await res.json().catch(() => ({}))) as {
      keyword?: string
      hpv?: number
      volume?: number
      search_volume?: number
    }
    const hpv = Number(data.hpv)
    const volume = Number(data.volume ?? data.search_volume)
    if (!Number.isFinite(hpv) || !Number.isFinite(volume)) return null
    return {
      keyword: String(data.keyword || text).slice(0, 80),
      hpv,
      volume,
      source: 'api',
    }
  } catch (err) {
    console.warn('[seo] API lookup failed, using fallback', err)
    return null
  }
}

async function fetchFromDataForSeo(title: string): Promise<KeywordMetrics | null> {
  if (!dataForSeoConfigured()) return null
  const rows = await fetchDataForSeoSearchVolume(keywordCandidatesFromTitle(title))
  const best = bestVolumeRow(rows)
  if (!best) return null
  return {
    keyword: best.keyword,
    volume: best.volume,
    hpv: hpvFromSearchVolume(best.volume, best.competitionIndex),
    source: 'api',
  }
}

async function applyGscBoost(title: string, metrics: KeywordMetrics): Promise<KeywordMetrics> {
  if (!gscConfigured()) return metrics
  const rows = await fetchGscQueries(80)
  const hit = gscBoostForTitle(title, rows)
  if (!hit || hit.impressions < 10) return metrics
  return {
    ...metrics,
    source: 'api',
    hpv: Math.min(100, Math.max(metrics.hpv, 78)),
    volume: Math.max(metrics.volume, hit.impressions),
    keyword: metrics.keyword || hit.query,
  }
}

export function isWpCandidate(hpv: number, volume: number): boolean {
  return hpv >= HPV_MIN && volume >= VOLUME_MIN
}

/** Score a title/topic for WP vs SM-only routing (CS-WP-03). */
export async function scoreTopicOpportunity(title: string): Promise<TopicOpportunity> {
  const text = title.trim()
  const fromApi =
    (await fetchFromDataForSeo(text)) || (await fetchFromGenericSeoApi(text))
  let metrics =
    fromApi ||
    matchFallback(text) || {
      keyword: text.slice(0, 80) || '(bos)',
      hpv: 0,
      volume: 0,
      source: 'none' as const,
    }

  if (metrics.source !== 'none') {
    metrics = await applyGscBoost(text, metrics)
  }

  const wpCandidate = isWpCandidate(metrics.hpv, metrics.volume)
  const reason = wpCandidate
    ? `WP adayı: HPV ${metrics.hpv} ≥ ${HPV_MIN}, volume ${metrics.volume} ≥ ${VOLUME_MIN} (${metrics.source}: ${metrics.keyword})`
    : `Yalnız SM: HPV ${metrics.hpv} / volume ${metrics.volume} (eşik ${HPV_MIN}/${VOLUME_MIN}; ${metrics.source})`

  return { ...metrics, wpCandidate, reason }
}
