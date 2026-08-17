import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { scoreTopicOpportunity } from '@/lib/seo/keywordOpportunity'
import { sendDraftToWordPress, wordpressConfigured } from './publisher'
import { validateWithSafeSamurai } from './safeSamurai'
import type { WpContentPayload, WpPostType, WpPublishResult, SamuraiValidation } from './types'

function mapContentType(contentType: string): WpPostType {
  switch (contentType) {
    case 'PODCAST_SCRIPT':
      return 'podcast'
    case 'MARCH_LYRICS':
    case 'SONG_LYRICS':
      return 'anthem'
    case 'VIDEO_SCRIPT':
    case 'SHORT_VIDEO_SCRIPT':
      return 'video'
    default:
      return 'article'
  }
}

function toHtml(text: string): string {
  const t = text.trim()
  if (t.startsWith('<')) return t
  return `<p>${t.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`
}

export async function buildPayloadFromDerived(derivedId: string): Promise<WpContentPayload> {
  const derived = await prisma.derivedContent.findUnique({
    where: { id: derivedId },
    include: { source: true },
  })
  if (!derived) throw new Error('Derived content not found')

  const meta =
    derived.metadata && typeof derived.metadata === 'object'
      ? (derived.metadata as Record<string, unknown>)
      : {}

  return {
    title: derived.title || derived.source.title,
    content: toHtml(derived.content),
    excerpt: typeof meta.excerpt === 'string' ? meta.excerpt : undefined,
    post_type: mapContentType(derived.contentType),
    meta: {
      podcast_audio_url: typeof meta.podcastAudioUrl === 'string' ? meta.podcastAudioUrl : undefined,
      video_url: typeof meta.videoUrl === 'string' ? meta.videoUrl : undefined,
      lyrics: derived.contentType.includes('LYRICS') ? derived.content : undefined,
      script:
        derived.contentType.includes('VIDEO') || derived.contentType === 'PODCAST_SCRIPT'
          ? derived.content.slice(0, 8000)
          : undefined,
    },
    acf: {
      hkmt_hazir_durum: typeof meta.hkmt_hazir_durum === 'string' ? meta.hkmt_hazir_durum : undefined,
      hkmt_kavramsal_hedef:
        typeof meta.hkmt_kavramsal_hedef === 'string' ? meta.hkmt_kavramsal_hedef : undefined,
      hkmt_metodoloji: typeof meta.hkmt_metodoloji === 'string' ? meta.hkmt_metodoloji : undefined,
      hkmt_takip_transformasyon:
        typeof meta.hkmt_takip_transformasyon === 'string'
          ? meta.hkmt_takip_transformasyon
          : undefined,
      hkmt_hpv_score: typeof meta.hkmt_hpv_score === 'number' ? meta.hkmt_hpv_score : undefined,
      hkmt_search_value_score:
        typeof meta.hkmt_search_value_score === 'number' ? meta.hkmt_search_value_score : undefined,
    },
  }
}

export type SendDerivedToWpResult = {
  validation: SamuraiValidation
  publish?: WpPublishResult
  skipped?: boolean
}

/** Validate then send draft — CS-WP-01 + CS-WP-02 orchestration. */
export async function sendDerivedToWordPressDraft(
  derivedId: string,
): Promise<SendDerivedToWpResult> {
  if (!wordpressConfigured()) {
    return {
      validation: {
        approved: false,
        reason: 'WordPress env eksik (WP_BASE_URL + CONNECT_STUDIO_API_KEY)',
        layer: 'config',
      },
      skipped: true,
    }
  }

  const payload = await buildPayloadFromDerived(derivedId)
  if (process.env.HPV_GATE_ENABLED !== 'false') {
    const opp = await scoreTopicOpportunity(payload.title)
    if (!payload.acf) payload.acf = {}
    payload.acf.hkmt_hpv_score = payload.acf.hkmt_hpv_score ?? opp.hpv
    payload.acf.hkmt_search_value_score =
      payload.acf.hkmt_search_value_score ?? Math.min(100, Math.round(opp.volume / 100))
    if (!opp.wpCandidate) {
      return {
        validation: {
          approved: false,
          reason: opp.reason,
          score: opp.hpv,
          layer: 'config',
        },
        skipped: true,
      }
    }
  }

  const validation = await validateWithSafeSamurai(payload)
  if (!validation.approved) {
    return { validation, skipped: true }
  }

  const publish = await sendDraftToWordPress(payload)
  if (publish.success && publish.wpPostId) {
    const derived = await prisma.derivedContent.findUnique({ where: { id: derivedId } })
    const prev =
      derived?.metadata && typeof derived.metadata === 'object'
        ? (derived.metadata as Record<string, unknown>)
        : {}
    await prisma.derivedContent.update({
      where: { id: derivedId },
      data: {
        metadata: {
          ...prev,
          wordpress: {
            postId: publish.wpPostId,
            editLink: publish.editLink || null,
            sentAt: new Date().toISOString(),
            postType: payload.post_type,
          },
        } as Prisma.InputJsonValue,
      },
    })
  }

  return { validation, publish }
}
