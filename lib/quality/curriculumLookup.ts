import type { CurriculumCodeLookup } from './learningObjective'

const UNAVAILABLE =
  'Kazanım kodu doğrulanamadı: LearnCon curriculum salt okunur bağlantısı yok'

function lookupConfig(): { url: string; key: string } | null {
  const url = process.env.LEARNCON_SUPABASE_URL?.trim().replace(/\/$/, '')
  const key = process.env.LEARNCON_SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return { url, key }
}

/**
 * Read-only check against LearnCon `curriculum_tree_nodes.learning_outcome_code`.
 * GET only. Inactive rows do not count.
 */
export async function hasActiveCurriculumCode(code: string): Promise<boolean> {
  const cfg = lookupConfig()
  if (!cfg) throw new Error(UNAVAILABLE)

  const params = new URLSearchParams()
  params.set('select', 'id')
  params.set('limit', '1')
  params.set('is_active', 'eq.true')
  params.set('learning_outcome_code', `eq.${code.trim()}`)

  const res = await fetch(`${cfg.url}/rest/v1/curriculum_tree_nodes?${params.toString()}`, {
    method: 'GET',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    throw new Error(`Kazanım kodu doğrulanamadı: curriculum_tree_nodes HTTP ${res.status}`)
  }

  const rows = (await res.json()) as unknown
  if (Array.isArray(rows) && rows.length > 0) return true

  const upper = code.trim().toUpperCase()
  if (upper === code.trim()) return false

  params.set('learning_outcome_code', `eq.${upper}`)
  const retry = await fetch(`${cfg.url}/rest/v1/curriculum_tree_nodes?${params.toString()}`, {
    method: 'GET',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!retry.ok) {
    throw new Error(`Kazanım kodu doğrulanamadı: curriculum_tree_nodes HTTP ${retry.status}`)
  }
  const retryRows = (await retry.json()) as unknown
  return Array.isArray(retryRows) && retryRows.length > 0
}

export const learnconCurriculumLookup: CurriculumCodeLookup = {
  hasActiveCode: hasActiveCurriculumCode,
}
