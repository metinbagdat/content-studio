/**
 *   npx tsx lib/quality/scoreDraft.selftest.ts
 */
import assert from 'node:assert/strict'
import { evaluateDraft, readQualityReport, withQualityMetadata } from './scoreDraft'

const longBody = 'Planlama bilinci '.repeat(40)
const meta = { learningObjective: { code: 'MAT.9.1.1' } }

const weak = evaluateDraft({
  title: 'Kısa',
  content: 'az',
  contentType: 'BLOG_POST',
  metadata: {},
  threshold: 70,
  autoAdvance: true,
  now: new Date('2026-10-13T00:00:00.000Z'),
})
assert.equal(weak.status, 'IN_REVIEW')
assert.equal(weak.report.passed, false)
assert.ok(weak.report.score < 70)
assert.ok(weak.report.reasons.some((r) => r.includes('Kazanım bağlantısı yok')))

const readyHeld = evaluateDraft({
  title: 'Zamanı zafere dönüştürmek',
  content: longBody,
  contentType: 'VIDEO_SCRIPT',
  metadata: meta,
  threshold: 70,
  autoAdvance: false,
})
assert.equal(readyHeld.report.passed, true)
assert.equal(readyHeld.report.score, 100)
assert.equal(readyHeld.status, 'IN_REVIEW')

const readyGo = evaluateDraft({
  title: 'Zamanı zafere dönüştürmek',
  content: longBody,
  contentType: 'VIDEO_SCRIPT',
  metadata: meta,
  threshold: 70,
  autoAdvance: true,
  judgeScore: 80,
})
assert.equal(readyGo.status, 'APPROVED')
assert.equal(readyGo.report.judge, 'llm')
assert.ok(readyGo.report.reasons.some((r) => r.includes('LLM hakem')))

const stored = readQualityReport(withQualityMetadata({ platform: 'YOUTUBE' }, readyHeld.report))
assert.equal(stored?.score, 100)
assert.equal(stored?.passed, true)
assert.equal(readQualityReport(null), null)

console.log('scoreDraft.selftest: ok')
