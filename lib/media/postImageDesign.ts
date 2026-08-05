import { resolveLlm } from '../ai/llmClient'

export type PostImageDesign = {
  headline: string
  subtitle: string
  accent: string
  tag: string
}

const ACCENTS = ['#4F46E5', '#0EA5E9', '#7C3AED', '#059669', '#D97706', '#DC2626']

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function cleanLine(s: unknown, max: number): string {
  const text = typeof s === 'string' ? s : s == null ? '' : String(s)
  return text.replace(/\s+/g, ' ').replace(/→.*$/s, '').trim().slice(0, max)
}

/** Pull hook candidates from caption: **bold**, quotes, questions, exclamations. */
function extractHookLines(caption: string): string[] {
  const hooks: string[] = []
  const seen = new Set<string>()

  const add = (raw: string) => {
    const line = cleanLine(raw.replace(/\*\*/g, ''), 200)
    if (!line || line.length < 8) return
    const key = line.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    hooks.push(line)
  }

  for (const m of caption.matchAll(/\*\*([^*]+)\*\*/g)) add(m[1])
  for (const m of caption.matchAll(/[""«»]([^""«»]+)[""«»]/g)) add(m[1])

  for (const line of caption.split(/\n+/)) {
    const t = line.replace(/\*\*/g, '').trim()
    if (!t || t.startsWith('#')) continue
    if (/\?$/.test(t) || /!$/.test(t)) add(t)
  }

  for (const line of caption.split(/\n+/)) {
    const t = line.replace(/\*\*/g, '').trim()
    if (t && !t.startsWith('#') && t.length >= 12) add(t)
  }

  return hooks
}

function pickCatchyHeadline(title: string, caption: string): { headline: string; subtitle: string } {
  const hooks = extractHookLines(caption)
  const t = cleanLine(title, 80) || 'egitim.today'
  const c = cleanLine(caption, 2000) || t

  const headline = cleanLine(hooks[0] || t, 72)
  const subtitleSource =
    hooks[1] ||
    hooks.find((h) => h.toLowerCase() !== headline.toLowerCase()) ||
    c.replace(/\*\*[^*]+\*\*/g, '').replace(/#\S+/g, ' ')
  const subtitle = cleanLine(subtitleSource, 140) || 'Öğren, büyü, hedefe ulaş.'

  return { headline: headline || 'egitim.today', subtitle }
}

function fallbackDesign(title: unknown, caption: unknown): PostImageDesign {
  const t = cleanLine(title, 80) || 'egitim.today'
  const c = cleanLine(caption, 2000) || t
  const { headline, subtitle } = pickCatchyHeadline(t, c)
  const accent = ACCENTS[hashString(t + c) % ACCENTS.length]
  const tagMatch = c.match(/#(\w+)/)
  return {
    headline,
    subtitle,
    accent,
    tag: tagMatch?.[1] || 'egitim',
  }
}

function normalizeDesign(d: PostImageDesign): PostImageDesign {
  return {
    headline: cleanLine(d.headline, 72) || 'egitim.today',
    subtitle: cleanLine(d.subtitle, 140) || 'Öğren, büyü, hedefe ulaş.',
    accent: /^#[0-9A-Fa-f]{6}$/.test(d.accent) ? d.accent : ACCENTS[0],
    tag: cleanLine(d.tag, 24).replace(/^#/, '') || 'egitim',
  }
}

function parseDesignJson(text: string, fallback: PostImageDesign): PostImageDesign {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return fallback
  try {
    const raw = JSON.parse(match[0]) as Record<string, unknown>
    const headline = cleanLine(String(raw.headline || fallback.headline), 72)
    const subtitle = cleanLine(String(raw.subtitle || fallback.subtitle), 140)
    const accentRaw = String(raw.accent || fallback.accent).trim()
    const accent = /^#[0-9A-Fa-f]{6}$/.test(accentRaw) ? accentRaw : fallback.accent
    const tag = cleanLine(String(raw.tag || fallback.tag), 24).replace(/^#/, '')
    return { headline, subtitle, accent, tag }
  } catch {
    return fallback
  }
}

/** Content-aware card copy for branded post image. */
export async function extractPostImageDesign(
  title: unknown,
  caption: unknown,
): Promise<PostImageDesign> {
  const fallback = fallbackDesign(title, caption)
  const { client, model } = resolveLlm()
  if (!client) return normalizeDesign(fallback)

  try {
    const res = await client.chat.completions.create({
      model,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'Türkçe sosyal medya kartı metni yaz (egitim.today). JSON only: {"headline":"max 8 kelime","subtitle":"max 18 kelime","accent":"#RRGGBB","tag":"tek kelime konu"}. ' +
            'headline = caption içindeki EN ÇARPICI cümle (kalın yazılmış, soru, iddia veya merak uyandıran). ' +
            'subtitle = ikinci güçlü mesaj veya CTA. Başlık kopyalamak yerine paylaşım metninden hook seç.',
        },
        {
          role: 'user',
          content: `Title: ${cleanLine(title, 200)}\n\nCaption:\n${cleanLine(caption, 1200)}`,
        },
      ],
    })
    const text = res.choices[0]?.message?.content?.trim() || ''
    return normalizeDesign(parseDesignJson(text, fallback))
  } catch {
    return normalizeDesign(fallback)
  }
}
