import { readLearningObjective } from './learningObjective'

/**
 * Shared rubric with LearnCon #1748 (`lib/aiCoach/llmJudge.js`).
 * The last sentence is the content-studio clause from issue #140.
 */
export const JUDGE_PROMPT = [
  'Sen pedagojik denetmensin. Yalnizca JSON don: {"allow":true|false,"reasons":[]}.',
  'Reddet: yas grubuna uygun olmayan ton, MEB kazanimi disi kesin iddia, soru cevabi sizdirma.',
  'Kabul et: konu anlatimi, ipucu, kazanim kodu baglamla sinirli aciklama.',
  'Ayrica reddet: hedef yas veya sinif disi anlatim, kaynak gostermeyen kesin iddia.',
].join(' ')

const LEAK_PATTERN =
  /(?:do[gğ]ru\s+[sş][ıi]k\s*[:：]?\s*[A-E]\b|cevap\s*(?:anahtar[ıi])?\s*[:：]\s*[A-E]\b|[sş][ıi]k\s*[A-E]\s*(?:do[gğ]ru|cevap))/i
const TONE_PATTERN = /\b(aptal|salak|gerizekal[ıi]|ahmak)\b/i
const OUTCOME_PATTERN = /kazan[ıi]m\s+([A-Z0-9._:-]+)/gi
const UNSOURCED_CLAIM = /ara[sş]t[ıi]rmalar\s+g[oö]steriyor|bilimsel olarak kan[ıi]tlan/i
const SOURCE_MARKER = /https?:\/\/|\bkaynak\b|\bMEB\b/i

const REASON_LABEL: Record<string, string> = {
  answer_leak: 'Soru cevabı sızdırma',
  tone: 'Ton yaş grubuna uygun değil',
  age_mismatch: 'Hedef yaş veya sınıf dışı anlatım',
  off_curriculum_claim: 'MEB kazanımı dışı iddia',
  missing_source: 'Kaynak referansı eksik',
}

const budgetCounts = new Map<string, number>()

export function resetJudgeBudget(): void {
  budgetCounts.clear()
}

export function readJudgeDailyCap(): number {
  const raw = process.env.LLM_JUDGE_DAILY_CAP
  if (raw == null || raw === '') return 20
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 20
}

/** Returns false when today's cheap-judge budget is spent. A non-positive cap disables the limit. */
export function consumeJudgeBudget(now = new Date(), cap = readJudgeDailyCap()): boolean {
  const limit = Number(cap)
  if (!Number.isFinite(limit) || limit <= 0) return true
  const key = now.toISOString().slice(0, 10)
  const used = budgetCounts.get(key) || 0
  if (used >= limit) return false
  budgetCounts.set(key, used + 1)
  return true
}

function segmentOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const segment = (metadata as Record<string, unknown>).segment
  return typeof segment === 'string' ? segment : null
}

export function screenDraftLocal(
  text: string,
  metadata: unknown,
): { allow: boolean; reasons: string[] } {
  const raw = String(text || '')
  const reasons: string[] = []
  if (LEAK_PATTERN.test(raw)) reasons.push('answer_leak')
  if (TONE_PATTERN.test(raw)) reasons.push('tone')

  const segment = segmentOf(metadata)
  if (segment === 'lgs' && /\b(AYT|YKS)\b/.test(raw) && !/\bLGS\b/i.test(raw)) {
    reasons.push('age_mismatch')
  }

  const attached = readLearningObjective(metadata)?.code
  if (attached) {
    const cited: string[] = []
    for (const match of raw.matchAll(OUTCOME_PATTERN)) cited.push(match[1])
    if (cited.some((code) => code !== attached)) reasons.push('off_curriculum_claim')
  }

  if (UNSOURCED_CLAIM.test(raw) && !SOURCE_MARKER.test(raw)) reasons.push('missing_source')

  return { allow: reasons.length === 0, reasons }
}

export function pedagogicalReasonLabels(codes: string[]): string[] {
  return codes.map((code) => REASON_LABEL[code] || code)
}

export type JudgeVerdict = { allow?: boolean; reasons?: string[] }

export type PedagogicalJudgeResult = {
  rejected: boolean
  reasons: string[]
  stage: 'local' | 'cheap' | 'budget_skip' | 'local_pass'
}

function logRejection(reasons: string[], stage: string): void {
  console.warn('[llm.judge.rejected]', { reasons, stage })
}

/**
 * Local screen always runs. The cheap Groq/OpenAI call runs only when
 * QUALITY_LLM_JUDGE=1 and the daily cap still has room. Tests inject `runJudge`.
 */
export async function applyPedagogicalJudge(input: {
  title: string
  content: string
  metadata: unknown
  now?: Date
  dailyCap?: number
  runJudge?: (args: { text: string; prompt: string }) => Promise<JudgeVerdict>
}): Promise<PedagogicalJudgeResult> {
  const text = `${input.title}\n\n${input.content}`
  const local = screenDraftLocal(text, input.metadata)
  if (!local.allow) {
    logRejection(local.reasons, 'local')
    return { rejected: true, reasons: pedagogicalReasonLabels(local.reasons), stage: 'local' }
  }

  const cheapOn = process.env.QUALITY_LLM_JUDGE === '1' || typeof input.runJudge === 'function'
  if (!cheapOn) return { rejected: false, reasons: [], stage: 'local_pass' }

  if (!consumeJudgeBudget(input.now, input.dailyCap)) {
    return { rejected: false, reasons: [], stage: 'budget_skip' }
  }

  const runJudge = input.runJudge
  if (!runJudge) {
    const { resolveLlm } = await import('../ai/llmClient')
    const { client, model } = resolveLlm()
    if (!client) return { rejected: false, reasons: [], stage: 'budget_skip' }
    const res = await client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 120,
      messages: [
        { role: 'system', content: JUDGE_PROMPT },
        { role: 'user', content: text.slice(0, 1500) },
      ],
    })
    return verdictFromModel(parseJudgeContent(res.choices?.[0]?.message?.content || ''))
  }

  return verdictFromModel(await runJudge({ text: text.slice(0, 1500), prompt: JUDGE_PROMPT }))
}

function parseJudgeContent(raw: string): JudgeVerdict {
  try {
    return JSON.parse(raw) as JudgeVerdict
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return { allow: true, reasons: [] }
    try {
      return JSON.parse(match[0]) as JudgeVerdict
    } catch {
      return { allow: true, reasons: [] }
    }
  }
}

function verdictFromModel(verdict: JudgeVerdict): PedagogicalJudgeResult {
  const reasons = Array.isArray(verdict?.reasons) ? verdict.reasons.filter((r) => typeof r === 'string') : []
  if (verdict && verdict.allow === false) {
    const codes = reasons.length ? reasons : ['judge']
    logRejection(codes, 'cheap')
    return { rejected: true, reasons: pedagogicalReasonLabels(codes), stage: 'cheap' }
  }
  return { rejected: false, reasons: [], stage: 'cheap' }
}
