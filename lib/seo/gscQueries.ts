/**
 * Optional Search Console overlay. Needs a short-lived OAuth access token
 * (GSC_ACCESS_TOKEN) — not the Rank Math wizard. Skip silently if unset.
 */
export type GscQueryRow = {
  query: string
  impressions: number
  clicks: number
}

export function gscConfigured(): boolean {
  return Boolean(process.env.GSC_ACCESS_TOKEN?.trim() && process.env.GSC_SITE_URL?.trim())
}

export async function fetchGscQueries(limit = 50): Promise<GscQueryRow[]> {
  const token = process.env.GSC_ACCESS_TOKEN?.trim() || ''
  const site = (process.env.GSC_SITE_URL || '').trim()
  if (!token || !site) return []

  const end = new Date()
  const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)
  const encodedSite = encodeURIComponent(site.replace(/\/?$/, '/'))

  try {
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ['query'],
          rowLimit: Math.min(250, Math.max(10, limit)),
        }),
        signal: AbortSignal.timeout(15_000),
      },
    )
    if (!res.ok) {
      console.warn('[seo] GSC HTTP', res.status)
      return []
    }
    const data = (await res.json().catch(() => ({}))) as {
      rows?: Array<{ keys?: string[]; impressions?: number; clicks?: number }>
    }
    return (data.rows || [])
      .map((row) => ({
        query: String(row.keys?.[0] || '').trim(),
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
      }))
      .filter((r) => r.query)
  } catch (err) {
    console.warn('[seo] GSC lookup failed', err)
    return []
  }
}

export function gscBoostForTitle(
  title: string,
  rows: GscQueryRow[],
): { impressions: number; query: string } | null {
  const hay = title.toLocaleLowerCase('tr-TR')
  let best: GscQueryRow | null = null
  for (const row of rows) {
    const q = row.query.toLocaleLowerCase('tr-TR')
    if (q.length < 3) continue
    if (!hay.includes(q) && !q.includes(hay.slice(0, 24))) continue
    if (!best || row.impressions > best.impressions) best = row
  }
  return best ? { impressions: best.impressions, query: best.query } : null
}
