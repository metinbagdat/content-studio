import { z } from 'zod'

/** Canonical kazanım / article_curriculum reference stored on derived metadata. */
export const learningObjectiveSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Kazanım kodu boş')
    .max(80)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, 'Kazanım kodu geçersiz'),
  articleCurriculumId: z.string().trim().min(1).max(80).optional(),
})

export type LearningObjective = z.infer<typeof learningObjectiveSchema>

export const MISSING_LEARNING_OBJECTIVE_REASON =
  'Kazanım bağlantısı yok. Yayın için müfredat kazanım kodu gerekli.'

const METADATA_KEYS = [
  'learningObjective',
  'learning_objective',
  'articleCurriculum',
  'article_curriculum',
] as const

export class LearningObjectiveError extends Error {
  readonly status = 422 as const
  readonly reason: string

  constructor(reason: string) {
    super(reason)
    this.name = 'LearningObjectiveError'
    this.reason = reason
  }
}

export type CurriculumCodeLookup = {
  hasActiveCode(code: string): Promise<boolean>
}

export type LearningObjectivePublishDecision =
  | { ok: true }
  | { ok: false; status: 422; reason: string }

function coerceLearningObjective(raw: unknown): unknown {
  if (typeof raw === 'string') return { code: raw }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  const row = raw as Record<string, unknown>
  const code = row.code ?? row.learning_outcome_code ?? row.learningOutcomeCode
  const articleCurriculumId = row.articleCurriculumId ?? row.article_curriculum_id
  return {
    code,
    ...(typeof articleCurriculumId === 'string' && articleCurriculumId.trim()
      ? { articleCurriculumId }
      : {}),
  }
}

function rawLearningObjective(metadata: unknown): { present: boolean; value: unknown } {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { present: false, value: undefined }
  }
  const rec = metadata as Record<string, unknown>
  for (const key of METADATA_KEYS) {
    if (key in rec && rec[key] != null) return { present: true, value: rec[key] }
  }
  return { present: false, value: undefined }
}

export function rawLearningObjectivePresent(metadata: unknown): boolean {
  return rawLearningObjective(metadata).present
}

/** Read a stored kazanım. Null when the draft has no reference. */
export function readLearningObjective(metadata: unknown): LearningObjective | null {
  const raw = rawLearningObjective(metadata)
  if (!raw.present) return null
  const parsed = learningObjectiveSchema.safeParse(coerceLearningObjective(raw.value))
  return parsed.success ? parsed.data : null
}

/**
 * Keep other metadata keys. When a kazanım alias is present, store the canonical
 * `learningObjective` object. Throws on an invalid shape so a draft save stays 400.
 */
export function normalizeLearningObjectiveMetadata(metadata: unknown): unknown {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return metadata
  const rec = { ...(metadata as Record<string, unknown>) }
  const hasAlias = METADATA_KEYS.some((key) => key in rec)
  if (!hasAlias) return rec

  const raw = rawLearningObjective(rec)
  for (const key of METADATA_KEYS) delete rec[key]
  if (!raw.present) return rec

  const parsed = learningObjectiveSchema.safeParse(coerceLearningObjective(raw.value))
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || 'Kazanım alanı geçersiz')
  }
  rec.learningObjective = parsed.data
  return rec
}

export async function learningObjectivePublishDecision(
  metadata: unknown,
  lookup: CurriculumCodeLookup,
): Promise<LearningObjectivePublishDecision> {
  const raw = rawLearningObjective(metadata)
  if (!raw.present) {
    return { ok: false, status: 422, reason: MISSING_LEARNING_OBJECTIVE_REASON }
  }

  const parsed = learningObjectiveSchema.safeParse(coerceLearningObjective(raw.value))
  if (!parsed.success) {
    return {
      ok: false,
      status: 422,
      reason: parsed.error.issues[0]?.message || 'Kazanım alanı geçersiz',
    }
  }

  try {
    const known = await lookup.hasActiveCode(parsed.data.code)
    if (!known) {
      return {
        ok: false,
        status: 422,
        reason: `Kazanım kodu curriculum_tree_nodes içinde yok: ${parsed.data.code}`,
      }
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 422, reason }
  }

  return { ok: true }
}

export async function assertLearningObjectiveForPublish(
  metadata: unknown,
  lookup: CurriculumCodeLookup,
): Promise<void> {
  const decision = await learningObjectivePublishDecision(metadata, lookup)
  if (!decision.ok) throw new LearningObjectiveError(decision.reason)
}
