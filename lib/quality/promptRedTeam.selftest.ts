/**
 *   npx tsx lib/quality/promptRedTeam.selftest.ts
 * Fixture only. Does not call an LLM.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildTransformMessages, TRANSFORM_SYSTEM_PROMPT } from '../ai/transformPrompt'
import { guardDraftOutput } from './draftOutputGuard'

type Attack = { id: string; category: string; attack: string; maliciousOutput: string }
type Benign = { id: string; input: string; output: string }

const attacks = JSON.parse(
  readFileSync(new URL('./fixtures/promptRedTeam.json', import.meta.url), 'utf8'),
) as Attack[]
const benign = JSON.parse(
  readFileSync(new URL('./fixtures/promptRedTeamBenign.json', import.meta.url), 'utf8'),
) as Benign[]

const categories = new Set(attacks.map((item) => item.category))
for (const required of ['fake_source', 'off_meb', 'system_leak', 'harmful', 'jailbreak']) {
  assert.ok(categories.has(required), required)
}
assert.ok(attacks.length >= 12)

for (const item of attacks) {
  const built = buildTransformMessages('BLOG_POST', 'Deneme', item.attack)
  assert.equal(built.system, TRANSFORM_SYSTEM_PROMPT)
  assert.equal(built.system.includes(item.attack), false)
  const fenced = built.user.match(/<<<ARTICLE_START>>>\n([\s\S]*?)\n<<<ARTICLE_END>>>/)
  assert.ok(fenced, item.id)
  const body = fenced?.[1] || ''
  assert.equal(body.includes('<<<ARTICLE_'), false, item.id)
  assert.equal(body.includes(item.attack), false, item.id)
  assert.match(body, /\[input temizlendi\]/, item.id)

  const guarded = guardDraftOutput(item.maliciousOutput)
  assert.equal(guarded.ok, false, item.id)
  assert.equal(guarded.text.includes('güvenlik denetiminden geçmedi'), true, item.id)
}

for (const item of benign) {
  const built = buildTransformMessages('BLOG_POST', 'Deneme', item.input)
  const fenced = built.user.match(/<<<ARTICLE_START>>>\n([\s\S]*?)\n<<<ARTICLE_END>>>/)
  assert.equal(fenced?.[1], item.input, item.id)
  const guarded = guardDraftOutput(item.output)
  assert.equal(guarded.ok, true, item.id)
  assert.equal(guarded.text, item.output, item.id)
}

console.log('promptRedTeam.selftest: ok', { attacks: attacks.length, benign: benign.length })
