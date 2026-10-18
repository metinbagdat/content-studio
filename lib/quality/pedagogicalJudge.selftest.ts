/**
 *   npx tsx lib/quality/pedagogicalJudge.selftest.ts
 * Fixture judge only. This file does not call Groq or OpenAI.
 */
import assert from 'node:assert/strict'
import { evaluateDraft } from './scoreDraft'
import {
  applyPedagogicalJudge,
  resetJudgeBudget,
  screenDraftLocal,
} from './pedagogicalJudge'

async function main() {
const prev = process.env.QUALITY_LLM_JUDGE
process.env.QUALITY_LLM_JUDGE = '0'
resetJudgeBudget()

const rude = screenDraftLocal('Bu kadar basit soruyu salak olan da anlar.', {})
assert.equal(rude.allow, false)
assert.ok(rude.reasons.includes('tone'))

const age = screenDraftLocal('AYT matematik planı burada.', { segment: 'lgs' })
assert.ok(age.reasons.includes('age_mismatch'))

const sourced = screenDraftLocal('Araştırmalar gösteriyor ki tekrar işe yarar. Kaynak: MEB bülteni.', {
  segment: 'tyt',
})
assert.equal(sourced.allow, true)

const unsourced = screenDraftLocal('Araştırmalar gösteriyor ki bu yöntem netleri ikiye katlar.', {})
assert.ok(unsourced.reasons.includes('missing_source'))

const off = screenDraftLocal('Bu anlatım kazanım FEN.1.1 ile sınırlıdır.', {
  learningObjective: { code: 'MAT.9.1.1' },
})
assert.ok(off.reasons.includes('off_curriculum_claim'))

let calls = 0
const localReject = await applyPedagogicalJudge({
  title: 'Ton',
  content: 'salak bir anlatım',
  metadata: {},
  runJudge: async () => {
    calls += 1
    return { allow: true, reasons: [] }
  },
})
assert.equal(localReject.rejected, true)
assert.equal(localReject.stage, 'local')
assert.equal(calls, 0)

resetJudgeBudget()
calls = 0
const cheapReject = await applyPedagogicalJudge({
  title: 'Temiz başlık yeterli uzunlukta',
  content: 'Planlama bilinci '.repeat(20),
  metadata: { learningObjective: { code: 'MAT.9.1.1' } },
  dailyCap: 1,
  now: new Date('2026-10-14T12:00:00.000Z'),
  runJudge: async () => {
    calls += 1
    return { allow: false, reasons: ['tone'] }
  },
})
assert.equal(calls, 1)
assert.equal(cheapReject.rejected, true)
assert.equal(cheapReject.stage, 'cheap')
assert.ok(cheapReject.reasons.includes('Ton yaş grubuna uygun değil'))

const skipped = await applyPedagogicalJudge({
  title: 'Temiz başlık yeterli uzunlukta',
  content: 'Planlama bilinci '.repeat(20),
  metadata: { learningObjective: { code: 'MAT.9.1.1' } },
  dailyCap: 1,
  now: new Date('2026-10-14T12:00:00.000Z'),
  runJudge: async () => {
    calls += 1
    return { allow: false, reasons: ['tone'] }
  },
})
assert.equal(skipped.stage, 'budget_skip')
assert.equal(skipped.rejected, false)
assert.equal(calls, 1)

const held = evaluateDraft({
  title: 'Zamanı zafere dönüştürmek',
  content: 'Planlama bilinci '.repeat(40),
  contentType: 'VIDEO_SCRIPT',
  metadata: { learningObjective: { code: 'MAT.9.1.1' } },
  threshold: 70,
  autoAdvance: true,
  pedagogy: { rejected: true, reasons: ['Ton yaş grubuna uygun değil'] },
})
assert.equal(held.status, 'IN_REVIEW')
assert.equal(held.report.passed, false)
assert.ok(held.report.reasons.includes('Ton yaş grubuna uygun değil'))

if (prev == null) delete process.env.QUALITY_LLM_JUDGE
else process.env.QUALITY_LLM_JUDGE = prev

console.log('pedagogicalJudge.selftest: ok')
}

main()
