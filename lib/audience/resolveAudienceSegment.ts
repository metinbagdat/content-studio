import { resolveLlm } from '../ai/llmClient'
import {
  AUDIENCE_SEGMENTS,
  detectAudienceSegment,
  isAudienceSegment,
  parseSegmentFromTags,
  type AudienceSegment,
} from './segments'

export type ResolveAudienceResult = {
  segment: AudienceSegment
  source: 'tag' | 'rules' | 'llm' | 'fallback'
}

/**
 * Rules first; if ambiguous (`genel`) and LLM is configured, ask once.
 * Explicit `seg:` tags always win. Used at ingest / createPipeline — not on hot list filters.
 */
export async function resolveAudienceSegment(
  text: string,
  tags?: string[] | null,
): Promise<ResolveAudienceResult> {
  const fromTags = parseSegmentFromTags(tags)
  if (fromTags) return { segment: fromTags, source: 'tag' }

  const rules = detectAudienceSegment(text, tags)
  if (rules !== 'genel') return { segment: rules, source: 'rules' }

  const llm = await classifyAudienceWithLlm(text)
  if (llm) return { segment: llm, source: 'llm' }

  return { segment: 'genel', source: 'fallback' }
}

async function classifyAudienceWithLlm(text: string): Promise<AudienceSegment | null> {
  const { client, model } = resolveLlm()
  if (!client) return null

  const excerpt = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200)
  if (excerpt.length < 40) return null

  const allowed = AUDIENCE_SEGMENTS.join('|')
  try {
    const res = await client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 20,
      messages: [
        {
          role: 'system',
          content:
            `Türkçe eğitim içeriği hedef kitlesini sınıflandır. ` +
            `Yalnızca tek kelime cevap ver: ${allowed}. ` +
            `tyt=TYT/11. sınıf/temel yeterlilik; ayt=AYT/alan sınavı; lgs=LGS/ortaokul; ` +
            `veli=anne-baba; egitimci=öğretmen/rehber; genel=belirsiz veya karışık.`,
        },
        { role: 'user', content: excerpt },
      ],
    })
    const raw = (res.choices[0]?.message?.content || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, '')
    if (isAudienceSegment(raw)) return raw
    return null
  } catch (err) {
    console.warn('[audience] LLM segment classify failed', err)
    return null
  }
}
