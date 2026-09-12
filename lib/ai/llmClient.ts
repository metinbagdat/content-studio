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

/** Env may still pin retired IDs — remap so pipeline does not 404. */
const GROQ_RETIRED_MODELS: Record<string, string> = {
  'llama-3.3-70b-versatile': GROQ_DEFAULT_MODEL,
  'llama-3.1-8b-instant': GROQ_DEFAULT_MODEL,
  'llama3-70b-8192': GROQ_DEFAULT_MODEL,
  'llama3-8b-8192': GROQ_DEFAULT_MODEL,
  'mixtral-8x7b-32768': GROQ_DEFAULT_MODEL,
  'gemma2-9b-it': GROQ_DEFAULT_MODEL,
}

export function normalizeGroqModel(model: string | undefined | null): string {
  const raw = (model || '').trim() || GROQ_DEFAULT_MODEL
  return GROQ_RETIRED_MODELS[raw] || raw
}

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
      model: normalizeGroqModel(process.env.GROQ_MODEL),
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  const openaiBase = process.env.OPENAI_BASE_URL?.trim() || ''
  if (openaiKey && openaiBase.includes('groq.com')) {
    return {
      client: new OpenAI({ apiKey: openaiKey, baseURL: openaiBase }),
      provider: 'groq',
      model: normalizeGroqModel(
        process.env.OPENAI_MODEL?.trim() || process.env.GROQ_MODEL?.trim(),
      ),
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
