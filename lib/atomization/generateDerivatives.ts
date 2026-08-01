import type { Prisma, SocialPlatform } from '@prisma/client'
import { prisma } from '../prisma'
import { buildCaptionSeries, captionPartMetadata } from '../content/captionSeries'
import { formatForPlatform, PINTEREST_FORMAT, PLATFORM_FORMATS } from '../platforms/formats'
import { platformWants } from '../platforms/targets'
import type { AtomizationPlan } from './types'
import {
  articleExcerpt,
  baseMetadata,
  brandCta,
  pickConcepts,
  splitArticleSections,
} from './articleChunks'
import { llmJsonBatch } from './llmBatch'
import type { AtomKind, DerivativeDraft, GenerateDerivativesInput, GenerateDerivativesResult } from './types-derivative'

const HASHTAGS = '#egitim #egitimtoday #ogrenme'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function generateSocialPostsBatch(
  platform: 'TWITTER' | 'LINKEDIN' | 'INSTAGRAM' | 'FACEBOOK',
  count: number,
  title: string,
  article: string,
  plan: AtomizationPlan,
  atomKind: AtomKind,
): Promise<DerivativeDraft[]> {
  if (count <= 0) return []
  const maxChars = PLATFORM_FORMATS[platform].maxChars
  const tone = PLATFORM_FORMATS[platform].tone
  const concepts = pickConcepts(plan.keyConcepts, splitArticleSections(article), count)

  const fallback = {
    posts: concepts.map((c, i) => ({
      text: formatForPlatform(`${c} — ${title.slice(0, 80)}${i === count - 1 ? brandCta() : ''}`, platform),
    })),
  }

  const batch = await llmJsonBatch<{ posts: Array<{ text: string }> }>(
    `You write Turkish ${platform} posts for egitim.today. Max ${maxChars} chars each. Tone: ${tone}.`,
    `Article: ${title}\nConcepts: ${concepts.join(', ')}\nExcerpt:\n${articleExcerpt(article, 2000)}\n\nOutput JSON: {"posts":[{"text":"..."}]} with exactly ${count} posts.`,
    fallback,
  )

  return (batch.posts || fallback.posts).slice(0, count).map((p, i) => ({
    contentType: 'SOCIAL_CAPTION' as const,
    title: `${platform} ${i + 1}/${count}: ${title.slice(0, 60)}`,
    content: formatForPlatform(p.text, platform),
    metadata: baseMetadata(atomKind, title, undefined, {
      platform,
      partIndex: i + 1,
      partTotal: count,
    }),
  }))
}

async function generatePinterestPins(
  count: number,
  title: string,
  article: string,
  plan: AtomizationPlan,
): Promise<DerivativeDraft[]> {
  if (count <= 0) return []
  const concepts = pickConcepts(plan.keyConcepts, splitArticleSections(article), count)
  const max = PINTEREST_FORMAT.maxChars

  const fallback = {
    pins: concepts.map((c) => ({
      text: `${c} | ${title}`.slice(0, max),
    })),
  }

  const batch = await llmJsonBatch<{ pins: Array<{ text: string }> }>(
    'Write keyword-rich Turkish Pinterest pin descriptions for egitim.today.',
    `Title: ${title}\nKeywords: ${concepts.join(', ')}\nOutput JSON {"pins":[{"text":"..."}]} count=${count}, max ${max} chars.`,
    fallback,
  )

  return (batch.pins || fallback.pins).slice(0, count).map((p, i) => ({
    contentType: 'SOCIAL_CAPTION' as const,
    title: `Pinterest ${i + 1}/${count}: ${title.slice(0, 50)}`,
    content: p.text.slice(0, max),
    metadata: baseMetadata('pinterest_pin', title, undefined, {
      platform: 'PINTEREST',
      partIndex: i + 1,
      partTotal: count,
    }),
  }))
}

