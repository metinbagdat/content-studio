/**
 *   npx tsx lib/audience/resolveAudienceSegment.selftest.ts
 */
import assert from 'node:assert/strict'
import { detectAudienceSegment } from './segments'
import { resolveAudienceSegment } from './resolveAudienceSegment'

assert.equal(detectAudienceSegment('LGS 6 ay çalışma planı'), 'lgs')
assert.equal(detectAudienceSegment('AYT matematik stratejileri'), 'ayt')
assert.equal(detectAudienceSegment('TYT paragraf'), 'tyt')
assert.equal(detectAudienceSegment('Veliler için çalışma rutini'), 'veli')
assert.equal(detectAudienceSegment('Öğretmen sınıf yönetimi'), 'egitimci')
assert.equal(detectAudienceSegment('Zaman yönetimi ipuçları'), 'genel')
assert.equal(detectAudienceSegment('x', ['seg:ayt']), 'ayt')

async function main() {
  const tagged = await resolveAudienceSegment('belirsiz metin', ['seg:lgs'])
  assert.equal(tagged.segment, 'lgs')
  assert.equal(tagged.source, 'tag')

  const ruled = await resolveAudienceSegment('TYT matematik 90 almak')
  assert.equal(ruled.segment, 'tyt')
  assert.equal(ruled.source, 'rules')

  // Without LLM keys → genel fallback; with keys may return llm — both ok if not crash
  const ambiguous = await resolveAudienceSegment(
    'Öğrenme alışkanlıkları ve odaklanma üzerine kısa bir rehber. Günlük rutin, molalar ve hedef koyma.',
  )
  assert.ok(['genel', 'tyt', 'ayt', 'lgs', 'veli', 'egitimci'].includes(ambiguous.segment))
  assert.ok(['fallback', 'llm', 'rules'].includes(ambiguous.source))

  console.log('resolveAudienceSegment.selftest: ok', { ambiguous })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
