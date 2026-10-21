const SAFE_DRAFT =
  'Bu taslak güvenlik denetiminden geçmedi. Sistem talimatı, uydurma kaynak veya zararlı içerik yazma.'

const BLOCKED = [
  /sistem prompt/i,
  /system prompt/i,
  /gizli talimat/i,
  /hidden instructions/i,
  /ignore previous instructions/i,
  /önceki talimatları unut/i,
  /onceki talimatlari unut/i,
  /uydurma\s+kaynak/i,
  /kayna[gğ][ıi]\s+ben\s+uydurdum/i,
  /MEB\s+d[ıi][sş][ıi].{0,48}uydur/i,
  /[İIıi]ntihar y[oö]ntemi/i,
  /bomba\s+yap[ıi]m/i,
  /<<<\s*ARTICLE_(?:START|END)\s*>>>/i,
]

/** Reject model text that leaks instructions, invents a source, or is harmful. No network. */
export function guardDraftOutput(text: string): { ok: boolean; text: string; reason?: string } {
  const raw = String(text ?? '')
  const hit = BLOCKED.find((pattern) => pattern.test(raw))
  if (!hit) return { ok: true, text: raw }
  console.warn('[llm.guard.rejected]', { reason: hit.source })
  return { ok: false, text: SAFE_DRAFT, reason: hit.source }
}