async function generateTwitterThreads(
  count: number,
  title: string,
  article: string,
  plan: AtomizationPlan,
  articleUrl?: string,
): Promise<DerivativeDraft[]> {
  if (count <= 0) return []
  const sections = splitArticleSections(article)
  const drafts: DerivativeDraft[] = []

  for (let t = 0; t < count; t++) {
    const tweetCount = 5 + (t % 3)
    const fallback = {
      tweets: Array.from({ length: tweetCount }, (_, i) => ({
        text: formatForPlatform(
          i === 0
            ? `${title} 🧵`
            : i === tweetCount - 1
              ? `${brandCta()} ${HASHTAGS}`
              : `${sections[i % sections.length]?.heading || plan.keyConcepts[i % plan.keyConcepts.length] || title}`,
          'TWITTER',
        ),
      })),
    }

    const batch = await llmJsonBatch<{ tweets: Array<{ text: string }> }>(
      'Write Turkish Twitter/X threads for egitim.today. Each tweet max 280 chars.',
      `Thread ${t + 1} about: ${title}\nArguments: ${plan.mainArguments.join('; ')}\nExcerpt:\n${articleExcerpt(article, 1500)}\nJSON {"tweets":[{"text":"..."}]} exactly ${tweetCount} tweets. First=hook, last=CTA.`,
      fallback,
    )

    const tweets = (batch.tweets || fallback.tweets).slice(0, tweetCount)
    const content = tweets.map((tw, i) => `${i + 1}/${tweets.length} ${tw.text}`).join('\n\n')
    const seriesId = crypto.randomUUID()

    drafts.push({
      contentType: 'TWITTER_THREAD',
      title: `Twitter thread ${t + 1}/${count}: ${title.slice(0, 50)}`,
      content,
      metadata: baseMetadata('twitter_thread', title, articleUrl, {
        platform: 'TWITTER',
        seriesId,
        partIndex: t + 1,
        partTotal: count,
        tweetTotal: tweets.length,
      }),
    })
  }
  return drafts
}

async function generateLinkedInCarousels(
  count: number,
  title: string,
  article: string,
  plan: AtomizationPlan,
  articleUrl?: string,
): Promise<DerivativeDraft[]> {
  if (count <= 0) return []
  const sections = splitArticleSections(article)
  const drafts: DerivativeDraft[] = []

  for (let c = 0; c < count; c++) {
    const slideCount = 8
    const points = sections.slice(0, slideCount - 2).map((s) => s.heading)
    while (points.length < slideCount - 2) {
      points.push(plan.keyConcepts[points.length % plan.keyConcepts.length] || title)
    }

    const fallback = {
      slides: [
        { title: title, body: 'egitim.today' },
        ...points.map((p) => ({ title: p, body: sections.find((s) => s.heading === p)?.body.slice(0, 200) || p })),
        { title: 'Özet', body: plan.mainArguments[0] || title },
        { title: 'CTA', body: brandCta() },
      ].slice(0, slideCount),
    }

    const batch = await llmJsonBatch<{ slides: Array<{ title: string; body: string }> }>(
      'Write LinkedIn carousel slide copy in Turkish for egitim.today.',
      `Carousel for: ${title}\nJSON {"slides":[{"title":"...","body":"..."}]} exactly ${slideCount} slides. Slide1=hook, last=CTA.`,
      fallback,
    )

    const slides = (batch.slides || fallback.slides).slice(0, slideCount)
    const content = slides
      .map((s, i) => `Slide ${i + 1}/${slides.length}\n**${s.title}**\n${s.body}`)
      .join('\n\n---\n\n')

    drafts.push({
      contentType: 'LINKEDIN_CAROUSEL',
      title: `LinkedIn carousel ${c + 1}/${count}: ${title.slice(0, 50)}`,
      content,
      metadata: baseMetadata('linkedin_carousel', title, articleUrl, {
        platform: 'LINKEDIN',
        seriesId: crypto.randomUUID(),
        partIndex: c + 1,
        partTotal: count,
        slideTotal: slides.length,
      }),
    })
  }
  return drafts
}

