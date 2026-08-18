import OpenAI from 'openai'

export type LlmProvider = 'groq' | 'openai' | 'none'

const GROQ_BASE = 'https://api.groq.com/openai/v1'
/**
 * Groq no longer hosts Llama chat on free/developer (llama-3.1-8b-instant and
 * llama-3.3-70b-versatile retired 2026-08-16). Official replacement for the
 * free Llama 8B Instant tier: openai/gpt-oss-20b.
 */
const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-20b'
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini'

/** Groq öncelikli; yoksa OPENAI_*; ikisi de yoksa null (mock). */
export function resolveLlm(): {
  client: OpenAI | null
  provider: LlmProvider
  model: string
} {
  const groqKey = process.env.GROQ_API_KEY?.trim()
  if (groqKey) {
    return {
      client: new OpenAI({
        apiKey: groqKey,
        baseURL: process.env.GROQ_BASE_URL?.trim() || GROQ_BASE,
      }),
      provider: 'groq',
      model: process.env.GROQ_MODEL?.trim() || GROQ_DEFAULT_MODEL,
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  const openaiBase = process.env.OPENAI_BASE_URL?.trim() || ''
  if (openaiKey && openaiBase.includes('groq.com')) {
    return {
      client: new OpenAI({ apiKey: openaiKey, baseURL: openaiBase }),
      provider: 'groq',
      model: process.env.OPENAI_MODEL?.trim() || process.env.GROQ_MODEL?.trim() || GROQ_DEFAULT_MODEL,
    }
  }

  if (openaiKey) {
    return {
      client: new OpenAI({
        apiKey: openaiKey,
        baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined,
      }),
      provider: 'openai',
      model: process.env.OPENAI_MODEL?.trim() || OPENAI_DEFAULT_MODEL,
    }
  }

  return { client: null, provider: 'none', model: '' }
}

export function llmModeLabel(): string {
  const { provider, model } = resolveLlm()
  if (provider === 'none') return 'mock — GROQ_API_KEY veya OPENAI_API_KEY gerekli'
  return `${provider} (${model})`
}
