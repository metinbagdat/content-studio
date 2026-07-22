import { resolveLlm } from '../ai/llmClient'

export async function llmJsonBatch<T>(
  system: string,
  user: string,
  fallback: T,
): Promise<T> {
  const { client, model } = resolveLlm()
  if (!client) return fallback

  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.6,
      response_format: { type: 'json_object' },
    })
    const text = res.choices[0]?.message?.content?.trim()
    if (!text) return fallback
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
    return JSON.parse(cleaned) as T
  } catch {
    return fallback
  }
}
