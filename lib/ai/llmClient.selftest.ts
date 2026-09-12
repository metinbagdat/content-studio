import assert from 'node:assert/strict'
import { normalizeGroqModel } from './llmClient'

assert.equal(normalizeGroqModel('llama-3.3-70b-versatile'), 'openai/gpt-oss-20b')
assert.equal(normalizeGroqModel('llama-3.1-8b-instant'), 'openai/gpt-oss-20b')
assert.equal(normalizeGroqModel('openai/gpt-oss-120b'), 'openai/gpt-oss-120b')
assert.equal(normalizeGroqModel(''), 'openai/gpt-oss-20b')
assert.equal(normalizeGroqModel(undefined), 'openai/gpt-oss-20b')

console.log('llmClient normalizeGroqModel: ok')
