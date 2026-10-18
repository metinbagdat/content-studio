/**
 *   npx tsx lib/quality/learningObjective.selftest.ts
 */
import assert from 'node:assert/strict'
import {
  learningObjectivePublishDecision,
  learningObjectiveSchema,
  normalizeLearningObjectiveMetadata,
  MISSING_LEARNING_OBJECTIVE_REASON,
} from './learningObjective'

async function main() {
  const missing = await learningObjectivePublishDecision({}, { hasActiveCode: async () => true })
  assert.equal(missing.ok, false)
  if (!missing.ok) {
    assert.equal(missing.status, 422)
    assert.equal(missing.reason, MISSING_LEARNING_OBJECTIVE_REASON)
    assert.match(missing.reason, /Kazanım bağlantısı yok/)
  }

  const unknown = await learningObjectivePublishDecision(
    { learningObjective: { code: 'YOK.1' } },
    { hasActiveCode: async () => false },
  )
  assert.equal(unknown.ok, false)
  if (!unknown.ok) {
    assert.equal(unknown.status, 422)
    assert.match(unknown.reason, /curriculum_tree_nodes içinde yok: YOK\.1/)
  }

  const fromArticleCurriculum = await learningObjectivePublishDecision(
    { article_curriculum: { learning_outcome_code: 'MAT.9.1.1' } },
    { hasActiveCode: async (code) => code === 'MAT.9.1.1' },
  )
  assert.equal(fromArticleCurriculum.ok, true)

  const normalized = normalizeLearningObjectiveMetadata({
    article_curriculum: { learning_outcome_code: 'T.8.3.2', article_curriculum_id: 'lc-03' },
    platform: 'YOUTUBE',
  }) as Record<string, unknown>
  assert.deepEqual(normalized.learningObjective, {
    code: 'T.8.3.2',
    articleCurriculumId: 'lc-03',
  })
  assert.equal('article_curriculum' in normalized, false)
  assert.equal(normalized.platform, 'YOUTUBE')

  assert.throws(() => normalizeLearningObjectiveMetadata({ learningObjective: { code: '  ' } }))
  assert.equal(learningObjectiveSchema.parse({ code: 'FEN.5.1' }).code, 'FEN.5.1')

  console.log('learningObjective.selftest: ok')
}

main()
