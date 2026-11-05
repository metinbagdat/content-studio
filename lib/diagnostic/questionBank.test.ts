import { describe, expect, it } from 'vitest'
import {
  buildDiagnosticSource,
  readDiagnosticQuestion,
  toLearnConExport,
  validateDiagnosticQuestion,
} from './questionBank'
import { DIAGNOSTIC_SEED_QUESTIONS } from './seedBank'

describe('diagnostic question bank (CS-STU-01)', () => {
  it('seeds eight questions across TYT/AYT/LGS/OKUL', () => {
    expect(DIAGNOSTIC_SEED_QUESTIONS).toHaveLength(8)
    const exams = new Set(DIAGNOSTIC_SEED_QUESTIONS.map((q) => q.examType))
    expect(exams).toEqual(new Set(['TYT', 'AYT', 'LGS', 'OKUL']))
  })

  it('validates seed rows and exports LearnCon contract', () => {
    for (const input of DIAGNOSTIC_SEED_QUESTIONS) {
      const draft = buildDiagnosticSource(input)
      expect(draft.category).toBe('diagnostic-question')
      const record = readDiagnosticQuestion(draft.content)
      expect(record.learningOutcomeCode).toBeTruthy()
      const exported = toLearnConExport(record)
      expect(exported.question_type).toBe('multiple_choice')
      expect(exported.correct_answer.key).toBe(record.correctKey)
      expect(exported.metadata.contract).toBe('LEARNCON-STU-02')
      expect(Object.keys(exported.metadata.misconceptions).length).toBe(
        record.options.length - 1,
      )
    }
  })

  it('requires misconception on distractors only', () => {
    const base = DIAGNOSTIC_SEED_QUESTIONS[0]
    expect(() =>
      validateDiagnosticQuestion({
        ...base,
        options: base.options.map((o) =>
          o.key === base.correctKey ? { ...o, misconception: 'yanlış' } : o,
        ),
      }),
    ).toThrow(/misconception olmamalı/i)

    expect(() =>
      validateDiagnosticQuestion({
        ...base,
        options: base.options.map((o) =>
          o.key === base.correctKey ? o : { ...o, misconception: '' },
        ),
      }),
    ).toThrow(/misconception gerekli/i)
  })

  it('keeps logaritma → üstel prerequisite on the hard AYT item', () => {
    const log = DIAGNOSTIC_SEED_QUESTIONS.find((q) => q.slug === 'ayt-logaritma-ustel-iliski')
    expect(log?.prerequisiteCode).toBe('12.1.1.1.')
    expect(log?.learningOutcomeCode).toBe('12.1.2.1.')
  })
})
