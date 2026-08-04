import { resolveLlm } from '../ai/llmClient'

const cache = new Map<string, string>()

/** Turn a Turkish scene description into a concise, literal English text-to-image prompt —
 * image models follow English prompts far more reliably than Turkish ones. */
export async function toImagePrompt(visualsTr: string): Promise<string> {
  const key = visualsTr.trim().toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached

  const { client, model } = resolveLlm()
  if (!client) return visualsTr // fallback: use Turkish as-is if no LLM configured

  try {
    const res = await client.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'Translate the Turkish scene description into a short, literal English text-to-image prompt (max 20 words). Describe only concrete visual elements — objects, setting, action, mood. No people\'s faces unless explicitly described. No text/words/letters in the image. Output only the prompt, nothing else.',
        },
        { role: 'user', content: visualsTr },
      ],
    })
    const text = res.choices[0]?.message?.content?.trim()
    const prompt = text || visualsTr
    cache.set(key, prompt)
    return prompt
  } catch {
    return visualsTr
  }
}