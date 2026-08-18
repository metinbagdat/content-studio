export type SearchVolumeRow = {
  keyword: string
  volume: number
  competitionIndex: number | null
}

const DATAFORSEO_VOLUME_URL =
  'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live'

/** Turkey — Google Ads location_code. */
export const DATAFORSEO_LOCATION_TR = 2792

function dataForSeoAuth(): string | null {
  const login = (process.env.DATAFORSEO_LOGIN || process.env.SEO_API_KEY || '').trim()
  const password = (process.env.DATAFORSEO_PASSWORD || process.env.SEO_API_PASSWORD || '').trim()
  if (!login || !password) return null
  return Buffer.from(`${login}:${password}`).toString('base64')
}

export function dataForSeoConfigured(): boolean {
  return Boolean(dataForSeoAuth())
}

/** Map search volume (+ optional Google Ads competition 0–100) to CS HPV 0–100. */
export function hpvFromSearchVolume(volume: number, competitionIndex?: number | null): number {
  const v = Math.max(0, volume)
  const volScore = Math.min(100, Math.max(0, 30 + Math.log10(v + 1) * 16))
  if (competitionIndex == null || !Number.isFinite(competitionIndex)) {
    return Math.round(volScore)
  }
  const crowding = Math.min(100, Math.max(0, competitionIndex))
  return Math.round(Math.min(100, Math.max(0, volScore * 0.85 + (100 - crowding) * 0.15)))
}

type DataForSeoTask = {
  result?: Array<{
    keyword?: string
    search_volume?: number | null
    competition_index?: number | null
  }>
}

/**
 * Live Google Ads search volume for Turkey (tr).
 * Docs: https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live
 */
export async function fetchDataForSeoSearchVolume(
  keywords: string[],
): Promise<SearchVolumeRow[]> {
  const auth = dataForSeoAuth()
  if (!auth) return []

  const unique = [...new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 10)
  if (!unique.length) return []

  try {
    const res = await fetch(DATAFORSEO_VOLUME_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify([
        {
          keywords: unique,
          location_code: DATAFORSEO_LOCATION_TR,
          language_code: 'tr',
        },
      ]),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) {
      console.warn('[seo] DataForSEO HTTP', res.status)
      return []
    }
    const data = (await res.json().catch(() => ({}))) as { tasks?: DataForSeoTask[] }
    const rows = data.tasks?.[0]?.result || []
    return rows
      .map((row) => {
        const keyword = String(row.keyword || '').trim()
        const volume = Number(row.search_volume)
        if (!keyword || !Number.isFinite(volume) || volume < 0) return null
        const competitionIndex = Number(row.competition_index)
        return {
          keyword,
          volume,
          competitionIndex: Number.isFinite(competitionIndex) ? competitionIndex : null,
        }
      })
      .filter((r): r is SearchVolumeRow => r !== null)
  } catch (err) {
    console.warn('[seo] DataForSEO lookup failed', err)
    return []
  }
}

export function bestVolumeRow(rows: SearchVolumeRow[]): SearchVolumeRow | null {
  if (!rows.length) return null
  return rows.reduce((a, b) => (b.volume > a.volume ? b : a))
}