async function generateShortVideos(
  count: number,
  title: string,
  article: string,
  plan: AtomizationPlan,
  platform: 'TIKTOK' | 'INSTAGRAM' | 'YOUTUBE',
  atomKind: AtomKind,
  label: string,
): Promise<DerivativeDraft[]> {
  if (count <= 0) return []
  const sections = splitArticleSections(article)
  const concepts = pickConcepts(plan.keyConcepts, sections, count)
  const drafts: DerivativeDraft[] = []

  for (let i = 0; i < count; i++) {
    const concept = concepts[i]
    const fallback = {
      hook: concept.slice(0, 60),
      scenes: [
        { t: '0-3s', visual: 'Hook text on screen', voice: concept },
        { t: '3-45s', visual: 'B-roll + captions', voice: sections[i % sections.length]?.body.slice(0, 120) || concept },
        { t: '45-55s', visual: 'CTA egitim.today', voice: 'Detay için egitim.today' },
      ],
      durationSec: 55,
      caption: formatForPlatform(`${concept} ${HASHTAGS}`, platform === 'YOUTUBE' ? 'YOUTUBE' : 'TIKTOK'),
    }

    const batch = await llmJsonBatch<typeof fallback>(
      `Write 30-60s vertical short video script JSON for ${platform} in Turkish.`,
      `Topic: ${concept}\nArticle: ${title}\nJSON {hook, scenes[{t,visual,voice}], durationSec, caption}`,
      fallback,
    )

    drafts.push({
      contentType: 'SHORT_VIDEO_SCRIPT',
      title: `${label} ${i + 1}/${count}: ${concept.slice(0, 40)}`,
      content: JSON.stringify(batch, null, 2),
      metadata: baseMetadata(atomKind, title, undefined, {
        platform,
        partIndex: i + 1,
        partTotal: count,
      }),
    })
  }
  return drafts
}

async function generateInfographicText(
  count: number,
  title: string,
  article: string,
  plan: AtomizationPlan,
  articleUrl?: string,
): Promise<DerivativeDraft[]> {
  if (count <= 0) return []
  const sections = splitArticleSections(article)
  const drafts: DerivativeDraft[] = []

  for (let i = 0; i < count; i++) {
    const pointCount = 5
    const fallback = {
      headline: title.slice(0, 60),
      subhead: plan.emotionalTone || 'egitim.today',
      points: sections.slice(0, pointCount).map((s) => ({
        label: s.heading,
        stat: '',
        detail: s.body.slice(0, 100),
      })),
      source: 'egitim.today',
    }

    const batch = await llmJsonBatch<typeof fallback>(
      'Design Turkish infographic copy for egitim.today. Short, scannable, numbers/stats where possible.',
      `Article: ${title}\nKey concepts: ${plan.keyConcepts.join(', ')}\nMain arguments: ${plan.mainArguments.join('; ')}\nExcerpt:\n${articleExcerpt(article, 1500)}\n\nJSON schema: {"headline":"...","subhead":"...","points":[{"label":"...","stat":"...","detail":"..."}]} with exactly ${pointCount} points. "stat" is a short number/percentage when relevant, else empty string.`,
      fallback,
    )

    const points = (batch.points || fallback.points).slice(0, pointCount)
    const content = [
      `# ${batch.headline || fallback.headline}`,
      batch.subhead || fallback.subhead,
      '',
      ...points.map((p, idx) => `${idx + 1}. ${p.label}${p.stat ? ` — ${p.stat}` : ''}\n   ${p.detail}`),
      '',
      `Kaynak: ${batch.source || 'egitim.today'}`,
    ].join('\n')

    drafts.push({
      contentType: 'INFOGRAPHIC_TEXT',
      title: `Infografik ${i + 1}/${count}: ${title.slice(0, 50)}`,
      content,
      metadata: baseMetadata('infographic', title, articleUrl, {
        partIndex: i + 1,
        partTotal: count,
        pointCount: points.length,
      }),
    })
  }
  return drafts
}

function linkedinCaptionSeries(
  title: string,
  article: string,
  articleUrl: string | undefined,
  linkedinPostCount: number,
): DerivativeDraft[] {
  const seriesParts = Math.min(4, Math.max(1, linkedinPostCount))
  const parts = buildCaptionSeries(title, article, seriesParts)
  const seriesId = crypto.randomUUID()
  return parts.map((part) => ({
    contentType: 'SOCIAL_CAPTION' as const,
    title: part.title.replace('Caption', 'LinkedIn'),
    content: part.content,
    metadata: {
      ...captionPartMetadata(part, seriesId, title, articleUrl),
      atomKind: 'linkedin_post',
      platform: 'LINKEDIN',
    },
  }))
}

