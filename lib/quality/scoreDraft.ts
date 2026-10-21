import { lintDraft } from './contentLint'
import { readLearningObjective, rawLearningObjectivePresent } from './learningObjective'

export type QualityReport = {
  score: number
  threshold: number
  passed: boolean
  reasons: string[]
  judge: 'rules' | 'llm'
  at: string
}

export type DraftStatusAfterScore = 'IN_REVIEW' | 'APPROVED'

const DEFAULT_THRESHOLD = 70
const MISSING_OBJECTIVE_PENALTY = 45

export function qualityScoreThreshold(): number {
  const raw = Number(process.env.QUALITY_SCORE_THRESHOLD)
  if (!Number.isFinite(raw)) return DEFAULT_THRESHOLD
  return Math.max(0, Math.min(100, Math.round(raw)))
}

/** Auto-approve only after the owner turns this on. Default keeps every draft in review. */
export function qualityAutoAdvanceEnabled(): boolean {
  return process.env.QUALITY_AUTO_ADVANCE === 'true'
}

export function evaluateDraft(input: {
  title: string
  content: string
  contentType: string
  metadata: unknown
  threshold?: number
  autoAdvance?: boolean
  judgeScore?: number | null
  judgeMode?: QualityReport['judge']
  pedagogy?: { rejected: boolean; reasons: string[] }
  now?: Date
}): { report: QualityReport; status: DraftStatusAfterScore } {
  const threshold = input.threshold ?? DEFAULT_THRESHOLD
  const findings = lintDraft(input)
  let score = 100
  const reasons = findings.map((f) => {
    score -= f.penalty
    return f.reason
  })

  const objective = readLearningObjective(input.metadata)
  if (!objective) {
    score -= MISSING_OBJECTIVE_PENALTY
    reasons.push(
      rawLearningObjectivePresent(input.metadata)
        ? 'Kazanım kodu geçersiz'
        : 'Kazanım bağlantısı yok',
    )
  }

  let judge: QualityReport['judge'] = input.judgeMode ?? 'rules'
  if (typeof input.judgeScore === 'number' && Number.isFinite(input.judgeScore)) {
    const judgeScore = Math.max(0, Math.min(100, Math.round(input.judgeScore)))
    score = Math.round(score * 0.7 + judgeScore * 0.3)
    reasons.push(`LLM hakem skoru ${judgeScore}`)
    judge = 'llm'
  }

  score = Math.max(0, Math.min(100, score))
  let passed = score >= threshold && objective != null
  if (input.pedagogy?.rejected) {
    passed = false
    for (const reason of input.pedagogy.reasons) reasons.push(reason)
  }
  if (reasons.length === 0) {
    reasons.push('Biçim, içerik ve kazanım kontrolleri geçti')
  }

  const report: QualityReport = {
    score,
    threshold,
    passed,
    reasons,
    judge,
    at: (input.now ?? new Date()).toISOString(),
  }
  const autoAdvance = input.autoAdvance === true
  const status: DraftStatusAfterScore = passed && autoAdvance ? 'APPROVED' : 'IN_REVIEW'
  return { report, status }
}

export function withQualityMetadata(metadata: unknown, report: QualityReport): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {}
  base.quality = report
  return base
}

export function readQualityReport(metadata: unknown): QualityReport | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const quality = (metadata as Record<string, unknown>).quality
  if (!quality || typeof quality !== 'object' || Array.isArray(quality)) return null
  const row = quality as Record<string, unknown>
  if (typeof row.score !== 'number' || typeof row.threshold !== 'number') return null
  const reasons = Array.isArray(row.reasons) ? row.reasons.filter((r): r is string => typeof r === 'string') : []
  return {
    score: row.score,
    threshold: row.threshold,
    passed: row.passed === true,
    reasons,
    judge: row.judge === 'llm' ? 'llm' : 'rules',
    at: typeof row.at === 'string' ? row.at : '',
  }
}
