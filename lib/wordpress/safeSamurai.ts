import { resolveLlm } from '@/lib/ai/llmClient'
import type { SamuraiValidation, WpContentPayload } from './types'

/** Pre-send Safe samurAI gate — fail closed on LLM errors (CS-WP-02). */
export async function validateWithSafeSamurai(
  payload: WpContentPayload,
): Promise<SamuraiValidation> {
  if (process.env.SAFE_SAMURAI_ENABLED === 'false') {
    return {
      approved: true,
      reason: 'SAFE_SAMURAI_ENABLED=false — gate skipped',
      score: 100,
      layer: 'skip',
    }
  }

  const fullText = `${payload.title}\n${payload.content}`.slice(0, 12000)
  if (fullText.trim().length < 20) {
    return {
      approved: false,
      reason: 'İçerik çok kısa — manuel inceleme gerekli',
      score: 0,
      layer: 'config',
    }
  }

  const { client, provider, model } = resolveLlm()
  if (!client || provider === 'none') {
    return {
      approved: false,
      reason: 'LLM yok (OPENAI/GROQ) — Safe samurAI fail-closed; manuel inceleme',
      score: 0,
      layer: 'config',
    }
  }

  // OpenAI Moderation only when using real OpenAI (not Groq-compatible base)
  if (provider === 'openai') {
    try {
      const moderation = await client.moderations.create({ input: fullText.slice(0, 8000) })
      const result = moderation.results[0]
      if (result?.flagged) {
        const flagged = Object.entries(result.categories || {})
          .filter(([, v]) => v === true)
          .map(([k]) => k)
          .join(', ')
        return {
          approved: false,
          reason: `Moderation flag: ${flagged || 'flagged'}`,
          score: 10,
          layer: 'moderation',
        }
      }
    } catch (err) {
      console.warn('[safeSamurai] moderation error — continuing to HKMT layer', err)
    }
  }

  const prompt = `Sen egitim.today içerik güvenlik filtresisin (Safe samurAI / HKMT).
Sadece ilk satırda APPROVED veya REJECTED yaz; ikinci satırda kısa Türkçe gerekçe.

REDDET (REJECTED) eğer:
- Dikte / baskı / suçlama ("Asla yapma", "Kesinlikle zorundasın", "Unutma!" emir tonu)
- Korku, umutsuzluk, kaygı aşılama
- Nefret, şiddet, politik propaganda, yanıltıcı garanti ("%100 net")

ONAYLA (APPROVED) eğer:
- Umutlu, bilimsel, özgür iradeye saygılı, öz-yatırım odaklı eğitim içeriği
- HKMT ile uyumlu olabilir (hazır durum / hedef / metodoloji / takip)

METİN:
"""
${fullText.slice(0, 3500)}
"""`

  try {
    const response = await client.chat.completions.create({
      model: model || 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 120,
      messages: [
        { role: 'system', content: 'Kurallara göre APPROVED veya REJECTED ile başla.' },
        { role: 'user', content: prompt },
      ],
    })
    const reply = (response.choices[0]?.message?.content || '').trim()
    const upper = reply.toUpperCase()
    if (upper.startsWith('APPROVED')) {
      return {
        approved: true,
        reason: reply.replace(/^APPROVED[:\s-]*/i, '').trim() || 'Safe samurAI onayladı',
        score: 90,
        layer: 'hkmt',
      }
    }
    return {
      approved: false,
      reason: reply.replace(/^REJECTED[:\s-]*/i, '').trim() || 'HKMT/dil kurallarına uymuyor',
      score: 20,
      layer: 'hkmt',
    }
  } catch (err) {
    console.error('[safeSamurai] LLM error — fail closed', err)
    return {
      approved: false,
      reason: 'AI değerlendirme hatası — manuel inceleme gerekli',
      score: 0,
      layer: 'config',
    }
  }
}