/** Generate ~50 atomized derivatives from plan and persist to DB. */
export async function generateAllDerivatives(
  plan: AtomizationPlan,
  input: GenerateDerivativesInput,
): Promise<GenerateDerivativesResult> {
  const { sourceId, title, article, articleUrl, platforms } = input
  const want = (p: SocialPlatform) => platformWants(platforms, p)
  const p = plan.contentPieces
  const drafts: DerivativeDraft[] = []

  // X (Twitter) first — primary SM surface for egitim.today
  if (want('TWITTER')) {
    drafts.push(...(await generateSocialPostsBatch('TWITTER', p.twitterPosts, title, article, plan, 'twitter_post')))
    drafts.push(...(await generateTwitterThreads(p.twitterThreads, title, article, plan, articleUrl)))
  }

  // YouTube Shorts (+ long-form handled separately as VIDEO_SCRIPT in pipeline)
  if (want('YOUTUBE')) {
    drafts.push(
      ...(await generateShortVideos(p.youtubeShorts, title, article, plan, 'YOUTUBE', 'youtube_short', 'YouTube Short')),
    )
  }

  if (want('LINKEDIN')) {
    const seriesCount = Math.min(4, p.linkedinPosts)
    drafts.push(...linkedinCaptionSeries(title, article, articleUrl, seriesCount))
    const extraLinkedin = Math.max(0, p.linkedinPosts - seriesCount)
    if (extraLinkedin) {
      drafts.push(
        ...(await generateSocialPostsBatch('LINKEDIN', extraLinkedin, title, article, plan, 'linkedin_post')),
      )
    }
    drafts.push(...(await generateLinkedInCarousels(p.linkedinCarousels, title, article, plan, articleUrl)))
  }

  if (want('INSTAGRAM')) {
    drafts.push(
      ...(await generateSocialPostsBatch('INSTAGRAM', p.instagramPosts, title, article, plan, 'instagram_post')),
    )
    drafts.push(
      ...(await generateShortVideos(p.instagramReels, title, article, plan, 'INSTAGRAM', 'instagram_reel', 'Reels')),
    )
  }

  if (want('TIKTOK')) {
    drafts.push(...(await generateShortVideos(p.tiktokVideos, title, article, plan, 'TIKTOK', 'tiktok_video', 'TikTok')))
    drafts.push(
      ...(await generateShortVideos(p.shortVideos, title, article, plan, 'TIKTOK', 'short_video', 'Short video')),
    )
  }

  if (want('FACEBOOK')) {
    drafts.push(...(await generateSocialPostsBatch('FACEBOOK', p.facebookPosts, title, article, plan, 'facebook_post')))
  }

  // Pinterest when any social surface is selected (no enum on SocialPlatform)
  if (!platforms?.length || platforms.some((x) => ['TWITTER', 'INSTAGRAM', 'FACEBOOK'].includes(x))) {
    drafts.push(...(await generatePinterestPins(p.pinterestPins, title, article, plan)))
  }

  // Infographic copy: design-ready text, not tied to a single publish platform
  drafts.push(...(await generateInfographicText(p.infographicSlides, title, article, plan, articleUrl)))

  // Mark first N captions for auto image — do NOT overwrite atomKind/platform
  // (overwriting linkedin_post → social_card broke calendar matching + LI visibility)
  let cardsMarked = 0
  for (const d of drafts) {
    if (cardsMarked >= p.socialCards) break
    if (d.contentType === 'SOCIAL_CAPTION' && d.metadata.platform) {
      d.metadata.autoGenerateImage = true
      d.metadata.socialCard = true
      cardsMarked += 1
    }
  }

  const byType: Record<string, number> = {}
  for (const batch of chunk(drafts, 25)) {
    for (const d of batch) {
      byType[d.contentType] = (byType[d.contentType] || 0) + 1
      await prisma.derivedContent.create({
        data: {
          sourceId,
          contentType: d.contentType,
          title: d.title,
          content: d.content,
          metadata: { ...d.metadata, planGeneratedAt: plan.generatedAt } as Prisma.InputJsonValue,
          status: 'IN_REVIEW',
        },
      })
    }
  }

  return { created: drafts.length, byType }
}
