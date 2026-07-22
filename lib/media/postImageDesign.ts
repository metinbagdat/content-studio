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

function cleanLine(s: string, max: number): string {
  return s.replace(/\s+/g, ' ').replace(/→.*$/s, '').trim().slice(0, max)
}

function fallbackDesign(title: string, caption: string): PostImageDesign {
  const lines = caption.split('\n').map((l) => l.trim()).filter(Boolean)
  const headline = cleanLine(lines[0] || title, 72)
  const body = lines.slice(1).join(' ') || caption
  const subtitle = cleanLine(body.replace(/#\S+/g, '').trim(), 140)
  const accent = ACCENTS[hashString(title + caption) % ACCENTS.length]
  const tagMatch = caption.match(/#(\w+)/)
  return {
    headline: headline || 'egitim.today',
    subtitle: subtitle || 'Öğren, büyü, hedefe ulaş.',
    accent,
    tag: tagMatch?.[1] || 'egitim',
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
  title: string,
  caption: string,
): Promise<PostImageDesign> {
  const fallback = fallbackDesign(title, caption)
  const { client, model } = resolveLlm()
  if (!client) return fallback

  try {
    const res = await client.chat.completions.create({
      model,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'You design Turkish social media card graphics for egitim.today. Return JSON only: {"headline":"max 8 words","subtitle":"max 18 words","accent":"#RRGGBB","tag":"single topic word"}. Headline must match caption topic.',
        },
        {
          role: 'user',
          content: `Title: ${title}\n\nCaption:\n${caption.slice(0, 1200)}`,
        },
      ],
    })
    const text = res.choices[0]?.message?.content?.trim() || ''
    return parseDesignJson(text, fallback)
  } catch {
    return fallback
  }
}
