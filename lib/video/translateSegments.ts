import { resolveLlm } from '../ai/llmClient'

export type TranslatedSegment = { text: string; visualPrompt: string }

/** Batch-translate all segment narrations to English in a single LLM call (order preserved). */
export async function translateSegmentsToEnglish(
  segments: Array<{ text: string; visualPrompt: string }>,
): Promise<TranslatedSegment[]> {
  const { client, model } = resolveLlm()
  if (!client) return segments // fallback: no LLM configured, keep Turkish as-is

  try {
    const res = await client.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'Translate each Turkish sentence to natural, concise English. Return JSON only: {"translations":["...","..."]} — exactly as many items as given, same order.',
        },
        { role: 'user', content: JSON.stringify(segments.map((s) => s.text)) },
      ],
    })
    const raw = res.choices[0]?.message?.content?.trim() || ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return segments
    const parsed = JSON.parse(match[0]) as { translations?: string[] }
    if (!parsed.translations || parsed.translations.length !== segments.length) return segments

    return segments.map((s, i) => ({ text: parsed.translations![i] || s.text, visualPrompt: s.visualPrompt }))
  } catch {
    return segments
  }
}