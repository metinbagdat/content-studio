import { resolveLlm } from '../ai/llmClient'
import { capPieceCounts, type AtomizationPlan, totalPlannedPieces } from './types'
import { suggestedPodcastEpisodeCount } from '../media/podcastEpisodes'

function mockPlan(title: string, excerpt: string, article = excerpt): AtomizationPlan {
  const pieces = capPieceCounts(undefined)
  pieces.podcastEpisodes = suggestedPodcastEpisodeCount(article, pieces.podcastEpisodes)
  return {
    keyConcepts: ['planlama', 'zaman yönetimi', 'hedef'],
    mainArguments: [excerpt.slice(0, 120) || title],
    quotes: [],
    targetAudience: 'öğrenciler ve kendini geliştirenler',
    emotionalTone: 'motivasyonel',
    contentPieces: pieces,
    distributionDays: 7,
    platformPriority: ['linkedin', 'facebook', 'youtube'],
    generatedAt: new Date().toISOString(),
    mock: true,
  }
}

function parsePlanJson(raw: string, title: string): AtomizationPlan {
  const cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned) as Partial<AtomizationPlan>
  const pieces = capPieceCounts(parsed.contentPieces)
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
Keep the plan small: one long video, one podcast, two LinkedIn posts, two Facebook posts.
Do not add Twitter, Pinterest, shorts, reels, TikTok, songs, marches, carousels, or infographics.

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
    "shortVideos": 0,
    "podcastEpisodes": 1,
    "songs": 0,
    "marches": 0,
    "socialCards": 2,
    "twitterPosts": 0,
    "twitterThreads": 0,
    "linkedinPosts": 2,
    "linkedinCarousels": 0,
    "instagramPosts": 0,
    "instagramReels": 0,
    "tiktokVideos": 0,
    "youtubeShorts": 0,
    "facebookPosts": 2,
    "pinterestPins": 0,
    "infographicSlides": 0
  },
  "distributionDays": 7,
  "platformPriority": ["linkedin", "facebook", "youtube"]
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
