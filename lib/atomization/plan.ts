import { resolveLlm } from '../ai/llmClient'
import {
  DEFAULT_PIECE_COUNTS,
  type AtomizationPlan,
  type ContentPieceCounts,
  totalPlannedPieces,
} from './types'
import { suggestedPodcastEpisodeCount } from '../media/podcastEpisodes'

function mockPlan(title: string, excerpt: string, article = excerpt): AtomizationPlan {
  const pieces = { ...DEFAULT_PIECE_COUNTS }
  pieces.podcastEpisodes = suggestedPodcastEpisodeCount(article, pieces.podcastEpisodes)
  return {
    keyConcepts: ['planlama', 'zaman yönetimi', 'hedef'],
    mainArguments: [excerpt.slice(0, 120) || title],
    quotes: [],
    targetAudience: 'öğrenciler ve kendini geliştirenler',
    emotionalTone: 'motivasyonel',
    contentPieces: pieces,
    distributionDays: 14,
    platformPriority: ['twitter', 'linkedin', 'instagram', 'tiktok', 'youtube', 'facebook', 'pinterest'],
    generatedAt: new Date().toISOString(),
    mock: true,
  }
}

function parsePlanJson(raw: string, title: string): AtomizationPlan {
  const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned) as Partial<AtomizationPlan>
  const pieces = { ...DEFAULT_PIECE_COUNTS, ...(parsed.contentPieces || {}) } as ContentPieceCounts
  return {
    keyConcepts: parsed.keyConcepts?.length ? parsed.keyConcepts : ['içerik', 'öğrenme'],
    mainArguments: parsed.mainArguments?.length ? parsed.mainArguments : [title],
    quotes: parsed.quotes || [],
    targetAudience: parsed.targetAudience || 'egitim.today okuyucuları',
    emotionalTone: parsed.emotionalTone || 'bilgilendirici',
    contentPieces: pieces,
    distributionDays: parsed.distributionDays || 14,
    platformPriority: parsed.platformPriority || [
      'twitter',
      'linkedin',
      'instagram',
      'tiktok',
      'youtube',
      'facebook',
      'pinterest',
    ],
    generatedAt: new Date().toISOString(),
  }
}

/** LLM atomization plan — Groq first, mock fallback. */
export async function generateAtomizationPlan(
  title: string,
  articleText: string,
): Promise<AtomizationPlan> {
  const excerpt = articleText.slice(0, 3000)
  const { client, model } = resolveLlm()
  if (!client) return mockPlan(title, excerpt, articleText)

  const prompt = `Analyze this Turkish article and output ONLY valid JSON for a content atomization plan.
Maximize social output from one article (target ~50 pieces total).

Article title: ${title}
Article excerpt:
${excerpt}

JSON schema:
{
  "keyConcepts": ["..."],
  "mainArguments": ["..."],
  "quotes": ["..."],
  "targetAudience": "...",
  "emotionalTone": "...",
  "contentPieces": {
    "longFormVideo": 1,
    "shortVideos": 3,
    "podcastEpisodes": 1,
    "songs": 1,
    "marches": 1,
    "socialCards": 5,
    "twitterPosts": 10,
    "twitterThreads": 2,
    "linkedinPosts": 5,
    "linkedinCarousels": 1,
    "instagramPosts": 5,
    "instagramReels": 3,
    "tiktokVideos": 3,
    "youtubeShorts": 2,
    "facebookPosts": 3,
    "pinterestPins": 5,
    "infographicSlides": 2
  },
  "distributionDays": 14,
  "platformPriority": ["twitter", "linkedin", "instagram", "tiktok", "youtube", "facebook", "pinterest"]
}`

  try {
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    })
    const content = res.choices[0]?.message?.content
    if (!content) return mockPlan(title, excerpt)
    const plan = parsePlanJson(content, title)
    plan.contentPieces.podcastEpisodes = suggestedPodcastEpisodeCount(
      articleText,
      plan.contentPieces.podcastEpisodes,
    )
    return plan
  } catch {
    return mockPlan(title, excerpt, articleText)
  }
}

export { totalPlannedPieces }
