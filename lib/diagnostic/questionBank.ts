/**
 * CS-STU-01 diagnostic question bank on ContentSource (category=diagnostic-question).
 * LearnCon runtime stays in learncon; this repo owns authoring + export contract.
 */

export const DIAGNOSTIC_CATEGORY = 'diagnostic-question' as const

export const EXAM_TYPES = ['TYT', 'AYT', 'LGS', 'OKUL'] as const
export type DiagnosticExamType = (typeof EXAM_TYPES)[number]

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export type DiagnosticDifficulty = (typeof DIFFICULTIES)[number]

export const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'] as const
export type OptionKey = (typeof OPTION_KEYS)[number]

export type DiagnosticOption = {
  key: OptionKey
  text: string
  /** Wrong-choice misconception; required for distractors, null for the correct key. */
  misconception: string | null
}

export type DiagnosticQuestionInput = {
  slug: string
  examType: DiagnosticExamType
  topic: string
  difficulty: DiagnosticDifficulty
  stem: string
  options: DiagnosticOption[]
  correctKey: OptionKey
  explanation: string
  /** LearnCon curriculum_tree_nodes.learning_outcome_code */
  learningOutcomeCode: string
  /** Optional prerequisite code (e.g. üslü → logaritma story). */
  prerequisiteCode?: string | null
}

export type DiagnosticQuestionRecord = DiagnosticQuestionInput & {
  version: 1
  kind: 'diagnostic-question'
}

export type DiagnosticSourceDraft = {
  title: string
  category: typeof DIAGNOSTIC_CATEGORY
  tags: string[]
  content: string
}

/** LEARNCON-STU-02 / curriculum_exam_questions-shaped export row (no exam_id yet). */
export type LearnConQuestionExport = {
  learning_outcome_code: string
  question_type: 'multiple_choice'
  question_text: string
  options: { key: string; text: string }[]
  correct_answer: { key: string }
  explanation: string
  difficulty_level: DiagnosticDifficulty
  metadata: {
    source: 'content-studio'
    contract: 'LEARNCON-STU-02'
    exam_type: DiagnosticExamType
    topic: string
    slug: string
    misconceptions: Record<string, string>
    prerequisite_code: string | null
  }
}

function trimRequired(label: string, value: string): string {
  const v = value.trim()
  if (!v) throw new Error(`${label} gerekli`)
  return v
}

export function validateDiagnosticQuestion(input: DiagnosticQuestionInput): DiagnosticQuestionRecord {
  const slug = trimRequired('slug', input.slug)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('slug yalnızca küçük harf, rakam ve tire olmalı')
  }
  if (!EXAM_TYPES.includes(input.examType)) {
    throw new Error('examType geçersiz')
  }
  if (!DIFFICULTIES.includes(input.difficulty)) {
    throw new Error('difficulty geçersiz')
  }
  const topic = trimRequired('topic', input.topic)
  const stem = trimRequired('stem', input.stem)
  const explanation = trimRequired('explanation', input.explanation)
  const learningOutcomeCode = trimRequired('learningOutcomeCode', input.learningOutcomeCode)
  // LearnCon codes may include Turkish letters (e.g. İTA.8.1.1.).
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._:-]*$/u.test(learningOutcomeCode)) {
    throw new Error('learningOutcomeCode geçersiz')
  }

  if (!Array.isArray(input.options) || input.options.length < 4 || input.options.length > 5) {
    throw new Error('4 veya 5 şık gerekli')
  }

  const seen = new Set<string>()
  const options: DiagnosticOption[] = input.options.map((opt, i) => {
    const key = opt.key
    if (!OPTION_KEYS.includes(key)) throw new Error(`şık ${i + 1}: key geçersiz`)
    if (seen.has(key)) throw new Error(`şık ${key} tekrar`)
    seen.add(key)
    const text = trimRequired(`şık ${key}`, opt.text)
    if (key === input.correctKey) {
      if (opt.misconception != null && String(opt.misconception).trim()) {
        throw new Error(`doğru şık ${key} için misconception olmamalı`)
      }
      return { key, text, misconception: null }
    }
    const misconception = trimRequired(`şık ${key} misconception`, String(opt.misconception ?? ''))
    return { key, text, misconception }
  })

  if (!seen.has(input.correctKey)) {
    throw new Error('correctKey şıklar arasında yok')
  }

  const prerequisiteCode =
    input.prerequisiteCode == null || !String(input.prerequisiteCode).trim()
      ? null
      : trimRequired('prerequisiteCode', String(input.prerequisiteCode))

  return {
    version: 1,
    kind: 'diagnostic-question',
    slug,
    examType: input.examType,
    topic,
    difficulty: input.difficulty,
    stem,
    options,
    correctKey: input.correctKey,
    explanation,
    learningOutcomeCode,
    prerequisiteCode,
  }
}

export function buildDiagnosticSource(input: DiagnosticQuestionInput): DiagnosticSourceDraft {
  const record = validateDiagnosticQuestion(input)
  return {
    title: `[${record.examType}] ${record.topic} — ${record.slug}`,
    category: DIAGNOSTIC_CATEGORY,
    tags: [
      `exam:${record.examType}`,
      `difficulty:${record.difficulty}`,
      `outcome:${record.learningOutcomeCode}`,
      `slug:${record.slug}`,
      'cs-stu-01',
    ],
    content: JSON.stringify(record, null, 2),
  }
}

export function readDiagnosticQuestion(content: string): DiagnosticQuestionRecord {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    throw new Error('diagnostic content JSON değil')
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('diagnostic content nesne değil')
  }
  const row = raw as Record<string, unknown>
  return validateDiagnosticQuestion({
    slug: String(row.slug ?? ''),
    examType: row.examType as DiagnosticExamType,
    topic: String(row.topic ?? ''),
    difficulty: row.difficulty as DiagnosticDifficulty,
    stem: String(row.stem ?? ''),
    options: (Array.isArray(row.options) ? row.options : []) as DiagnosticOption[],
    correctKey: row.correctKey as OptionKey,
    explanation: String(row.explanation ?? ''),
    learningOutcomeCode: String(row.learningOutcomeCode ?? ''),
    prerequisiteCode:
      row.prerequisiteCode == null ? null : String(row.prerequisiteCode),
  })
}

export function toLearnConExport(record: DiagnosticQuestionRecord): LearnConQuestionExport {
  const misconceptions: Record<string, string> = {}
  for (const opt of record.options) {
    if (opt.misconception) misconceptions[opt.key] = opt.misconception
  }
  return {
    learning_outcome_code: record.learningOutcomeCode,
    question_type: 'multiple_choice',
    question_text: record.stem,
    options: record.options.map((o) => ({ key: o.key, text: o.text })),
    correct_answer: { key: record.correctKey },
    explanation: record.explanation,
    difficulty_level: record.difficulty,
    metadata: {
      source: 'content-studio',
      contract: 'LEARNCON-STU-02',
      exam_type: record.examType,
      topic: record.topic,
      slug: record.slug,
      misconceptions,
      prerequisite_code: record.prerequisiteCode ?? null,
    },
  }
}
