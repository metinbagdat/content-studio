import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { scoreTopicOpportunity } from './keywordOpportunity'
import { sendDerivedToWordPressDraft } from '../wordpress/sendDraft'
import { wordpressConfigured } from '../wordpress/publisher'

const WP_TYPES = [
  'BLOG_POST',
  'PODCAST_SCRIPT',
  'VIDEO_SCRIPT',
  'SHORT_VIDEO_SCRIPT',
  'MARCH_LYRICS',
  'SONG_LYRICS',
] as const

export type HpvScanResult = {
  scanned: number
  taggedWp: number
  taggedSm: number
  sent: number
  skipped: number
  errors: string[]
}

function seoTags(wpCandidate: boolean, hpv: number, volume: number): string[] {
  return [
    wpCandidate ? 'seo:wp' : 'seo:sm',
    `hpv:${Math.round(hpv)}`,
    `vol:${Math.round(volume)}`,
  ]
}

function stripSeoTags(tags: string[]): string[] {
  return tags.filter((t) => !t.startsWith('seo:') && !t.startsWith('hpv:') && !t.startsWith('vol:'))
}

/** Daily HPV scan: tag sources, optionally send WP drafts for high-opportunity approved pieces. */
export async function runHpvOpportunityScan(limit = 8): Promise<HpvScanResult> {
  const result: HpvScanResult = {
    scanned: 0,
    taggedWp: 0,
    taggedSm: 0,
    sent: 0,
    skipped: 0,
    errors: [],
  }

  const sources = await prisma.contentSource.findMany({
    where: { NOT: { tags: { hasSome: ['seo:wp', 'seo:sm'] } } },
    orderBy: { createdAt: 'desc' },
    take: Math.max(1, limit),
    include: {
      derivedContents: {
        where: {
          status: 'APPROVED',
          contentType: { in: [...WP_TYPES] },
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
  })

  for (const source of sources) {
    result.scanned += 1
    try {
      const opp = await scoreTopicOpportunity(source.title)
      const tags = [...stripSeoTags(source.tags), ...seoTags(opp.wpCandidate, opp.hpv, opp.volume)]
      await prisma.contentSource.update({
        where: { id: source.id },
        data: { tags },
      })

      if (opp.wpCandidate) result.taggedWp += 1
      else result.taggedSm += 1

      if (!opp.wpCandidate) {
        result.skipped += 1
        continue
      }

      const derived = source.derivedContents.find((d) => {
        const meta = d.metadata && typeof d.metadata === 'object' ? (d.metadata as Record<string, unknown>) : {}
        const wp = meta.wordpress
        return !(wp && typeof wp === 'object' && (wp as { postId?: number }).postId)
      })
      if (!derived) {
        result.skipped += 1
        continue
      }

      if (!wordpressConfigured()) {
        result.skipped += 1
        continue
      }

      const prev =
        derived.metadata && typeof derived.metadata === 'object'
          ? (derived.metadata as Record<string, unknown>)
          : {}
      await prisma.derivedContent.update({
        where: { id: derived.id },
        data: {
          metadata: {
            ...prev,
            hkmt_hpv_score: opp.hpv,
            hkmt_search_value_score: Math.min(100, Math.round(opp.volume / 100)),
          } as Prisma.InputJsonValue,
        },
      })

      const send = await sendDerivedToWordPressDraft(derived.id)
      if (send.publish?.success) result.sent += 1
      else result.skipped += 1
    } catch (err) {
      result.errors.push(`${source.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return result
}
